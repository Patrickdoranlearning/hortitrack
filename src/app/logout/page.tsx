import { getSupabaseServerApp } from "@/server/db/supabase";
import { redirect } from "next/navigation";

export default async function LogoutPage() {
  const supabase = await getSupabaseServerApp();
  await supabase.auth.signOut();
  redirect("/login");
}
