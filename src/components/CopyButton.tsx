"use client";
import { useState } from "react";
import { copyToClipboard } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      onClick={async () => {
        const success = await copyToClipboard(text);
        setOk(success);
        setTimeout(() => setOk(false), 1500);
      }}
      aria-label={label}
    >
      {ok ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {ok ? "Copied" : label}
    </Button>
  );
}