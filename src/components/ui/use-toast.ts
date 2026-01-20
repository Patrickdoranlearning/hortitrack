"use client";

import * as React from "react";
import { create } from "zustand";
import { toast as newToast } from "@/lib/toast";

export type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
};

type ToastState = {
  toasts: ToastItem[];
  add: (t: Omit<ToastItem, "id">) => string;
  dismiss: (id?: string) => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  add: (t) => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, ...t }] });
    return id;
  },
  dismiss: (id) => {
    if (!id) return set({ toasts: [] });
    set({ toasts: get().toasts.filter((x) => x.id !== id) });
  },
}));

/**
 * @deprecated Use `import { toast } from "@/lib/toast"` instead.
 * This hook is kept for backwards compatibility.
 */
export function useToast() {
  const store = useToastStore();
  return React.useMemo(
    () => ({
      ...store,
      toast: store.add,
    }),
    [store]
  );
}

/**
 * @deprecated Use `import { toast } from "@/lib/toast"` instead.
 * This function forwards to the new toast system for backwards compatibility.
 */
export function toast(t: Omit<ToastItem, "id">) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      '[Deprecation] toast() from use-toast.ts is deprecated. Use `import { toast } from "@/lib/toast"` instead.'
    );
  }

  // Forward to new toast system
  if (t.variant === "destructive") {
    newToast.error(t.description || t.title || "Error");
  } else {
    newToast.success(t.title || "Success", {
      description: t.description,
    });
  }

  // Also add to legacy store for components still using Toaster from toaster.tsx
  return useToastStore.getState().add(t);
}
