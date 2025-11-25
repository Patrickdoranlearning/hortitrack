
import { type LucideIcon, ShoppingCart, Receipt, Users, PackageSearch, LayoutDashboard, Sprout, ShieldCheck, Truck } from "lucide-react";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  items?: NavSubItem[];
};

export type NavSubItem = {
  label: string;
  href: string;
  description?: string;
}

export const APP_NAV: NavItem[] = [
  {
    key: "production",
    label: "Production",
    href: "/",
    icon: Sprout,
    items: [
      { label: "Dashboard", href: "/", description: "High-level production overview." },
      { label: "All Batches", href: "/batches", description: "View and manage all batches." },
      { label: "Planning", href: "/production/planning", description: "Plan future production cycles." },
    ]
  },
  {
    key: "plantHealth",
    label: "Plant Health",
    href: "/actions",
    icon: ShieldCheck,
    items: [
      { label: "Health Dashboard", href: "/actions", description: "Tasks and recent activities." },
      { label: "IPM Log", href: "/actions/ipm", description: "Log and view pest management." },
      { label: "Flagged Batches", href: "/actions/flagged", description: "Batches needing attention." },
    ]
  },
  {
    key: "sales",
    label: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    items: [
      { label: "Sales Dashboard", href: "/sales", description: "View recent orders and sales data." },
      { label: "Orders", href: "/sales/orders", description: "Manage all customer orders." },
      { label: "Customers", href: "/sales/customers", description: "View and manage customers." },
      { label: "Products", href: "/sales/products", description: "Manage the sales catalog." },
    ]
  },
  {
    key: "dispatch",
    label: "Dispatch",
    href: "/dispatch",
    icon: Truck,
    items: [
      { label: "Dispatch Dashboard", href: "/dispatch", description: "Packing and delivery schedules." },
      { label: "Packing", href: "/dispatch/packing", description: "Pack orders for shipment." },
      { label: "Deliveries", href: "/dispatch/deliveries", description: "Manage delivery routes and status." },
    ]
  },
];

export const NAV_SALES = [
  { label: "Dashboard", href: "/sales", icon: LayoutDashboard, requiredRoles: [] },
  { label: "Orders", href: "/sales/orders", icon: ShoppingCart, requiredRoles: [] },
  { label: "Customers", href: "/sales/customers", icon: Users, requiredRoles: [] },
  { label: "Products", href: "/sales/products", icon: PackageSearch, requiredRoles: [] },
];
