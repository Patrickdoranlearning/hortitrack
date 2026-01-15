'use client';

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
  
interface BatchDistributionBarProps {
    distribution: {
      available: number;        // Green
      allocatedPotting: number; // Gold - reserved for production plans
      allocatedSales: number;   // Gold - reserved for sales orders
      sold: number;             // Blue
      dumped: number;           // Red
      transplanted: number;     // Grey
    };
    initialQuantity: number;
}
  
export function BatchDistributionBar({ distribution, initialQuantity }: BatchDistributionBarProps) {
    if (initialQuantity === 0) return null;

    // Combine both allocation types into a single "Allocated" segment
    const allocatedTotal = (distribution.allocatedPotting ?? 0) + (distribution.allocatedSales ?? 0);

    const availablePercent = (distribution.available / initialQuantity) * 100;
    const allocatedPercent = (allocatedTotal / initialQuantity) * 100;
    const soldPercent = (distribution.sold / initialQuantity) * 100;
    const dumpedPercent = (distribution.dumped / initialQuantity) * 100;
    const transplantedPercent = (distribution.transplanted / initialQuantity) * 100;

    const sections = [
        { name: 'Available', value: distribution.available, percent: availablePercent, color: 'bg-green-600' },
        { name: 'Allocated', value: allocatedTotal, percent: allocatedPercent, color: 'bg-amber-400' },
        { name: 'Sold', value: distribution.sold, percent: soldPercent, color: 'bg-blue-600' },
        { name: 'Dumped', value: distribution.dumped, percent: dumpedPercent, color: 'bg-red-600' },
        { name: 'Transplanted', value: distribution.transplanted, percent: transplantedPercent, color: 'bg-slate-400' },
    ].filter(s => s.value > 0);
  
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="w-full">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="bg-green-600 transition-all"
                style={{ width: `${availablePercent}%` }}
                title="Available"
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${allocatedPercent}%` }}
                title="Allocated"
              />
              <div
                className="bg-blue-600 transition-all"
                style={{ width: `${soldPercent}%` }}
                title="Sold"
              />
              <div
                className="bg-red-600 transition-all"
                style={{ width: `${dumpedPercent}%` }}
                title="Dumped"
              />
              <div
                className="bg-slate-400 transition-all"
                style={{ width: `${transplantedPercent}%` }}
                title="Transplanted"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="p-2 space-y-2">
                <p className="font-bold text-center">Distribution of {initialQuantity} units</p>
                <ul className="space-y-1">
                    {sections.map((section, i) => (
                        <li key={`sec-${i}`} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className={cn("h-3 w-3 rounded-sm", section.color)} />
                                <span>{section.name}:</span>
                            </div>
                            <span className="font-mono font-semibold">{section.value.toLocaleString()}</span>
                        </li>
                    ))}
                </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
}
