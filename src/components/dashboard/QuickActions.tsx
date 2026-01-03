"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  QrCode,
  ShoppingCart,
  ClipboardList,
  Truck,
} from "lucide-react";

const QUICK_ACTIONS = [
  {
    label: "Scan Batch",
    href: "/scan",
    icon: QrCode,
    description: "Scan a batch QR code",
  },
  {
    label: "New Order",
    href: "/sales/orders/new",
    icon: ShoppingCart,
    description: "Create a sales order",
  },
  {
    label: "Today's Tasks",
    href: "/tasks",
    icon: ClipboardList,
    description: "View pending tasks",
  },
  {
    label: "Deliveries",
    href: "/dispatch",
    icon: Truck,
    description: "Manage dispatch runs",
  },
] as const;

export default function QuickActions() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto flex-col gap-2 p-4 hover:bg-primary/5"
              asChild
            >
              <Link href={action.href}>
                <action.icon className="h-6 w-6" />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

