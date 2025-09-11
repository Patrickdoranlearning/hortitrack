"use client";

import { ChevronRight } from "lucide-react";
import type { AncestryNode } from "@/types/ancestry";
import { MiniBatchCard } from "./MiniBatchCard";

interface Props {
  nodes: AncestryNode[];
  currentId: string;
  onOpen: (id: string) => void;
}

export function AncestryScroller({ nodes, currentId, onOpen }: Props) {
  return (
    <div className="relative flex items-center gap-2 overflow-x-auto px-2 py-3 [scrollbar-width:thin] snap-x snap-mandatory">
      {nodes.map((n, idx) => (
        <div key={n.id} className="flex items-center gap-2 snap-start">
          <MiniBatchCard node={n} isCurrent={n.id === currentId} onOpen={onOpen} />
          {idx < nodes.length - 1 && <ChevronRight className="shrink-0" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
