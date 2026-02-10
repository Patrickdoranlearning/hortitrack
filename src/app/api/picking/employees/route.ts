import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  getTeamEmployees,
  addEmployeeToTeam,
  removeEmployeeFromTeam,
} from "@/server/sales/picking";
import { logger } from "@/server/utils/logger";

// GET /api/picking/employees - List employees
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const { searchParams } = new URL(request.url);
    
    const teamId = searchParams.get("teamId");

    // If teamId provided, get team members
    if (teamId) {
      const members = await getTeamEmployees(teamId);
      return NextResponse.json({ members });
    }

    // Otherwise get all employees
    const employees = await getEmployees(orgId);
    return NextResponse.json({ employees });
  } catch (error: unknown) {
    logger.picking.error("Error fetching employees", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

// POST /api/picking/employees - Create employee or assign to team
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const body = await request.json();
    const { action, name, role, phone, email, teamId, employeeId, isLead } = body;

    // Assign employee to team
    if (action === "assign" && teamId && employeeId) {
      const result = await addEmployeeToTeam(teamId, employeeId, isLead || false);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Remove employee from team
    if (action === "unassign" && teamId && employeeId) {
      const result = await removeEmployeeFromTeam(teamId, employeeId);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Create new employee
    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const result = await createEmployee(orgId, name, role, phone, email);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ employee: result.employee }, { status: 201 });
  } catch (error: unknown) {
    logger.picking.error("Employee operation failed", error);
    return NextResponse.json(
      { error: "Failed to perform operation" },
      { status: 500 }
    );
  }
}

// PATCH /api/picking/employees - Update employee
export async function PATCH(request: NextRequest) {
  try {
    await getUserAndOrg();
    const body = await request.json();
    const { employeeId, name, role, phone, email, isActive } = body;

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 }
      );
    }

    const result = await updateEmployee(employeeId, { name, role, phone, email, isActive });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.picking.error("Error updating employee", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}







