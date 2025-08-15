
"use client";
import { useEffect, useRef } from "react";
import bwipjs from "bwip-js";

type Props = {
  batchNumber: string | number;
  variety: string;
  family: string;
  quantity: number;
  size: string;
  dataMatrixPayload?: string; // defaults to BATCH:<batchNumber>
  debugFrame?: boolean;
};

export default function LabelPreview({
  batchNumber,
  variety,
  family,
  quantity,
  size,
  dataMatrixPayload,
  debugFrame = false,
}: Props) {
  const dmRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!dmRef.current) return;
    try {
      bwipjs.toCanvas(dmRef.current, {
        bcid: "datamatrix",
        text: dataMatrixPayload ?? `BATCH:${batchNumber}`,
        scale: 3,      // ~ module size on screen
        includetext: false,
        rows: 0, columns: 0, // let it auto-size
      });
    } catch (e) {
      console.error("DataMatrix render failed:", e);
    }
  }, [batchNumber, dataMatrixPayload]);

  return (
    <div
      // 70×50 mm, landscape. 3mm inner padding to mimic printer margin.
      className="relative"
      style={{
        width: "70mm",
        height: "50mm",
        boxSizing: "border-box",
        padding: "3mm",
        border: debugFrame ? "1px dashed #aaa" : "none",
        background: "white",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2mm", height: "100%" }}>
        {/* DM on the left */}
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <canvas ref={dmRef} style={{ width: "22mm", height: "22mm" }} />
        </div>

        {/* Text on the right */}
        <div style={{ display: "grid", gridTemplateRows: "auto auto auto auto", gap: "1.5mm" }}>
          <div style={{ fontWeight: 700, fontSize: "10mm", lineHeight: 1 }}>
            #{String(batchNumber)}
          </div>
          <div style={{ fontWeight: 600, fontSize: "8mm", lineHeight: 1.05, wordBreak: "break-word" }}>
            {variety}
          </div>
          <div style={{ fontSize: "5mm" }}>Family: {family}</div>
          <div style={{ fontSize: "5mm" }}>
            Qty: {quantity} &nbsp;&nbsp; Size: {size}
          </div>
        </div>
      </div>
    </div>
  );
}
