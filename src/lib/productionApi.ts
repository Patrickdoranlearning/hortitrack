import { fetchWithAuth } from './fetchWithAuth';

export async function createPropagation(input: {
  plant_variety_id: string;
  size_id: string;
  location_id: string;
  containers: number;
  planted_at: string | Date;
  supplier_id?: string | null;
}) {
  const res = await fetchWithAuth('/api/batches/propagation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Propagation create failed: ${res.status}`);
  return res.json();
}
