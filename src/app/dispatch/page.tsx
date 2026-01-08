import { redirect } from "next/navigation";
import { getDispatchRoleForUser } from "@/server/dispatch/get-dispatch-role";

/**
 * Dispatch Module - Role-based Router
 *
 * Redirects users to their appropriate view based on their org role:
 * - Managers (admin, owner, editor, staff, sales) -> /dispatch/manager
 * - Pickers (picker, grower) -> /dispatch/picker
 * - Drivers (driver) -> /dispatch/driver
 */
export default async function DispatchPage() {
  try {
    const { role } = await getDispatchRoleForUser();

    switch (role) {
      case "manager":
        redirect("/dispatch/manager");
      case "picker":
        redirect("/dispatch/picker");
      case "driver":
        redirect("/dispatch/driver");
      default:
        // Default to manager view for unknown roles
        redirect("/dispatch/manager");
    }
  } catch (error: any) {
    if (
      error.message === "Unauthenticated" ||
      error.message === "Unauthorized"
    ) {
      redirect("/login?next=/dispatch");
    }

    // For NEXT_REDIRECT errors, rethrow them
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }

    console.error("Error determining dispatch role:", error);
    // Default to manager view on error
    redirect("/dispatch/manager");
  }
}
