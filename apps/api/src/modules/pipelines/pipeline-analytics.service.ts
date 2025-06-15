import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class PipelineAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async calculateFunnelMetrics(
    pipelineId: string,
    dateRange?: { start: Date; end: Date },
  ) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!pipeline) {
      throw new Error("Pipeline not found");
    }

    // Get all deals in date range
    const deals = await this.prisma.deal.findMany({
      where: {
        pipelineId,
        ...(dateRange && {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }),
      },
      include: {
        stageTransitions: {
          orderBy: { transitionTime: "asc" },
        },
      },
    });

    // Calculate funnel conversion rates
    const stageConversions = new Map<
      string,
      { entered: number; exited: number }
    >();

    pipeline.stages.forEach((stage) => {
      stageConversions.set(stage.id, { entered: 0, exited: 0 });
    });

    // Track deals that entered each stage
    deals.forEach((deal) => {
      // Count initial stage
      const initialStage =
        deal.stageTransitions[0]?.fromStageId || deal.stageId;
      const stageData = stageConversions.get(initialStage);
      if (stageData) {
        stageData.entered++;
      }

      // Count transitions
      deal.stageTransitions.forEach((transition) => {
        const fromData = stageConversions.get(transition.fromStageId);
        const toData = stageConversions.get(transition.toStageId);

        if (fromData) fromData.exited++;
        if (toData) toData.entered++;
      });
    });

    // Calculate conversion rates between stages
    const funnelData = pipeline.stages.map((stage) => {
      const data = stageConversions.get(stage.id) ?? { entered: 0, exited: 0 };
      const conversionRate =
        data.entered > 0 ? (data.exited / data.entered) * 100 : 0;

      return {
        stage: {
          id: stage.id,
          name: stage.name,
          order: stage.order,
        },
        entered: data.entered,
        exited: data.exited,
        conversionRate: Math.round(conversionRate * 100) / 100,
        dropoffRate: Math.round((100 - conversionRate) * 100) / 100,
      };
    });

    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
      },
      funnel: funnelData,
      totalDeals: deals.length,
      dateRange,
    };
  }

  async calculateVelocityMetrics(
    pipelineId: string,
    dateRange?: { start: Date; end: Date },
  ) {
    const closedDeals = await this.prisma.deal.findMany({
      where: {
        pipelineId,
        status: { in: ["WON", "LOST"] },
        ...(dateRange && {
          closedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }),
      },
      include: {
        stageTransitions: {
          orderBy: { transitionTime: "asc" },
        },
      },
    });

    // Calculate average time in each stage
    const stageVelocities = new Map<string, number[]>();

    closedDeals.forEach((deal) => {
      deal.stageTransitions.forEach((transition) => {
        if (!stageVelocities.has(transition.fromStageId)) {
          stageVelocities.set(transition.fromStageId, []);
        }
        const velocities = stageVelocities.get(transition.fromStageId);
        if (velocities) {
          velocities.push(transition.timeInStage);
        }
      });
    });

    // Calculate averages
    const velocityData = Array.from(stageVelocities.entries()).map(
      ([stageId, times]) => {
        const avgMinutes = times.reduce((sum, t) => sum + t, 0) / times.length;
        const avgDays = avgMinutes / (60 * 24);

        return {
          stageId,
          avgTimeInStage: {
            minutes: Math.round(avgMinutes),
            hours: Math.round(avgMinutes / 60),
            days: Math.round(avgDays * 10) / 10,
          },
          sampleSize: times.length,
        };
      },
    );

    // Calculate overall cycle time
    const cycleTimes = closedDeals.map((deal) => {
      const start = deal.createdAt.getTime();
      const end = deal.closedAt?.getTime() ?? deal.createdAt.getTime();
      return (end - start) / (1000 * 60 * 60 * 24); // days
    });

    const avgCycleTime =
      cycleTimes.length > 0
        ? cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length
        : 0;

    return {
      pipelineId,
      stageVelocities: velocityData,
      avgCycleTime: Math.round(avgCycleTime * 10) / 10,
      totalDealsAnalyzed: closedDeals.length,
      dateRange,
    };
  }

  async calculateWinRateMetrics(
    pipelineId: string,
    groupBy: "owner" | "source" | "month",
    dateRange?: { start: Date; end: Date },
  ) {
    const deals = await this.prisma.deal.findMany({
      where: {
        pipelineId,
        status: { in: ["WON", "LOST"] },
        ...(dateRange && {
          closedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }),
      },
      include: {
        owner: true,
      },
    });

    const grouped = new Map<
      string,
      { won: number; lost: number; value: Decimal }
    >();

    deals.forEach((deal) => {
      let key: string;

      switch (groupBy) {
        case "owner":
          key = `${deal.owner.firstName} ${deal.owner.lastName}`;
          break;
        case "source":
          // TODO: Add source field to Deal model
          key = "Direct";
          break;
        case "month":
          key = deal.closedAt?.toISOString().substring(0, 7) ?? "unknown"; // YYYY-MM
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, { won: 0, lost: 0, value: new Decimal(0) });
      }

      const data = grouped.get(key) ?? {
        won: 0,
        lost: 0,
        value: new Decimal(0),
      };
      if (deal.status === "WON") {
        data.won++;
        data.value = data.value.add(deal.value);
      } else {
        data.lost++;
      }
    });

    const results = Array.from(grouped.entries()).map(([key, data]) => {
      const total = data.won + data.lost;
      const winRate = total > 0 ? (data.won / total) * 100 : 0;

      return {
        key,
        won: data.won,
        lost: data.lost,
        total,
        winRate: Math.round(winRate * 100) / 100,
        totalValue: data.value.toNumber(),
        avgDealSize: data.won > 0 ? data.value.toNumber() / data.won : 0,
      };
    });

    return {
      pipelineId,
      groupBy,
      results: results.sort((a, b) => b.winRate - a.winRate),
      dateRange,
    };
  }

  async getStageBottlenecks(pipelineId: string) {
    const stages = await this.prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });

    const bottlenecks = await Promise.all(
      stages.map(async (stage) => {
        const [dealCount, avgTimeInStage, stalledDeals] = await Promise.all([
          // Count of deals in stage
          this.prisma.deal.count({
            where: {
              stageId: stage.id,
              status: "OPEN",
            },
          }),
          // Average time in stage for all deals that passed through
          this.prisma.dealStageTransition.aggregate({
            where: { fromStageId: stage.id },
            _avg: { timeInStage: true },
          }),
          // Deals that have been in stage too long
          this.prisma.deal.count({
            where: {
              stageId: stage.id,
              status: "OPEN",
              stageEnteredAt: {
                lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
              },
            },
          }),
        ]);

        const avgMinutes = avgTimeInStage._avg.timeInStage || 0;
        const avgDays = avgMinutes / (60 * 24);

        return {
          stage: {
            id: stage.id,
            name: stage.name,
            order: stage.order,
          },
          currentDeals: dealCount,
          avgTimeInStage: Math.round(avgDays * 10) / 10,
          stalledDeals,
          isBottleneck: dealCount > 10 || stalledDeals > 5,
        };
      }),
    );

    return {
      pipelineId,
      stages: bottlenecks,
      identifiedBottlenecks: bottlenecks.filter((b) => b.isBottleneck),
    };
  }

  // Scheduled job to calculate daily metrics
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async calculateDailyMetrics() {
    try {
      const pipelines = await this.prisma.pipeline.findMany({
        where: { deletedAt: null },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const pipeline of pipelines) {
        await this.calculateAndStorePipelineMetrics(
          pipeline.id,
          "daily",
          yesterday,
        );
      }
    } catch (error) {
      console.error("Error calculating daily metrics:", error);
    }
  }

  private async calculateAndStorePipelineMetrics(
    pipelineId: string,
    period: string,
    date: Date,
  ) {
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get metrics for the period
    const [dealsCreated, dealsWon, dealsLost, totalValue, wonValue, lostValue] =
      await Promise.all([
        this.prisma.deal.count({
          where: {
            pipelineId,
            createdAt: {
              gte: date,
              lte: endDate,
            },
          },
        }),
        this.prisma.deal.count({
          where: {
            pipelineId,
            status: "WON",
            closedAt: {
              gte: date,
              lte: endDate,
            },
          },
        }),
        this.prisma.deal.count({
          where: {
            pipelineId,
            status: "LOST",
            closedAt: {
              gte: date,
              lte: endDate,
            },
          },
        }),
        this.prisma.deal.aggregate({
          where: {
            pipelineId,
            createdAt: {
              gte: date,
              lte: endDate,
            },
          },
          _sum: { value: true },
        }),
        this.prisma.deal.aggregate({
          where: {
            pipelineId,
            status: "WON",
            closedAt: {
              gte: date,
              lte: endDate,
            },
          },
          _sum: { value: true },
        }),
        this.prisma.deal.aggregate({
          where: {
            pipelineId,
            status: "LOST",
            closedAt: {
              gte: date,
              lte: endDate,
            },
          },
          _sum: { value: true },
        }),
      ]);

    const totalClosed = dealsWon + dealsLost;
    const winRate = totalClosed > 0 ? dealsWon / totalClosed : 0;
    const avgDealSize =
      dealsWon > 0
        ? (wonValue._sum.value || new Decimal(0)).toNumber() / dealsWon
        : 0;

    // Calculate average cycle length for won deals
    const wonDeals = await this.prisma.deal.findMany({
      where: {
        pipelineId,
        status: "WON",
        closedAt: {
          gte: date,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        closedAt: true,
      },
    });

    const cycleLengths = wonDeals.map((deal) => {
      const days = Math.floor(
        ((deal.closedAt?.getTime() ?? deal.createdAt.getTime()) -
          deal.createdAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return days;
    });

    const avgCycleLength =
      cycleLengths.length > 0
        ? Math.round(
            cycleLengths.reduce((sum, len) => sum + len, 0) /
              cycleLengths.length,
          )
        : 0;

    // Store metrics
    await this.prisma.pipelineMetrics.upsert({
      where: {
        pipelineId_period_date: {
          pipelineId,
          period,
          date,
        },
      },
      create: {
        pipelineId,
        period,
        date,
        dealsCreated,
        dealsWon,
        dealsLost,
        totalValue: totalValue._sum.value || new Decimal(0),
        wonValue: wonValue._sum.value || new Decimal(0),
        lostValue: lostValue._sum.value || new Decimal(0),
        winRate,
        avgDealSize: new Decimal(avgDealSize),
        avgCycleLength,
        stageMetrics: [], // TODO: Calculate stage-specific metrics
      },
      update: {
        dealsCreated,
        dealsWon,
        dealsLost,
        totalValue: totalValue._sum.value || new Decimal(0),
        wonValue: wonValue._sum.value || new Decimal(0),
        lostValue: lostValue._sum.value || new Decimal(0),
        winRate,
        avgDealSize: new Decimal(avgDealSize),
        avgCycleLength,
        calculatedAt: new Date(),
      },
    });
  }
}
