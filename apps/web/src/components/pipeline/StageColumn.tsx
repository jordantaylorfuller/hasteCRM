"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DealCard } from "./DealCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StageColumnProps {
  stage: {
    id: string;
    name: string;
    color: string;
    probability: number;
  };
  deals: Array<{
    id: string;
    title: string;
    value: number;
    currency: string;
    probability: number;
    closeDate?: string;
    stageEnteredAt: string;
    daysInStage: number;
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
  }>;
  totalValue: number;
  currency: string;
}

export function StageColumn({
  stage,
  deals,
  totalValue,
  currency,
}: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-1 min-w-[320px] max-w-[400px]">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color }}
            />
            <h3 className="font-semibold">{stage.name}</h3>
            <Badge variant="secondary" className="text-xs">
              {deals.length}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {stage.probability}%
          </span>
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {formatCurrency(totalValue)}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "bg-muted/30 rounded-lg p-2 min-h-[calc(100vh-280px)] transition-colors",
          isOver && "bg-muted/50 ring-2 ring-primary/20",
        )}
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No deals in this stage
          </div>
        )}
      </div>
    </div>
  );
}
