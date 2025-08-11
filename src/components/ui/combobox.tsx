
"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "./input"

export interface ComboboxOption {
    value: string;
    label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function Combobox({ options, value, onChange, placeholder, emptyMessage }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "")
  const [suggestion, setSuggestion] = React.useState("");

  React.useEffect(() => {
    const selectedOption = options.find(option => option.value.toLowerCase() === value?.toLowerCase());
    setInputValue(selectedOption?.label || value || "");
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue.toLowerCase() === value?.toLowerCase() ? "" : currentValue;
    onChange(newValue);
    const selectedOption = options.find(option => option.value.toLowerCase() === newValue.toLowerCase());
    setInputValue(selectedOption ? selectedOption.label : "");
    setSuggestion("");
    setOpen(false);
  }
  
  const handleInputChange = (search: string) => {
      setInputValue(search);
      const match = options.find(option => option.label.toLowerCase().startsWith(search.toLowerCase()) && option.label.length > search.length);
      if (search.length > 0 && match) {
        setSuggestion(match.label);
      } else {
        setSuggestion("");
      }

      if (!open) {
          setOpen(true);
      }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "Enter" || e.key === "ArrowRight") && suggestion) {
        const match = options.find(option => option.label === suggestion);
        if (match) {
            e.preventDefault();
            handleSelect(match.value);
        }
    }
  };
  
  const handleInputClick = () => {
    if (!open) {
      setOpen(true);
    }
  }
  
  const handleBlur = () => {
    const existingOption = options.find(option => option.label.toLowerCase() === inputValue.toLowerCase());
    if (existingOption) {
      onChange(existingOption.value)
    } else if (value) {
      const originalOption = options.find(option => option.value.toLowerCase() === value.toLowerCase());
      setInputValue(originalOption?.label || "");
    }
    setSuggestion("");
  }


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <PopoverTrigger asChild>
          <div className="relative">
             <CommandInput asChild>
                <div className="relative">
                    <Input 
                        placeholder={placeholder}
                        className="w-full bg-transparent relative z-10"
                        onClick={handleInputClick}
                        value={inputValue}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                    />
                    {suggestion && inputValue && suggestion.toLowerCase().startsWith(inputValue.toLowerCase()) && (
                    <div className="absolute inset-y-0 left-0 flex items-center -z-10">
                        <Input 
                            value={`${inputValue}${suggestion.substring(inputValue.length)}`} 
                            className="text-muted-foreground border-none p-2" 
                            style={{paddingLeft: '12px'}}
                            readOnly 
                        />
                    </div>
                    )}
                </div>
            </CommandInput>
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[var(--radix-popover-trigger-width)] p-0" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <CommandList>
            <CommandEmpty>{emptyMessage || "No options found."}</CommandEmpty>
            <CommandGroup>
              {options.filter(option => option.label.toLowerCase().includes(inputValue.toLowerCase())).map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value && value.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  )
}
