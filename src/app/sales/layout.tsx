import { SalesSidebar } from "@/components/sales/SalesSidebar";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-64px)]"> {/* adjust header height if needed */}
      <SalesSidebar />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}
