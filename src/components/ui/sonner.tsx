"use client"

import { Toaster as Sonner } from "sonner"
import { AlertCircle, CheckCircle2, Info, AlertTriangle, ChevronDown } from "lucide-react"
import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Expandable error component for showing technical details on demand
 */
export function ExpandableError({
  message,
  details,
}: {
  message: string
  details?: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (!details) {
    return <span>{message}</span>
  }

  return (
    <div className="flex flex-col gap-1">
      <span>{message}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded(!expanded)
        }}
        className="text-xs opacity-70 hover:opacity-100 flex items-center gap-1 mt-1 transition-opacity"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
        {expanded ? "Hide details" : "Show details"}
      </button>
      {expanded && (
        <pre className="text-xs bg-black/5 dark:bg-white/5 p-2 rounded mt-1 overflow-x-auto max-w-full font-mono whitespace-pre-wrap break-all">
          {details}
        </pre>
      )}
    </div>
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: cn(
            "group toast",
            "group-[.toaster]:bg-background",
            "group-[.toaster]:text-foreground",
            "group-[.toaster]:border-border",
            "group-[.toaster]:shadow-lg",
            "group-[.toaster]:rounded-xl",
            "group-[.toaster]:px-4 group-[.toaster]:py-3"
          ),
          title: "font-medium text-sm",
          description: "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
          error: cn(
            "group-[.toaster]:border-red-200 dark:group-[.toaster]:border-red-800",
            "group-[.toaster]:bg-red-50 dark:group-[.toaster]:bg-red-950",
            "group-[.toaster]:text-red-900 dark:group-[.toaster]:text-red-100"
          ),
          success: cn(
            "group-[.toaster]:border-green-200 dark:group-[.toaster]:border-green-800",
            "group-[.toaster]:bg-green-50 dark:group-[.toaster]:bg-green-950",
            "group-[.toaster]:text-green-900 dark:group-[.toaster]:text-green-100"
          ),
          warning: cn(
            "group-[.toaster]:border-amber-200 dark:group-[.toaster]:border-amber-800",
            "group-[.toaster]:bg-amber-50 dark:group-[.toaster]:bg-amber-950",
            "group-[.toaster]:text-amber-900 dark:group-[.toaster]:text-amber-100"
          ),
          info: cn(
            "group-[.toaster]:border-blue-200 dark:group-[.toaster]:border-blue-800",
            "group-[.toaster]:bg-blue-50 dark:group-[.toaster]:bg-blue-950",
            "group-[.toaster]:text-blue-900 dark:group-[.toaster]:text-blue-100"
          ),
        },
      }}
      icons={{
        error: <AlertCircle className="h-5 w-5" />,
        success: <CheckCircle2 className="h-5 w-5" />,
        warning: <AlertTriangle className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
