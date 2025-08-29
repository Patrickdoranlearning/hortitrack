// src/components/varieties/VarietyForm.tsx
"use client";
import React from "react";

export type Variety = { id?: string; name: string };
export default function VarietyForm({
  variety,
  onSubmit,
}: {
  variety: Variety;
  onSubmit: (v: Variety) => Promise<void> | void;
}) {
  const [name, setName] = React.useState(variety?.name ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...variety, name });
      }}
      className="space-y-3"
    >
      <label className="text-sm">Variety Name</label>
      <input className="w-full border rounded px-2 py-1" value={name} onChange={(e)=>setName(e.target.value)} />
      <button className="btn btn-primary" type="submit">Save</button>
    </form>
  );
}