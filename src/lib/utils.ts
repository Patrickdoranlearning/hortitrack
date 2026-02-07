import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively transforms keys of an object (or array of objects) from snake_case to camelCase.
 * Useful when consuming Supabase/Postgres data (snake_case) in the frontend (camelCase).
 */
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

/**
 * Round a number to two decimal places (safe for currency/financial calculations).
 */
export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
