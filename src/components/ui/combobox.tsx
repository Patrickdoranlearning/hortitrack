
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
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

  React.useEffect(() => {
    const selectedOption = options.find(option => option.value.toLowerCase() === value?.toLowerCase());
    setInputValue(selectedOption?.label || value || "");
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value?.toLowerCase() ? "" : currentValue;
    onChange(newValue);
    const selectedOption = options.find(option => option.value.toLowerCase() === newValue.toLowerCase());
    setInputValue(selectedOption ? selectedOption.label : "");
    setOpen(false);
  }
  
  const handleInputChange = (search: string) => {
      setInputValue(search);
      if (!open) {
          setOpen(true);
      }
  }
  
  const handleInputClick = () => {
    if (!open) {
      setOpen(true);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
             <Command shouldFilter={false} className="overflow-visible">
                <CommandInput 
                    asChild
                    value={inputValue}
                    onValueChange={handleInputChange}
                    onBlur={() => {
                        const existingOption = options.find(option => option.label.toLowerCase() === inputValue.toLowerCase());
                        if (!existingOption && value) {
                             const originalOption = options.find(option => option.value.toLowerCase() === value.toLowerCase());
                             setInputValue(originalOption?.label || "");
                        }
                    }}
                >
                    <Input 
                        placeholder={placeholder}
                        className="w-full"
                        onClick={handleInputClick}
                    />
                </CommandInput>

                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
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
        </div>
    </Popover>
  )
}
