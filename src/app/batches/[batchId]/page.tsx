import { redirect } from "next/navigation";
export default function Page({ params }: { params: { batchId: string }}) {
  redirect(`/?batch=${encodeURIComponent(params.batchId)}`);
}
