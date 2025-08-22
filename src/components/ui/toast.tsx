"use client";

import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";

export const ToastProvider = ToastPrimitives.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Viewport
      ref={ref}
      className={[
        "fixed top-0 right-0 z-[100] m-0 flex max-h-screen w-full flex-col-reverse p-4",
        "sm:bottom-0 sm:top-auto sm:flex-col",
        "sm:max-w-[420px]",
        className || "",
      ].join(" ")}
      {...props}
    />
  );
});

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & { variant?: "default" | "destructive" }
>(function Toast({ className, variant = "default", ...props }, ref) {
  const base =
    "group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md border bg-white p-4 pr-6 shadow-lg transition-all";
  const destructive =
    "border-red-600 bg-red-50 text-red-900";
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={[base, variant === "destructive" ? destructive : "", className || ""].join(" ")}
      {...props}
    />
  );
});

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return <ToastPrimitives.Title ref={ref} className={["font-medium", className || ""].join(" ")} {...props} />;
});

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return <ToastPrimitives.Description ref={ref} className={["text-sm opacity-90", className || ""].join(" ")} {...props} />;
});

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(function ToastClose({ className, ...props }, ref) {
  return (
    <ToastPrimitives.Close
      ref={ref}
      className={["absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center", className || ""].join(" ")}
      {...props}
    >
      ×
    </ToastPrimitives.Close>
  );
});

export const ToastAction = ToastPrimitives.Action;