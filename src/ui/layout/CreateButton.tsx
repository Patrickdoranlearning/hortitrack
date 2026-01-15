"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Plus, Sprout, ShoppingCart, Truck, ShieldCheck, Package, FileText, Users, MapPin, Ruler, X } from "lucide-react"
import { cn } from "@/lib/utils"

type CreateAction = {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
}

type CreateCategory = {
  label: string
  icon: React.ComponentType<{ className?: string }>
  actions: CreateAction[]
}

const CREATE_MENU: CreateCategory[] = [
  {
    label: "Production",
    icon: Sprout,
    actions: [
      { label: "New Propagation", href: "/?action=propagation" },
      { label: "Check-in Batch", href: "/?action=checkin" },
      { label: "Plan Incoming", href: "/?action=plan-incoming" },
      { label: "Plan Batches", href: "/?action=plan-batches" },
      { label: "Actualise Batch", href: "/?action=actualise" },
      { label: "Transplant Batch", href: "/production/batches/new/multi-transplant" },
      { label: "Bulk Transplant", href: "/production/batches/new/bulk-transplant" },
      { label: "Saleability Wizard", href: "/production/saleable/wizard" },
    ],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    actions: [
      { label: "New Order", href: "/sales/orders/new" },
      { label: "New Customer", href: "/sales/customers?action=new" },
      { label: "New Product", href: "/sales/products/new" },
      { label: "New Invoice", href: "/sales/invoices?action=new" },
    ],
  },
  {
    label: "Dispatch",
    icon: Truck,
    actions: [
      { label: "Start Picking", href: "/dispatch/picker" },
      { label: "Bulk Picking", href: "/dispatch/bulk-picking" },
      { label: "QC Review", href: "/dispatch/qc" },
    ],
  },
  {
    label: "Plant Health",
    icon: ShieldCheck,
    actions: [
      { label: "New IPM Task", href: "/plant-health/tasks?action=new" },
      { label: "Scout Location", href: "/plant-health/scout" },
      { label: "New IPM Program", href: "/plant-health/programs?action=new" },
    ],
  },
  {
    label: "Materials",
    icon: Package,
    actions: [
      { label: "New Purchase Order", href: "/materials/purchase-orders/new" },
      { label: "Add Material", href: "/materials/catalog?action=new" },
      { label: "Stock Adjustment", href: "/materials/stock?action=adjust" },
    ],
  },
  {
    label: "Data Management",
    icon: FileText,
    actions: [
      { label: "New Variety", href: "/varieties?action=new", icon: Sprout },
      { label: "New Location", href: "/locations?action=new", icon: MapPin },
      { label: "New Size", href: "/sizes?action=new", icon: Ruler },
      { label: "New Supplier", href: "/suppliers?action=new", icon: Users },
    ],
  },
]

// Desktop version with hover dropdown
function DesktopCreateButton() {
  const [isOpen, setIsOpen] = React.useState(false)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const HOVER_DELAY = 150

  const handleMouseEnter = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, HOVER_DELAY)
  }, [])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div
      className="relative hidden md:block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button
        className={cn(
          "gap-2 font-semibold px-6",
          isOpen && "bg-primary/90"
        )}
      >
        <Plus className="h-4 w-4" />
        Create
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-1 z-50">
          <div className="rounded-lg border-0 bg-primary shadow-xl overflow-hidden">
            <div className="flex">
              {CREATE_MENU.map((category, idx) => {
                const CategoryIcon = category.icon
                return (
                  <div
                    key={category.label}
                    className={cn(
                      "p-4 min-w-[160px]",
                      idx !== CREATE_MENU.length - 1 && "border-r border-primary-foreground/20"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-primary-foreground/20">
                      <CategoryIcon className="h-4 w-4 text-primary-foreground shrink-0" />
                      <span className="text-sm font-semibold text-primary-foreground whitespace-nowrap">
                        {category.label}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {category.actions.map((action) => (
                        <Link
                          key={action.href}
                          href={action.href}
                          onClick={() => setIsOpen(false)}
                          className="block px-2 py-1.5 text-sm text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-md transition-colors whitespace-nowrap"
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-primary-foreground/20 bg-primary/80 px-4 py-2 flex justify-end">
              <Link
                href="/settings"
                onClick={() => setIsOpen(false)}
                className="text-xs text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                Settings & Data Management
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mobile version with sheet/drawer
function MobileCreateButton() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null)

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          className="md:hidden"
          size="icon"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" hideCloseButton className="h-[85vh] max-h-[85vh] bg-primary border-0 rounded-t-2xl p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-4 py-3 border-b border-primary-foreground/20 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-primary-foreground text-lg font-semibold">Create New</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 pb-8 min-h-0">
          {CREATE_MENU.map((category) => {
            const CategoryIcon = category.icon
            const isExpanded = expandedCategory === category.label

            return (
              <div key={category.label} className="border-b border-primary-foreground/10">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category.label)}
                  className="w-full flex items-center justify-between px-4 py-4 text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className="h-5 w-5" />
                    <span className="font-medium">{category.label}</span>
                  </div>
                  <Plus className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-45"
                  )} />
                </button>
                {isExpanded && (
                  <div className="bg-primary/80 px-4 pb-2">
                    {category.actions.map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-3 text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10 rounded-md transition-colors"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <div className="px-4 py-4">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Settings & Data Management
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function CreateButton() {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex gap-2">
        <Button className="hidden md:flex gap-2 font-semibold px-6" disabled>
          <Plus className="h-4 w-4" />
          Create
        </Button>
        <Button className="md:hidden" size="icon" disabled>
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <>
      <DesktopCreateButton />
      <MobileCreateButton />
    </>
  )
}
