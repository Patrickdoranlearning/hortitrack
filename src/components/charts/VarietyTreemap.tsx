'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import { type NameType, type ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { ChartContainer } from '@/components/ui/chart';

interface VarietyTreemapProps {
  data: { family: string; variety: string; varietyId: string; quantity: number }[];
  onFamilyClick?: (family: string) => void;
  onVarietyClick?: (varietyId: string) => void;
  activeFamilies?: string[];
  activeVarieties?: string[];
}

const FAMILY_COLORS = [
  'hsl(142, 76%, 36%)', // Green
  'hsl(221, 83%, 53%)', // Blue
  'hsl(45, 93%, 47%)',  // Amber
  'hsl(262, 83%, 58%)', // Purple
  'hsl(0, 84%, 60%)',   // Red
  'hsl(190, 90%, 50%)', // Cyan
  'hsl(330, 80%, 60%)', // Pink
  'hsl(30, 90%, 55%)',  // Orange
];

const chartConfig = {
  quantity: {
    label: 'Plants',
  },
};

interface TreemapNode {
  name: string;
  size?: number;
  children?: TreemapNode[];
  family?: string;
  varietyId?: string;
  color?: string;
}

export default function VarietyTreemap({
  data,
  onFamilyClick,
  onVarietyClick,
  activeFamilies = [],
  activeVarieties = [],
}: VarietyTreemapProps) {
  // Group by family
  const treemapData = useMemo(() => {
    const familyMap = new Map<string, TreemapNode>();
    const familyColorMap = new Map<string, string>();

    // Assign colors to families
    const families = [...new Set(data.map(d => d.family))];
    families.forEach((family, i) => {
      familyColorMap.set(family, FAMILY_COLORS[i % FAMILY_COLORS.length]);
    });

    for (const item of data) {
      if (!familyMap.has(item.family)) {
        familyMap.set(item.family, {
          name: item.family,
          children: [],
          color: familyColorMap.get(item.family),
        });
      }
      
      const familyNode = familyMap.get(item.family)!;
      familyNode.children!.push({
        name: item.variety,
        size: item.quantity,
        family: item.family,
        varietyId: item.varietyId,
        color: familyColorMap.get(item.family),
      });
    }

    return {
      name: 'Production',
      children: Array.from(familyMap.values()),
    };
  }, [data]);

  interface TreemapContentProps {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    depth: number;
    color?: string;
    family?: string;
    varietyId?: string;
  }

  const CustomContent = (props: TreemapContentProps) => {
    const { x, y, width, height, name, depth, color, family, varietyId } = props;

    if (width < 20 || height < 20 || !name) return null;

    const displayName = String(name);
    const isActive = depth === 1
      ? activeFamilies.length === 0 || activeFamilies.includes(displayName)
      : activeVarieties.length === 0 || activeVarieties.includes(varietyId ?? '');

    const handleClick = () => {
      if (depth === 1 && onFamilyClick) {
        onFamilyClick(displayName);
      } else if (depth === 2 && onVarietyClick && varietyId) {
        onVarietyClick(varietyId);
      }
    };

    return (
      <g onClick={handleClick} style={{ cursor: 'pointer' }}>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color || 'hsl(var(--primary))'}
          opacity={isActive ? (depth === 1 ? 0.8 : 1) : 0.2}
          stroke="hsl(var(--background))"
          strokeWidth={depth === 1 ? 2 : 1}
          rx={4}
        />
        {width > 50 && height > 25 && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-white text-xs font-medium"
            style={{
              fontSize: Math.min(12, width / 8),
              pointerEvents: 'none',
            }}
          >
            {displayName.length > 15 ? `${displayName.slice(0, 12)}...` : displayName}
          </text>
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
    if (!active || !payload?.length) return null;

    const tooltipData = payload[0].payload as TreemapNode;

    return (
      <div className="bg-popover border rounded-md shadow-md px-3 py-2 text-sm">
        <div className="font-medium">{tooltipData.name}</div>
        {tooltipData.family && tooltipData.family !== tooltipData.name && (
          <div className="text-muted-foreground text-xs">{tooltipData.family}</div>
        )}
        {tooltipData.size && (
          <div className="text-muted-foreground">
            {tooltipData.size.toLocaleString()} plants
          </div>
        )}
      </div>
    );
  };

  return (
    <ChartContainer config={chartConfig} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treemapData.children}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="hsl(var(--background))"
          content={<CustomContent />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

