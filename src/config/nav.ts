
import { type LucideIcon, ShoppingCart, Users, PackageSearch, LayoutDashboard, Sprout, ShieldCheck, Truck, Store, Target, Package } from "lucide-react";

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
      { label: "Batches", href: "/", description: "View and manage all batches." },
      { label: "Locations", href: "/production/locations", description: "View what's growing in each location." },
      { label: "Planning", href: "/production/planning", description: "Plan future production cycles." },
      { label: "Execution", href: "/production/execution", description: "Printable worksheets and execution planning." },
      { label: "Recipes", href: "/production/recipes", description: "Production recipes and timelines." },
      { label: "Saleable", href: "/production/saleable", description: "Release-ready batches and quick approvals." },
      { label: "Dashboard", href: "/dashboard", description: "Production overview and key metrics." },
    ]
  },
  {
    key: "plantHealth",
    label: "Plant Health",
    href: "/plant-health",
    icon: ShieldCheck,
    items: [
      { label: "Dashboard", href: "/plant-health", description: "Upcoming treatments and active programs." },
      { label: "IPM Tasks", href: "/plant-health/tasks", description: "Spray schedules grouped by product and week." },
      { label: "Scout Mode", href: "/plant-health/scout", description: "Scan locations to log issues and readings." },
      { label: "Trials", href: "/plant-health/trials", description: "Scientific trials to compare treatments and processes." },
      { label: "IPM Products", href: "/plant-health/products", description: "Manage IPM product database." },
      { label: "IPM Programs", href: "/plant-health/programs", description: "Create week-based treatment programs." },
    ]
  },
  {
    key: "sales",
    label: "Sales",
    href: "/sales/orders",
    icon: ShoppingCart,
    items: [
      { label: "Orders", href: "/sales/orders", description: "Manage all customer orders." },
      { label: "Targets", href: "/sales/targets", description: "Customer targeting and van-filling." },
      { label: "Customers", href: "/sales/customers", description: "View and manage customers." },
      { label: "Products", href: "/sales/products", description: "Manage the sales catalog." },
      { label: "Sales Dashboard", href: "/sales", description: "View recent orders and sales data." },
    ]
  },
  {
    key: "dispatch",
    label: "Dispatch",
    href: "/dispatch",
    icon: Truck,
    items: [
      { label: "Dashboard", href: "/dispatch", description: "Role-based dispatch dashboard." },
      { label: "Manager View", href: "/dispatch/manager", description: "Orders, loads, picking, and QC management." },
      { label: "Picker View", href: "/dispatch/picker", description: "Scan-to-pick and task list for pickers." },
      { label: "Driver View", href: "/dispatch/driver", description: "Delivery routes and proof of delivery." },
      { label: "Trolleys", href: "/dispatch/trolleys", description: "Track trolley inventory and customer balances." },
    ]
  },
  {
    key: "b2b",
    label: "B2B Portal",
    href: "/b2b/impersonate",
    icon: Store,
    items: [
      { label: "Place Order (as Customer)", href: "/b2b/impersonate", description: "Impersonate customer to place orders." },
      { label: "Customer Login", href: "/b2b/login", description: "Direct link to customer portal login." },
    ]
  },
  {
    key: "materials",
    label: "Materials",
    href: "/materials",
    icon: Package,
    items: [
      { label: "Overview", href: "/materials", description: "Materials dashboard and low stock alerts." },
      { label: "Catalog", href: "/materials/catalog", description: "Manage materials catalog (pots, trays, soil, etc.)." },
      { label: "Stock", href: "/materials/stock", description: "View and manage stock levels." },
      { label: "Purchase Orders", href: "/materials/purchase-orders", description: "Create and manage purchase orders." },
    ]
  },
];

export const NAV_SALES = [
  { label: "Orders", href: "/sales/orders", icon: ShoppingCart, requiredRoles: [] },
  { label: "Targets", href: "/sales/targets", icon: Target, requiredRoles: [] },
  { label: "Customers", href: "/sales/customers", icon: Users, requiredRoles: [] },
  { label: "Products", href: "/sales/products", icon: PackageSearch, requiredRoles: [] },
  { label: "Dashboard", href: "/sales", icon: LayoutDashboard, requiredRoles: [] },
];
