"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Worker App Root Page
 * Redirects to the Production landing page (default tab)
 */
export default function WorkerHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/worker/production");
  }, [router]);

  return null;
}
