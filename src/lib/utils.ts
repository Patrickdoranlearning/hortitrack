import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function snakeToCamel<T>(obj: T): any {
  if (Array.isArray(obj)) {
    return obj.map(v => snakeToCamel(v));
  }
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      acc[camelKey] = snakeToCamel((obj as any)[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}
