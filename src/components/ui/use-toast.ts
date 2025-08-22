"use client";

import * as React from "react";
import { create } from "zustand";

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

export function useToast() {
  return useToastStore();
}

export function toast(t: Omit<ToastItem, "id">) {
  return useToastStore.getState().add(t);
}