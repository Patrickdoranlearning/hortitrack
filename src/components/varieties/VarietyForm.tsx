// src/components/varieties/VarietyForm.tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Variety = { id?: string; name: string };
export default function VarietyForm({
  variety,
  onSubmit,
  onCancel,
  saving,
}: {
  variety: Variety;
  onSubmit: (v: Variety) => Promise<void> | void;
  onCancel?: () => void;
  saving?: boolean;
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
      <Label htmlFor="variety-name" className="text-sm">Variety Name</Label>
      <Input
        id="variety-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={saving}
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}