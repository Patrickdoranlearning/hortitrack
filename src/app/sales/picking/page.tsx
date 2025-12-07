import { redirect } from 'next/navigation';

// Picking has moved to the dispatch module
export default function SalesPickingRedirect() {
  redirect('/dispatch/picking');
}
