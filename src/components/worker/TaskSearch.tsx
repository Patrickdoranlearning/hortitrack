"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Play,
  ArrowRight,
  ScanLine,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WorkerTask } from "@/lib/types/worker-tasks";
import {
  getStatusLabel,
  getStatusBadgeVariant,
  getModuleLabel,
} from "@/lib/types/worker-tasks";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

interface TaskSearchProps {
  onScanInstead: () => void;
}

/**
 * Manual task search component with debounced search
 */
export function TaskSearch({ onScanInstead }: TaskSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<WorkerTask[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [startingTaskId, setStartingTaskId] = React.useState<string | null>(
    null
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search when debounced query changes
  React.useEffect(() => {
    const searchTasks = async () => {
      if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `/api/worker/search-tasks?q=${encodeURIComponent(debouncedQuery)}`
        );

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        setResults(data.tasks ?? []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    };

    searchTasks();
  }, [debouncedQuery]);

  const handleStartTask = async (task: WorkerTask) => {
    try {
      setStartingTaskId(task.id);

      // If already in progress, just navigate
      if (task.status === "in_progress") {
        router.push(`/worker/task/${task.id}`);
        return;
      }

      // Start the task
      const response = await fetch(`/api/tasks/${task.id}/start`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start task");
      }

      // Navigate to task detail
      router.push(`/worker/task/${task.id}`);
    } catch {
      router.push(`/worker/task/${task.id}`);
    } finally {
      setStartingTaskId(null);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search batch number or task..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10 h-12 text-base"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Scan instead button */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-center text-muted-foreground"
          onClick={onScanInstead}
        >
          <ScanLine className="mr-2 h-4 w-4" />
          Scan barcode instead
        </Button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No tasks found for &ldquo;{query}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term or scan a barcode
            </p>
          </div>
        )}

        {!loading && !searched && !query && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Enter a batch number or task title to search
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              Found {results.length} task{results.length !== 1 ? "s" : ""}
            </p>
            {results.map((task) => (
              <SearchResultCard
                key={task.id}
                task={task}
                onStart={() => handleStartTask(task)}
                isStarting={startingTaskId === task.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Task card for search results
 */
function SearchResultCard({
  task,
  onStart,
  isStarting,
}: {
  task: WorkerTask;
  onStart: () => void;
  isStarting: boolean;
}) {
  const isInProgress = task.status === "in_progress";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all active:scale-[0.98]",
        isInProgress && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onStart}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {getModuleLabel(task.sourceModule)}
              </Badge>
              <Badge
                variant={getStatusBadgeVariant(task.status)}
                className="text-xs flex-shrink-0"
              >
                {getStatusLabel(task.status)}
              </Badge>
            </div>
            <h4 className="font-medium line-clamp-2">{task.title}</h4>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {task.description}
              </p>
            )}
            {task.scheduledDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Scheduled:{" "}
                {new Date(task.scheduledDate).toLocaleDateString()}
              </p>
            )}
          </div>

          <Button
            size="icon"
            className="h-12 w-12 flex-shrink-0"
            disabled={isStarting}
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
          >
            {isStarting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isInProgress ? (
              <ArrowRight className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
