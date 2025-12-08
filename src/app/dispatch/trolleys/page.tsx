import { Metadata } from "next";
import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
import TrolleyManagementClient from "./TrolleyManagementClient";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Trolley Management | Dispatch",
};

export default async function TrolleyManagementPage() {
  const { userId, orgId } = await getUserAndOrg();

  if (!userId) {
    redirect("/login");
  }

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <TrolleyManagementClient />
    </PageFrame>
  );
}
