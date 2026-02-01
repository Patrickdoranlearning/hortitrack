"use client";

import * as React from "react";
import { useState } from "react";
import { Package, Heart, Search, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrateTap } from "@/lib/haptics";
import { StockLedgerView } from "./StockLedgerView";
import { BatchHealthView } from "./BatchHealthView";
import { BatchScoutHistory } from "./BatchScoutHistory";

type TabKey = "summary" | "stock" | "health" | "scout";

interface BatchDetailTabsProps {
  batchId: string;
  initialTab?: TabKey;
  children: React.ReactNode; // Summary content passed as children
}

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tabs: TabConfig[] = [
  { key: "summary", label: "Summary", icon: History },
  { key: "stock", label: "Stock", icon: Package },
  { key: "health", label: "Health", icon: Heart },
  { key: "scout", label: "Scout", icon: Search },
];

/**
 * Mobile-optimized tabs for batch detail view.
 * Uses horizontal scrollable tabs with touch-friendly targets.
 */
export function BatchDetailTabs({
  batchId,
  initialTab = "summary",
  children,
}: BatchDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const handleTabChange = (key: TabKey) => {
    vibrateTap();
    setActiveTab(key);
  };

  return (
    <div className="flex flex-col">
      {/* Tab bar - horizontal scrollable */}
      <div className="sticky top-14 z-30 bg-background border-b">
        <div className="flex overflow-x-auto scrollbar-hide -mx-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap",
                  "border-b-2 transition-colors min-h-[48px]",
                  "flex-shrink-0",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                aria-selected={isActive}
                role="tab"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1">
        {activeTab === "summary" && (
          <div className="animate-in fade-in duration-200">{children}</div>
        )}

        {activeTab === "stock" && (
          <div className="p-4 animate-in fade-in duration-200">
            <StockLedgerView batchId={batchId} />
          </div>
        )}

        {activeTab === "health" && (
          <div className="p-4 animate-in fade-in duration-200">
            <BatchHealthView batchId={batchId} />
          </div>
        )}

        {activeTab === "scout" && (
          <div className="p-4 animate-in fade-in duration-200">
            <BatchScoutHistory batchId={batchId} />
          </div>
        )}
      </div>
    </div>
  );
}

export default BatchDetailTabs;
