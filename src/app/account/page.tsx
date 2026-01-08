import { redirect } from "next/navigation";

/**
 * Redirect /account to /settings/account
 * This page is kept for backwards compatibility
 */
export default function AccountPage() {
  redirect("/settings/account");
}
