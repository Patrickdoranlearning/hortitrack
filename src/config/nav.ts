import { type LucideIcon, ShoppingCart, Receipt, Users, PackageSearch, LayoutDashboard } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon?: LucideIcon;
  requiredRoles?: string[]; // hide if missing
};

export const NAV_SALES: NavItem[] = [
  { label: "Sales Dashboard", href: "/sales", icon: LayoutDashboard, requiredRoles: ["sales:read"] },
  { label: "Orders",          href: "/sales/orders", icon: ShoppingCart, requiredRoles: ["sales:read"] },
  { label: "Create Order",    href: "/sales/orders/new", icon: PackageSearch, requiredRoles: ["sales:create"] },
  { label: "Customers",       href: "/sales/customers", icon: Users, requiredRoles: ["sales:read"] },
  { label: "Invoices",        href: "/sales/invoices", icon: Receipt, requiredRoles: ["invoices:read"] },
  { label: "Catalog",         href: "/sales/catalog", icon: PackageSearch, requiredRoles: ["sales:read"] },
];
