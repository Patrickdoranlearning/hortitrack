
"use client";

/**
 * Wrapper around shadcn/ui Select that guarantees:
 * - Items never have empty value ("")
 * - Clearing sets value to undefined (not "")
 */

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Option } from "@/lib/options";

type Props = {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function SafeSelect({ value, onChange, options, placeholder = "Select…", className, disabled }: Props) {
  // Radix Select uses "" as a signal for "cleared" internally; we map that to undefined.
  const handleChange = (v: string) => {
    onChange(v === "" ? undefined : v);
  };

  // Only render items with non-empty values
  const safeOptions = React.useMemo(
    () => options.filter((o) => !!o.value && o.value.trim().length > 0),
    [options]
  );

  return (
    <Select value={value ?? ""} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {safeOptions.map((o) => (
          <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
