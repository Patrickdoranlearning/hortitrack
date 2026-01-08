"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import Link from "next/link";

type CreateAction = {
  label: string;
  href: string;
};

type CreateCategory = {
  label: string;
  actions: CreateAction[];
};

const CREATE_MENU: CreateCategory[] = [
  {
    label: "Production",
    actions: [
      { label: "New Batch", href: "/batches/new" },
      { label: "New Recipe", href: "/production/recipes/new" },
      { label: "New Location", href: "/production/locations/new" },
    ],
  },
  {
    label: "Sales",
    actions: [
      { label: "New Order", href: "/sales/orders/new" },
      { label: "New Customer", href: "/sales/customers/new" },
      { label: "New Product", href: "/sales/products/new" },
    ],
  },
  {
    label: "Dispatch",
    actions: [
      { label: "New Delivery Run", href: "/dispatch/deliveries/new" },
      { label: "Pack Order", href: "/dispatch/packing" },
    ],
  },
  {
    label: "Plant Health",
    actions: [
      { label: "Log IPM Action", href: "/actions/ipm/new" },
      { label: "Flag Batch", href: "/actions/flagged/new" },
    ],
  },
];

export default function CreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-green-700 hover:bg-green-800 text-white gap-2 font-semibold">
          <Plus className="h-4 w-4" />
          Create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[900px] bg-green-700 text-white border-green-800 p-0 overflow-hidden"
        sideOffset={8}
      >
        <div className="grid grid-cols-3 divide-x divide-green-600/30">
          {CREATE_MENU.map((category) => (
            <div key={category.label} className="p-6">
              <DropdownMenuLabel className="text-white font-semibold mb-3 px-0 text-base pb-2 border-b border-green-600/40">
                {category.label}
              </DropdownMenuLabel>
              <div className="space-y-0.5 mt-3">
                {category.actions.map((action) => (
                  <DropdownMenuItem
                    key={action.href}
                    asChild
                    className="focus:bg-green-600/50 hover:bg-green-600/50 focus:text-white cursor-pointer px-3 py-2 rounded-sm"
                  >
                    <Link href={action.href} className="text-sm text-white/95 hover:text-white block">
                      {action.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* "More..." section at bottom right */}
        <div className="border-t border-green-600/30 bg-green-800/30 p-3 flex justify-end">
          <Link
            href="/settings"
            className="text-sm text-white/80 hover:text-white transition-colors flex items-center gap-1"
          >
            More...
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
