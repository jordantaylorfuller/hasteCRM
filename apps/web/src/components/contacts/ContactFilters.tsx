import { useState } from "react";
import {
  ContactFiltersInput,
  ContactStatus,
  ContactSource,
} from "@/types/contact";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContactFiltersProps {
  filters: ContactFiltersInput;
  onChange: (_newFilters: ContactFiltersInput) => void;
}

export function ContactFilters({ filters, onChange }: ContactFiltersProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const activeFiltersCount = Object.values(filters).filter(
    (value) => value !== undefined && value !== "",
  ).length;

  const handleApply = () => {
    onChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalFilters({});
    onChange({});
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Filters</h4>
            <p className="text-sm text-muted-foreground">
              Filter contacts by various criteria
            </p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={localFilters.status || "all"}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    status:
                      value === "all" ? undefined : (value as ContactStatus),
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value={ContactStatus.ACTIVE}>Active</SelectItem>
                  <SelectItem value={ContactStatus.INACTIVE}>
                    Inactive
                  </SelectItem>
                  <SelectItem value={ContactStatus.ARCHIVED}>
                    Archived
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={localFilters.source || "all"}
                onValueChange={(value) =>
                  setLocalFilters({
                    ...localFilters,
                    source:
                      value === "all" ? undefined : (value as ContactSource),
                  })
                }
              >
                <SelectTrigger id="source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value={ContactSource.MANUAL}>Manual</SelectItem>
                  <SelectItem value={ContactSource.IMPORT}>Import</SelectItem>
                  <SelectItem value={ContactSource.API}>API</SelectItem>
                  <SelectItem value={ContactSource.GMAIL}>Gmail</SelectItem>
                  <SelectItem value={ContactSource.WEBHOOK}>Webhook</SelectItem>
                  <SelectItem value={ContactSource.ENRICHMENT}>
                    Enrichment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="flex-1"
              >
                Reset
              </Button>
              <Button size="sm" onClick={handleApply} className="flex-1">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
