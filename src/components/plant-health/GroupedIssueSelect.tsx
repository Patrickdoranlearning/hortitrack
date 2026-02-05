'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bug, Leaf, Droplets, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttributeOption } from '@/lib/attributeOptions';
import { PLANT_HEALTH_CATEGORIES, type PlantHealthCategory } from '@/lib/attributeOptions';

type GroupedIssueSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: AttributeOption[];
  placeholder?: string;
  showCustomOption?: boolean;
  disabled?: boolean;
  className?: string;
};

// Category styling configuration
const CATEGORY_STYLES: Record<string, {
  icon: React.ReactNode;
  labelClass: string;
  badgeClass: string;
}> = {
  Disease: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    labelClass: 'text-red-700 dark:text-red-400',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  Pest: {
    icon: <Bug className="h-3.5 w-3.5" />,
    labelClass: 'text-amber-700 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  Cultural: {
    icon: <Droplets className="h-3.5 w-3.5" />,
    labelClass: 'text-blue-700 dark:text-blue-400',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  Nutrition: {
    icon: <Leaf className="h-3.5 w-3.5" />,
    labelClass: 'text-green-700 dark:text-green-400',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  },
};

function getCategoryStyle(category: string | null | undefined) {
  return CATEGORY_STYLES[category ?? ''] ?? {
    icon: null,
    labelClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground',
  };
}

export function GroupedIssueSelect({
  value,
  onChange,
  options,
  placeholder = "Select an issue...",
  showCustomOption = true,
  disabled = false,
  className,
}: GroupedIssueSelectProps) {
  // Group options by category
  const { groupedOptions, uncategorizedOptions } = useMemo(() => {
    const grouped: Record<string, AttributeOption[]> = {};
    const uncategorized: AttributeOption[] = [];

    // Initialize groups in the preferred order
    PLANT_HEALTH_CATEGORIES.forEach(cat => {
      grouped[cat] = [];
    });

    // Sort options into groups
    options.forEach(opt => {
      if (opt.category && grouped[opt.category]) {
        grouped[opt.category].push(opt);
      } else {
        uncategorized.push(opt);
      }
    });

    return { groupedOptions: grouped, uncategorizedOptions: uncategorized };
  }, [options]);

  // Find the selected option to display with its category badge
  const selectedOption = useMemo(() => {
    if (!value || value === 'custom') return null;
    return options.find(opt => opt.displayLabel === value);
  }, [value, options]);

  const selectedStyle = getCategoryStyle(selectedOption?.category);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.category && (
                <Badge
                  variant="outline"
                  className={cn("h-5 px-1.5 text-[10px] font-medium", selectedStyle.badgeClass)}
                >
                  {selectedStyle.icon}
                </Badge>
              )}
              <span>{selectedOption.displayLabel}</span>
            </span>
          ) : value === 'custom' ? (
            'Other (type below)'
          ) : (
            placeholder
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {/* Render each category group */}
        {PLANT_HEALTH_CATEGORIES.map((category, catIndex) => {
          const categoryOptions = groupedOptions[category];
          if (!categoryOptions?.length) return null;

          const style = getCategoryStyle(category);

          return (
            <SelectGroup key={category}>
              {catIndex > 0 && <SelectSeparator className="my-1" />}
              <SelectLabel
                className={cn(
                  "flex items-center gap-2 py-2 px-2 text-xs font-semibold uppercase tracking-wide",
                  style.labelClass
                )}
              >
                {style.icon}
                {category}
                <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                  {categoryOptions.length}
                </Badge>
              </SelectLabel>
              {categoryOptions.map(opt => (
                <SelectItem
                  key={opt.systemCode}
                  value={opt.displayLabel}
                  className="pl-8"
                >
                  <span className="flex items-center gap-2">
                    <span>{opt.displayLabel}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}

        {/* Uncategorized items */}
        {uncategorizedOptions.length > 0 && (
          <SelectGroup>
            <SelectSeparator className="my-1" />
            <SelectLabel className="flex items-center gap-2 py-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Other Issues
              <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                {uncategorizedOptions.length}
              </Badge>
            </SelectLabel>
            {uncategorizedOptions.map(opt => (
              <SelectItem
                key={opt.systemCode}
                value={opt.displayLabel}
                className="pl-8"
              >
                {opt.displayLabel}
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Custom option */}
        {showCustomOption && (
          <>
            <SelectSeparator className="my-1" />
            <SelectItem value="custom" className="text-muted-foreground italic">
              Other (type below)
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

// Export category styles for reuse in settings page
export { CATEGORY_STYLES, getCategoryStyle };
