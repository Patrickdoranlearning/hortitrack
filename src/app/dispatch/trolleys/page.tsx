import { Metadata } from "next";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import TrolleyManagementClient from "./TrolleyManagementClient";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Trolley Management | Dispatch",
};

export default async function TrolleyManagementPage() {
  try {
    await getUserAndOrg();
  } catch {
    redirect("/login?next=/dispatch/trolleys");
  }

  return (
    <PageFrame moduleKey="dispatch">
      <TrolleyManagementClient />
    </PageFrame>
  );
}
