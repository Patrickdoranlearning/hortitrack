import { redirect } from "next/navigation";
import DispatchBoard from "@/components/dispatch/DispatchBoard";
import { getDispatchBoardData } from "@/server/dispatch/queries.server";

/**
 * Loads Page - Kanban-style load management
 * Uses the existing DispatchBoard in loads view mode for now
 */
export default async function DispatchLoadsPage() {
  let data;

  try {
    data = await getDispatchBoardData();
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      redirect("/login?next=/dispatch/manager/loads");
    }
    console.error("Error fetching dispatch board data:", error);
    data = { orders: [], hauliers: [], growers: [], routes: [], deliveryRuns: [] };
  }

  const { orders, hauliers, growers, routes, deliveryRuns } = data;

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Loads</h2>
        <p className="text-muted-foreground text-sm">
          Manage delivery loads, assign orders to vehicles
        </p>
      </div>
      <DispatchBoard
        orders={orders}
        hauliers={hauliers}
        growers={growers}
        routes={routes}
        deliveryRuns={deliveryRuns}
      />
    </div>
  );
}
