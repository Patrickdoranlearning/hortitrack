"use client";

import * as React from "react";
import type { HistoryLog } from "@/server/batches/history";

const TYPE_META: Record<string, { label: string; icon: string }> = {
  irrigation: { label: "Irrigation", icon: "💧" },
  pest:       { label: "Pest Control", icon: "🐛" },
  fertilize:  { label: "Fertilizing", icon: "🧪" },
  pruning:    { label: "Pruning", icon: "✂️"  },
  grading:    { label: "Grading", icon: "📏"  },
  move:       { label: "Move", icon: "📦" },
  stage:      { label: "Stage", icon: "📋" },
  action:     { label: "Action", icon: "•" },
};

export function HistoryLog({ logs }: { logs: HistoryLog[] }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<string>("");

  const filtered = logs.filter(l => {
    const t = type ? l.type === type : true;
    const s = q ? (l.title?.toLowerCase().includes(q.toLowerCase()) || l.details?.toLowerCase().includes(q.toLowerCase())) : true;
    return t && s;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          placeholder="Search notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg border text-sm"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="text-xs text-muted-foreground">{filtered.length} of {logs.length} entries</div>
      </div>

      <ul className="divide-y rounded-lg border bg-white">
        {filtered.map((l) => {
          const meta = TYPE_META[l.type] || TYPE_META.action;
          return (
            <li key={l.id} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{meta.icon} {meta.label} — {l.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(l.at).toLocaleString()}</div>
                  {l.details ? <div className="text-sm mt-1">{l.details}</div> : null}
                  {l.media?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {l.media.map((m, i) => (
                        <a key={i} href={m.url} target="_blank" rel="noreferrer" className="text-xs underline">{m.name ?? `attachment-${i+1}`}</a>
                      ))}
                    </div>
                  ) : null}
                </div>
                {l.userName || l.userId ? <div className="text-xs text-right text-muted-foreground">by {l.userName ?? l.userId}</div> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
