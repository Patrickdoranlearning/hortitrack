'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ViewMode = 'table' | 'card';

interface ViewToggleProps {
  value?: ViewMode;
  onChange?: (value: ViewMode) => void;
  storageKey?: string;
  className?: string;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

export function ViewToggle({
  value,
  onChange,
  storageKey,
  className,
}: ViewToggleProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [internalValue, setInternalValue] = useState<ViewMode>('table');
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'table' || stored === 'card') {
        setInternalValue(stored);
      } else if (isMobile) {
        setInternalValue('card');
      }
    } else if (isMobile) {
      setInternalValue('card');
    }
  }, [storageKey, isMobile]);

  const currentValue = value ?? internalValue;

  const handleChange = (newValue: ViewMode) => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newValue);
    }
    setInternalValue(newValue);
    onChange?.(newValue);
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className={cn('flex gap-1', className)}>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-1', className)}>
      <Button
        variant={currentValue === 'table' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => handleChange('table')}
        title="Table view"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={currentValue === 'card' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => handleChange('card')}
        title="Card view"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Hook for using view toggle state with localStorage persistence
export function useViewToggle(storageKey: string, defaultValue: ViewMode = 'table') {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [value, setValue] = useState<ViewMode>(defaultValue);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'table' || stored === 'card') {
        setValue(stored);
      } else if (isMobile) {
        setValue('card');
      }
    }
  }, [storageKey, isMobile]);

  const setViewValue = (newValue: ViewMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, newValue);
    }
    setValue(newValue);
  };

  return {
    value: mounted ? value : defaultValue,
    setValue: setViewValue,
    isMobile,
    mounted,
  };
}
