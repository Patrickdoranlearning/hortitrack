import { listProtocols } from "@/server/planning/service";
import RecipesClient from "./RecipesClient";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const protocols = await listProtocols();

  return <RecipesClient initialProtocols={protocols} />;
}

