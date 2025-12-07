import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ pickListId: string }>;
}

// Picking has moved to the dispatch module
export default async function SalesPickingRedirect({ params }: PageProps) {
  const { pickListId } = await params;
  redirect(`/dispatch/picking/${pickListId}`);
}
