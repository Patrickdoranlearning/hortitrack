import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Saleable | Production",
};

export default async function BulkSaleablePage() {
  redirect("/production/saleable");
}

