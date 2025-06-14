"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  User,
  Tag,
  Paperclip,
  Star,
  Mail,
  Archive,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface EmailFilter {
  search?: string;
  folder?: string;
  labels?: string[];
  hasAttachment?: boolean;
  isStarred?: boolean;
  isUnread?: boolean;
  dateRange?: DateRange;
  from?: string;
  to?: string;
}

interface EmailFiltersProps {
  filters: EmailFilter;
  onFiltersChange: (filters: EmailFilter) => void;
  availableLabels?: string[];
  emailCounts?: {
    total: number;
    unread: number;
    starred: number;
    withAttachments: number;
  };
}

export function EmailFilters({
  filters,
  onFiltersChange,
  availableLabels = [],
  emailCounts,
}: EmailFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);

  const updateFilter = (key: keyof EmailFilter, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilter = (key: keyof EmailFilter) => {
    const { [key]: _, ...rest } = filters;
    onFiltersChange(rest);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== "folder" && filters[key as keyof EmailFilter]
  );

  const folders = [
    { id: "inbox", label: "Inbox", icon: Mail },
    { id: "starred", label: "Starred", icon: Star },
    { id: "archived", label: "Archived", icon: Archive },
    { id: "trash", label: "Trash", icon: Trash2 },
  ];

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            placeholder="Search emails..."
            className="pl-10"
          />
        </div>
        <Button
          variant={showAdvanced ? "secondary" : "outline"}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 rounded-full">
              {Object.keys(filters).filter((k) => k !== "folder").length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Folder Navigation */}
      <div className="flex items-center space-x-2">
        {folders.map((folder) => {
          const Icon = folder.icon;
          return (
            <Button
              key={folder.id}
              variant={filters.folder === folder.id ? "default" : "ghost"}
              size="sm"
              onClick={() => updateFilter("folder", folder.id)}
              className="justify-start"
            >
              <Icon className="h-4 w-4 mr-2" />
              {folder.label}
              {emailCounts && folder.id === "inbox" && emailCounts.unread > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {emailCounts.unread}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Advanced Filters</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Email State Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email State</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filters.isUnread ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilter("isUnread", !filters.isUnread)}
                >
                  Unread
                </Button>
                <Button
                  variant={filters.isStarred ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilter("isStarred", !filters.isStarred)}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Starred
                </Button>
                <Button
                  variant={filters.hasAttachment ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updateFilter("hasAttachment", !filters.hasAttachment)
                  }
                >
                  <Paperclip className="h-3 w-3 mr-1" />
                  Has Attachments
                </Button>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.dateRange && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.dateRange?.from ? (
                      filters.dateRange.to ? (
                        <>
                          {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                          {format(filters.dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(filters.dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={filters.dateRange?.from}
                    selected={filters.dateRange}
                    onSelect={(range) => {
                      updateFilter("dateRange", range);
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* From Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Input
                value={filters.from || ""}
                onChange={(e) => updateFilter("from", e.target.value)}
                placeholder="sender@example.com"
                type="email"
              />
            </div>

            {/* To Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Input
                value={filters.to || ""}
                onChange={(e) => updateFilter("to", e.target.value)}
                placeholder="recipient@example.com"
                type="email"
              />
            </div>

            {/* Labels */}
            {availableLabels.length > 0 && (
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Labels</label>
                <div className="flex flex-wrap gap-2">
                  {availableLabels.map((label) => {
                    const isSelected = filters.labels?.includes(label);
                    return (
                      <Badge
                        key={label}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          const currentLabels = filters.labels || [];
                          if (isSelected) {
                            updateFilter(
                              "labels",
                              currentLabels.filter((l) => l !== label)
                            );
                          } else {
                            updateFilter("labels", [...currentLabels, label]);
                          }
                        }}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary">
              Search: {filters.search}
              <button
                onClick={() => clearFilter("search")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.isUnread && (
            <Badge variant="secondary">
              Unread
              <button
                onClick={() => clearFilter("isUnread")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.isStarred && (
            <Badge variant="secondary">
              Starred
              <button
                onClick={() => clearFilter("isStarred")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.hasAttachment && (
            <Badge variant="secondary">
              Has Attachments
              <button
                onClick={() => clearFilter("hasAttachment")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.from && (
            <Badge variant="secondary">
              From: {filters.from}
              <button
                onClick={() => clearFilter("from")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.to && (
            <Badge variant="secondary">
              To: {filters.to}
              <button
                onClick={() => clearFilter("to")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.dateRange && (
            <Badge variant="secondary">
              Date: {format(filters.dateRange.from!, "MMM d")}
              {filters.dateRange.to && ` - ${format(filters.dateRange.to, "MMM d")}`}
              <button
                onClick={() => clearFilter("dateRange")}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.labels?.map((label) => (
            <Badge key={label} variant="secondary">
              Label: {label}
              <button
                onClick={() => {
                  updateFilter(
                    "labels",
                    filters.labels?.filter((l) => l !== label) || []
                  );
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}