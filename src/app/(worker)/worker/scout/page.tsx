"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Scout Page Redirect
 * Redirects to Plant Health landing page for backward compatibility
 */
export default function ScoutRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/worker/plant-health");
  }, [router]);

  return null;
}
