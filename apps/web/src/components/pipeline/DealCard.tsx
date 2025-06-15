"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import {
  Building2,
  Calendar,
  Mail,
  MessageSquare,
  CheckSquare,
  DollarSign,
} from "lucide-react";

interface DealCardProps {
  deal: {
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
  };
  isDragging?: boolean;
}

export function DealCard({ deal, isDragging }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isStalled = deal.daysInStage > 30;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-4 cursor-move hover:shadow-md transition-shadow">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-sm line-clamp-2">{deal.title}</h4>
            {isStalled && (
              <Badge variant="destructive" className="text-xs">
                Stalled
              </Badge>
            )}
          </div>

          {/* Value and Company */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-lg font-semibold">
              <DollarSign className="h-4 w-4" />
              {formatCurrency(deal.value, deal.currency)}
            </div>
            {deal.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span className="truncate">{deal.company.name}</span>
              </div>
            )}
          </div>

          {/* Contacts */}
          {deal.contacts.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {deal.contacts.length === 1 ? (
                <span>
                  {deal.contacts[0].firstName} {deal.contacts[0].lastName}
                </span>
              ) : (
                <span>{deal.contacts.length} contacts</span>
              )}
            </div>
          )}

          {/* Close Date */}
          {deal.closeDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                Close{" "}
                {formatDistanceToNow(new Date(deal.closeDate), {
                  addSuffix: true,
                })}
              </span>
            </div>
          )}

          {/* Activity Indicators */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {deal._count.emails > 0 && (
              <div className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                <span>{deal._count.emails}</span>
              </div>
            )}
            {deal._count.activities > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>{deal._count.activities}</span>
              </div>
            )}
            {deal._count.tasks > 0 && (
              <div className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                <span>{deal._count.tasks}</span>
              </div>
            )}
          </div>

          {/* Owner */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Avatar className="h-6 w-6">
              {deal.owner.avatarUrl ? (
                <Image
                  src={deal.owner.avatarUrl}
                  alt={deal.owner.firstName}
                  width={24}
                  height={24}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="bg-primary text-primary-foreground text-xs flex items-center justify-center w-full h-full">
                  {deal.owner.firstName[0]}
                  {deal.owner.lastName[0]}
                </div>
              )}
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {deal.owner.firstName} {deal.owner.lastName}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {deal.daysInStage}d
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
