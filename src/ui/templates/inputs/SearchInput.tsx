'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Search, ScanBarcode, X } from 'lucide-react'

/**
 * SearchInput Template
 *
 * A search input with optional barcode scanner support.
 * Use this for search bars, filter inputs, or scanning interfaces.
 *
 * @example
 * ```tsx
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search products..."
 *   showScanner
 *   onScan={(code) => handleBarcodeScan(code)}
 * />
 * ```
 */

type SearchInputProps = {
  /** Current search value */
  value: string
  /** Called when value changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Show scanner button */
  showScanner?: boolean
  /** Called when barcode is scanned */
  onScan?: (code: string) => void
  /** Show clear button when value is present */
  showClear?: boolean
  /** Additional CSS classes */
  className?: string
  /** Disable the input */
  disabled?: boolean
  /** Auto-focus on mount */
  autoFocus?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  showScanner = false,
  onScan,
  showClear = true,
  className,
  disabled = false,
  autoFocus = false,
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isScanning, setIsScanning] = React.useState(false)

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  const handleScannerClick = () => {
    // Toggle scanning mode - actual scanner implementation
    // would depend on the barcode scanning library being used
    setIsScanning(!isScanning)

    // If onScan is provided and we're starting a scan,
    // this is where you'd initialize the scanner
    if (!isScanning && onScan) {
      // Placeholder for scanner initialization
      // In a real implementation, this would open a camera view
      // or connect to a hardware scanner
    }
  }

  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="pl-9 pr-9"
        />
        {showClear && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={handleClear}
            disabled={disabled}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>

      {showScanner && (
        <Button
          type="button"
          variant={isScanning ? 'default' : 'outline'}
          size="icon"
          onClick={handleScannerClick}
          disabled={disabled}
          title="Scan barcode"
        >
          <ScanBarcode className="h-4 w-4" />
          <span className="sr-only">Scan barcode</span>
        </Button>
      )}
    </div>
  )
}
