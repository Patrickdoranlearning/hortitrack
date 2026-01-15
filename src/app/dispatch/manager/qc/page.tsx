import { redirect } from "next/navigation";
import { getUserAndOrg } from "@/server/auth/org";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { QCQueueTable } from "@/components/dispatch/manager/QCQueueTable";

interface QCQueueItem {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  totalQty: number;
  pickCompletedAt: string | null;
  pickerName: string | null;
  pickerUserId: string | null;
  status: string;
  qcStatus: string | null;
}

interface QCStats {
  pending: number;
  passed: number;
  failed: number;
  issues: number;
}

export default async function DispatchQCPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Unauthenticated") {
      redirect("/login?next=/dispatch/manager/qc");
    }
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Error loading QC data.</p>
        </Card>
      </div>
    );
  }

  // Fetch pick lists that need QC review (status = completed means ready for QC)
  const { data: pickLists, error: plError } = await supabase
    .from("pick_lists")
    .select(`
      id,
      status,
      completed_at,
      completed_by,
      assigned_user_id,
      order:orders(
        id,
        order_number,
        customer:customers(name)
      ),
      pick_items(
        id,
        target_qty,
        picked_qty
      )
    `)
    .eq("org_id", orgId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  if (plError) {
    console.error("Error fetching pick lists:", plError.message || JSON.stringify(plError));
  }

  // Also try to get qc_status if column exists, but don't fail if it doesn't
  const pickListsWithQC = (pickLists || []).map((pl: any) => ({
    ...pl,
    qc_status: null, // Default to null, column may not exist yet
  }));

  // Fetch user names for pickers
  const userIds = (pickLists || [])
    .map((pl) => pl.completed_by || pl.assigned_user_id)
    .filter(Boolean) as string[];

  let userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", [...new Set(userIds)]);

    if (profiles) {
      userMap = profiles.reduce(
        (acc, p) => {
          acc[p.id] = p.display_name || p.email || "Unknown";
          return acc;
        },
        {} as Record<string, string>
      );
    }
  }

  // Fetch QC stats for today (qc_status column may not exist in older setups)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Try to get QC stats - these queries may fail if qc_status column doesn't exist
  let passedCount = 0;
  let failedCount = 0;
  let feedbackCount = 0;

  try {
    const { count: passed } = await supabase
      .from("pick_lists")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("qc_status", "passed")
      .gte("completed_at", todayStr);
    passedCount = passed || 0;
  } catch {
    // qc_status column may not exist
  }

  try {
    const { count: failed } = await supabase
      .from("pick_lists")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("qc_status", "failed")
      .gte("completed_at", todayStr);
    failedCount = failed || 0;
  } catch {
    // qc_status column may not exist
  }

  try {
    const { count } = await supabase
      .from("qc_feedback")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .is("resolved_at", null);
    feedbackCount = count || 0;
  } catch {
    // qc_feedback table may not exist
  }

  // Transform data for display
  const qcItems: QCQueueItem[] = (pickLists || []).map((pl: any) => {
    const order = pl.order;
    const items = pl.pick_items || [];
    const totalQty = items.reduce((sum: number, i: any) => sum + (i.picked_qty || 0), 0);
    const pickerId = pl.completed_by || pl.assigned_user_id;

    return {
      id: pl.id,
      orderNumber: order?.order_number || "Unknown",
      customerName: order?.customer?.name || "Unknown Customer",
      itemCount: items.length,
      totalQty,
      pickCompletedAt: pl.completed_at,
      pickerName: pickerId ? userMap[pickerId] || "Unknown" : null,
      pickerUserId: pickerId,
      status: pl.status,
      qcStatus: pl.qc_status,
    };
  });

  const stats: QCStats = {
    pending: qcItems.length,
    passed: passedCount,
    failed: failedCount,
    issues: feedbackCount,
  };

  const oldestWaiting =
    qcItems[0]?.pickCompletedAt
      ? formatDistanceToNow(new Date(qcItems[0].pickCompletedAt), { addSuffix: false })
      : null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Quality Control Review</h2>
        <p className="text-muted-foreground text-sm">
          Review completed picks and provide feedback to pickers
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting QC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Passed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Open Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.issues}</div>
            <p className="text-xs text-muted-foreground">Unresolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Oldest Waiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{oldestWaiting || "-"}</div>
            <p className="text-xs text-muted-foreground">Time in queue</p>
          </CardContent>
        </Card>
      </div>

      {/* QC Queue */}
      {qcItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Orders Awaiting QC</h3>
            <p className="text-muted-foreground">
              All picked orders have been reviewed. Check back when more orders are ready.
            </p>
          </CardContent>
        </Card>
      ) : (
        <QCQueueTable items={qcItems} />
      )}
    </div>
  );
}
