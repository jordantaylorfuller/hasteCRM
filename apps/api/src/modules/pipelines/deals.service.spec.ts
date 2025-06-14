import { Test, TestingModule } from "@nestjs/testing";
import { DealsService } from "./deals.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { DealStatus } from "../prisma/prisma-client";

describe("DealsService", () => {
  let service: DealsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    deal: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    stage: {
      findUnique: jest.fn(),
    },
    dealStageTransition: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    dealContact: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDeal = {
    id: "deal-1",
    workspaceId: "workspace-1",
    pipelineId: "pipeline-1",
    stageId: "stage-1",
    title: "Test Deal",
    value: 10000,
    currency: "USD",
    probability: 50,
    status: DealStatus.OPEN,
    ownerId: "user-1",
    stageEnteredAt: new Date(),
    daysInStage: 0,
    totalDaysOpen: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService).forEach((mock) => {
      if (typeof mock === "object") {
        Object.values(mock).forEach((fn) => {
          if (typeof fn === "function") {
            (fn as jest.Mock).mockReset();
          }
        });
      } else if (typeof mock === "function") {
        (mock as jest.Mock).mockReset();
      }
    });
  });

  describe("create", () => {
    it("should create a deal", async () => {
      const createData = {
        pipelineId: "pipeline-1",
        stageId: "stage-1",
        title: "New Deal",
        value: 50000,
        ownerId: "user-1",
        contactIds: ["contact-1", "contact-2"],
      };

      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: createData.stageId,
        pipeline: { id: createData.pipelineId },
        probability: 20,
      });

      const createdDeal = {
        ...mockDeal,
        ...createData,
        contacts: [
          { contactId: "contact-1", isPrimary: true },
          { contactId: "contact-2", isPrimary: false },
        ],
      };

      mockPrismaService.deal.create.mockResolvedValue(createdDeal);
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.create("workspace-1", createData);

      expect(result).toEqual(createdDeal);
      expect(mockPrismaService.deal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "workspace-1",
          pipelineId: createData.pipelineId,
          stageId: createData.stageId,
          title: createData.title,
          value: createData.value,
          ownerId: createData.ownerId,
          currency: "USD",
          probability: 20,
          status: DealStatus.OPEN,
          stageEnteredAt: expect.any(Date),
          contacts: {
            create: expect.arrayContaining([
              { contactId: "contact-1", isPrimary: true },
              { contactId: "contact-2", isPrimary: false },
            ]),
          },
        }),
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if stage not found", async () => {
      const createData = {
        pipelineId: "pipeline-1",
        stageId: "invalid-stage",
        title: "New Deal",
        value: 50000,
        ownerId: "user-1",
      };

      mockPrismaService.stage.findUnique.mockResolvedValue(null);

      await expect(service.create("workspace-1", createData)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("moveToStage", () => {
    it("should move deal to new stage", async () => {
      const dealId = "deal-1";
      const newStageId = "stage-2";
      const userId = "user-1";

      const dealWithRelations = {
        ...mockDeal,
        pipeline: { id: "pipeline-1" },
        stage: { id: "stage-1" },
        owner: { id: "user-1", firstName: "John", lastName: "Doe" },
      };

      mockPrismaService.deal.findUnique.mockResolvedValueOnce(
        dealWithRelations,
      );
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: newStageId,
        pipelineId: "pipeline-1",
        probability: 50,
      });
      mockPrismaService.dealStageTransition.create.mockResolvedValue({});
      mockPrismaService.deal.update.mockResolvedValue({
        ...dealWithRelations,
        stageId: newStageId,
        probability: 50,
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.moveToStage(dealId, newStageId, userId);

      expect(result.stageId).toBe(newStageId);
      expect(mockPrismaService.dealStageTransition.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({
            dealId,
            fromStageId: "stage-1",
            toStageId: newStageId,
            transitionedById: userId,
            timeInStage: expect.any(Number),
          }),
        },
      );
    });

    it("should not move if already in target stage", async () => {
      const dealId = "deal-1";
      const currentStageId = "stage-1";
      const userId = "user-1";

      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        stageId: currentStageId,
      });
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: currentStageId,
        pipelineId: "pipeline-1",
      });

      const result = await service.moveToStage(dealId, currentStageId, userId);

      expect(result.stageId).toBe(currentStageId);
      expect(
        mockPrismaService.dealStageTransition.create,
      ).not.toHaveBeenCalled();
      expect(mockPrismaService.deal.update).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update deal and handle status changes", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.WON,
        wonReason: "Great product fit",
      };

      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        status: DealStatus.OPEN,
      });
      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ...updateData,
        closedAt: new Date(),
      });
      mockPrismaService.activity.create.mockResolvedValue({});

      const result = await service.update(dealId, updateData);

      expect(result.status).toBe(DealStatus.WON);
      expect(result.closedAt).toBeTruthy();
      expect(mockPrismaService.activity.create).toHaveBeenCalled();
    });

    it("should require reason when marking as won", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.WON,
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await expect(service.update(dealId, updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should require reason when marking as lost", async () => {
      const dealId = "deal-1";
      const updateData = {
        status: DealStatus.LOST,
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await expect(service.update(dealId, updateData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("bulkMoveToStage", () => {
    it("should move multiple deals to new stage", async () => {
      const dealIds = ["deal-1", "deal-2"];
      const newStageId = "stage-2";
      const userId = "user-1";

      const deals = dealIds.map((id) => ({
        ...mockDeal,
        id,
      }));

      // Mock for each deal - findOne implementation
      deals.forEach((deal) => {
        // findOne uses findUnique
        mockPrismaService.deal.findUnique
          .mockResolvedValueOnce(deal) // for findOne
          .mockResolvedValueOnce({
            ...deal,
            pipeline: { id: "pipeline-1" },
            stage: { id: deal.stageId },
            owner: { id: "user-1", firstName: "John", lastName: "Doe" },
          }); // for moveToStage with includes

        mockPrismaService.stage.findUnique.mockResolvedValueOnce({
          id: newStageId,
          pipelineId: "pipeline-1",
          probability: 50,
        });
        mockPrismaService.dealStageTransition.create.mockResolvedValueOnce({});
        mockPrismaService.deal.update.mockResolvedValueOnce({
          ...deal,
          stageId: newStageId,
        });
        mockPrismaService.activity.create.mockResolvedValueOnce({});
      });

      const result = await service.bulkMoveToStage(dealIds, newStageId, userId);

      expect(result).toHaveLength(2);
      expect(
        mockPrismaService.dealStageTransition.create,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe("getDealHistory", () => {
    it("should return deal stage transitions", async () => {
      const dealId = "deal-1";
      const transitions = [
        {
          id: "transition-1",
          dealId,
          fromStageId: "stage-1",
          toStageId: "stage-2",
          transitionTime: new Date(),
          timeInStage: 1440, // 1 day in minutes
          transitionedBy: { id: "user-1", firstName: "John", lastName: "Doe" },
          fromStage: { id: "stage-1", name: "Lead" },
          toStage: { id: "stage-2", name: "Qualified" },
        },
      ];

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.dealStageTransition.findMany.mockResolvedValue(
        transitions,
      );

      const result = await service.getDealHistory(dealId);

      expect(result).toEqual(transitions);
      expect(
        mockPrismaService.dealStageTransition.findMany,
      ).toHaveBeenCalledWith({
        where: { dealId },
        include: {
          fromStage: true,
          toStage: true,
          transitionedBy: true,
        },
        orderBy: { transitionTime: "desc" },
      });
    });
  });
});
