
import { type LucideIcon, ShoppingCart, Users, PackageSearch, LayoutDashboard, Sprout, ShieldCheck, Truck, Store, Target, ListTodo, Package } from "lucide-react";

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
      { label: "Jobs", href: "/production/jobs", description: "Create and manage production jobs." },
      { label: "Recipes", href: "/production/recipes", description: "Production recipes and timelines." },
      { label: "Saleable", href: "/production/saleable", description: "Release-ready batches and quick approvals." },
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
      { label: "IPM Products", href: "/plant-health/products", description: "Manage IPM product database." },
      { label: "IPM Programs", href: "/plant-health/programs", description: "Create week-based treatment programs." },
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
      { label: "Targets", href: "/sales/targets", description: "Customer targeting and van-filling." },
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
      { label: "Dashboard", href: "/dispatch", description: "Command center for order flow and logistics." },
      { label: "Picking", href: "/dispatch/picking", description: "Picker task list and order picking." },
      { label: "Bulk Picking", href: "/dispatch/bulk-picking", description: "Group pick orders by delivery date and pack." },
      { label: "QC Review", href: "/dispatch/qc", description: "Quality check picked orders before dispatch." },
      { label: "Trolleys", href: "/dispatch/trolleys", description: "Track trolley inventory and customer balances." },
      { label: "Driver View", href: "/dispatch/driver", description: "Mobile view for drivers on route." },
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
  {
    key: "tasks",
    label: "Tasks",
    href: "/tasks",
    icon: ListTodo,
    items: [
      { label: "Overview", href: "/tasks", description: "Task dashboard and your daily schedule." },
      { label: "Production Tasks", href: "/tasks/production", description: "Manage and assign production jobs." },
      { label: "Plant Health Tasks", href: "/tasks/plant-health", description: "IPM and health-related tasks." },
      { label: "Dispatch Tasks", href: "/tasks/dispatch", description: "Picking, packing, and loading tasks." },
    ]
  },
];

export const NAV_SALES = [
  { label: "Dashboard", href: "/sales", icon: LayoutDashboard, requiredRoles: [] },
  { label: "Orders", href: "/sales/orders", icon: ShoppingCart, requiredRoles: [] },
  { label: "Targets", href: "/sales/targets", icon: Target, requiredRoles: [] },
  { label: "Customers", href: "/sales/customers", icon: Users, requiredRoles: [] },
  { label: "Products", href: "/sales/products", icon: PackageSearch, requiredRoles: [] },
];
