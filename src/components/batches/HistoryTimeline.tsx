type Item = { at?: string | null; week?: string | null; action: string; note?: string | null; batchId: string };

export function HistoryTimeline({ items }: { items: Item[] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <div className="text-sm text-muted-foreground">No timeline entries.</div>;
  }
  const sorted = [...items].sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });

  return (
    <ol className="relative pl-4">
      {sorted.map((t, i) => (
        <li key={i} className="mb-3">
          <div className="absolute left-0 top-[6px] h-2 w-2 rounded-full bg-foreground/60" />
          <div className="ml-2">
            <div className="text-sm">
              <span className="font-medium capitalize">{t.action}</span>
              {t.week ? <span className="ml-2 text-muted-foreground">{t.week}</span> : null}
              {!t.week && t.at ? <span className="ml-2 text-muted-foreground">{t.at.slice(0,10)}</span> : null}
            </div>
            {t.note ? <div className="text-xs text-muted-foreground">{t.note}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
