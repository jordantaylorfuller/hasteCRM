"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_PIPELINES, GET_DEALS } from "@/graphql/queries/pipelines";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Filter, ChartBar } from "lucide-react";

export default function PipelinesPage() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  const { data: pipelinesData, loading: pipelinesLoading } =
    useQuery(GET_PIPELINES);

  const {
    data: dealsData,
    loading: dealsLoading,
    refetch,
  } = useQuery(GET_DEALS, {
    variables: {
      pipelineId: selectedPipelineId || undefined,
      take: 100,
    },
    skip: !selectedPipelineId,
  });

  // Set default pipeline when data loads
  if (pipelinesData?.pipelines && !selectedPipelineId) {
    const defaultPipeline =
      pipelinesData.pipelines.find((p: any) => p.isDefault) ||
      pipelinesData.pipelines[0];
    if (defaultPipeline) {
      setSelectedPipelineId(defaultPipeline.id);
    }
  }

  const selectedPipeline = pipelinesData?.pipelines?.find(
    (p: any) => p.id === selectedPipelineId,
  );

  const filteredDeals =
    dealsData?.deals?.deals?.filter((deal: any) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        deal.title.toLowerCase().includes(query) ||
        deal.company?.name.toLowerCase().includes(query) ||
        deal.contacts.some((c: any) =>
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(query),
        )
      );
    }) || [];

  if (pipelinesLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 min-w-[320px]">
              <Skeleton className="h-32 mb-2" />
              <Skeleton className="h-96" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Sales Pipeline</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <ChartBar className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Deal
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Pipeline Selector */}
          <Select
            value={selectedPipelineId}
            onValueChange={setSelectedPipelineId}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelinesData?.pipelines?.map((pipeline: any) => (
                <SelectItem key={pipeline.id} value={pipeline.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pipeline.color }}
                    />
                    {pipeline.name}
                    <span className="text-muted-foreground ml-1">
                      ({pipeline._count.deals})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* View Mode */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-hidden p-6">
        {selectedPipeline && viewMode === "board" ? (
          <PipelineBoard
            pipeline={selectedPipeline}
            deals={filteredDeals}
            onDealsChange={() => refetch()}
          />
        ) : (
          <div className="text-center text-muted-foreground py-12">
            List view coming soon...
          </div>
        )}
      </div>
    </div>
  );
}
