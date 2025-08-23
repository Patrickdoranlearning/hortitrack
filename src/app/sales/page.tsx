
// Server Component
import SalesPageClient from "./SalesPageClient";
export default function SalesPage() {
  // Avoid server-time Firestore call; let the client fetch via API
  return <SalesPageClient />;
}
