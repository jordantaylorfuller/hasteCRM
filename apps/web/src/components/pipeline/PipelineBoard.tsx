"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable"; // eslint-disable-line no-unused-vars
import { useMutation } from "@apollo/client";
import { StageColumn } from "./StageColumn";
import { DealCard } from "./DealCard";
import { MOVE_DEAL } from "@/graphql/mutations/pipelines";
import { toast } from "@/components/ui/use-toast";

interface Pipeline {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    order: number;
    color: string;
    probability: number;
  }>;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  currency: string;
  probability: number;
  closeDate?: string;
  stageEnteredAt: string;
  daysInStage: number;
  stage: {
    id: string;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  company?: {
    id: string;
    name: string;
    logoUrl?: string;
  };
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  _count: {
    activities: number;
    tasks: number;
    notes: number;
    emails: number;
  };
}

interface PipelineBoardProps {
  pipeline: Pipeline;
  deals?: Deal[];
  onDealsChange?: (_deals: Deal[]) => void;
}

export function PipelineBoard({
  pipeline,
  deals: initialDeals = [],
  onDealsChange,
}: PipelineBoardProps) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [moveDeal] = useMutation(MOVE_DEAL);
  // toast is imported as a named import

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped = new Map<string, Deal[]>();

    pipeline.stages.forEach((stage) => {
      grouped.set(stage.id, []);
    });

    deals.forEach((deal) => {
      const stageDeals = grouped.get(deal.stage.id);
      if (stageDeals) {
        stageDeals.push(deal);
      }
    });

    return grouped;
  }, [deals, pipeline.stages]);

  // Calculate total value by stage
  const valueByStage = useMemo(() => {
    const values = new Map<string, number>();

    dealsByStage.forEach((stageDeals, stageId) => {
      const total = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
      values.set(stageId, total);
    });

    return values;
  }, [dealsByStage]);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) {
      setActiveDeal(deal);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeDeal = deals.find((d) => d.id === active.id);
    if (!activeDeal) return;

    const oldStageId = activeDeal.stage.id;
    const newStageId = over.id as string;

    // Check if moving to a different stage
    if (oldStageId !== newStageId) {
      // Optimistically update UI
      const updatedDeals = deals.map((deal) => {
        if (deal.id === activeDeal.id) {
          return {
            ...deal,
            stage: { id: newStageId },
            stageEnteredAt: new Date().toISOString(),
            daysInStage: 0,
          };
        }
        return deal;
      });

      setDeals(updatedDeals);
      onDealsChange?.(updatedDeals);

      try {
        // Send mutation to server
        await moveDeal({
          variables: {
            input: {
              dealId: activeDeal.id,
              stageId: newStageId,
            },
          },
        });

        toast({
          title: "Deal moved",
          description: `${activeDeal.title} moved to ${pipeline.stages.find((s) => s.id === newStageId)?.name}`,
        });
      } catch (error) {
        // Revert on error
        setDeals(deals);
        onDealsChange?.(deals);

        toast({
          title: "Error",
          description: "Failed to move deal. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const currency = deals[0]?.currency || "USD";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 overflow-x-auto pb-4">
        {pipeline.stages
          .sort((a, b) => a.order - b.order)
          .map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage.get(stage.id) || []}
              totalValue={valueByStage.get(stage.id) || 0}
              currency={currency}
            />
          ))}
      </div>

      <DragOverlay>
        {activeDeal && <DealCard deal={activeDeal} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
