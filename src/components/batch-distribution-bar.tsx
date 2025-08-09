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
      inStock: number;
      transplanted: number;
      lost: number;
    };
    initialQuantity: number;
}
  
export function BatchDistributionBar({ distribution, initialQuantity }: BatchDistributionBarProps) {
    if (initialQuantity === 0) return null;
  
    const inStockPercent = (distribution.inStock / initialQuantity) * 100;
    const transplantedPercent = (distribution.transplanted / initialQuantity) * 100;
    const lostPercent = (distribution.lost / initialQuantity) * 100;

    const sections = [
        { name: 'In Stock', value: distribution.inStock, percent: inStockPercent, color: 'bg-chart-1' },
        { name: 'Transplanted', value: distribution.transplanted, percent: transplantedPercent, color: 'bg-chart-2' },
        { name: 'Lost', value: distribution.lost, percent: lostPercent, color: 'bg-chart-5' },
    ];
  
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="w-full">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="bg-chart-1 transition-all"
                style={{ width: `${inStockPercent}%` }}
              />
              <div
                className="bg-chart-2 transition-all"
                style={{ width: `${transplantedPercent}%` }}
              />
              <div
                className="bg-chart-5 transition-all"
                style={{ width: `${lostPercent}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="p-2 space-y-2">
                <p className="font-bold text-center">Distribution of {initialQuantity} units</p>
                <ul className="space-y-1">
                    {sections.map(section => (
                        <li key={section.name} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className={cn("h-3 w-3 rounded-sm", section.color)} />
                                <span>{section.name}:</span>
                            </div>
                            <span className="font-mono font-semibold">{section.value}</span>
                        </li>
                    ))}
                </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
}
