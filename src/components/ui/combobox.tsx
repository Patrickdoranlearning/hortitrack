"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
  allowCustomValue?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyMessage,
  allowCustomValue = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "")

  React.useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue.toLowerCase() === value?.toLowerCase() ? "" : currentValue;
    onChange(newValue);
    setOpen(false);
  }

  const handleCreate = () => {
    if (inputValue) {
      onChange(inputValue)
      setOpen(false)
    }
  }

  const currentSelection = options.find(
    (option) => option.value.toLowerCase() === value?.toLowerCase()
  )

  const filteredOptions = inputValue 
    ? options.filter(option => 
        option.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : options;

  const showCreateOption = allowCustomValue && inputValue && !options.some(opt => opt.label.toLowerCase() === inputValue.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {currentSelection ? currentSelection.label : placeholder || "Select option..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput 
            placeholder={placeholder || "Search..."} 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {showCreateOption ? (
                <CommandItem
                    onSelect={handleCreate}
                    className="text-primary cursor-pointer"
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create and use "{inputValue}"
                </CommandItem>
              ) : (
                emptyMessage || "No options found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value?.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
             {showCreateOption && <div className="p-1 border-t mt-1">
                <CommandItem
                    onSelect={handleCreate}
                    className="text-primary cursor-pointer"
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create and use "{inputValue}"
                </CommandItem>
             </div>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
