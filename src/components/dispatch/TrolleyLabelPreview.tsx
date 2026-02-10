// src/components/dispatch/TrolleyLabelPreview.tsx
"use client";
import { useEffect, useRef } from "react";
import bwipjs from "bwip-js";

type Props = {
  orderNumber: string;
  customerName: string;
  deliveryDate?: string;
  trolleyNumber?: string;
  totalTrolleys?: number;
  dataMatrixPayload: string;
};

export default function TrolleyLabelPreview({
  orderNumber,
  customerName,
  deliveryDate,
  trolleyNumber,
  totalTrolleys,
  dataMatrixPayload,
}: Props) {
  const dmRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!dmRef.current) return;
    try {
      bwipjs.toCanvas(dmRef.current, {
        bcid: "datamatrix",
        text: dataMatrixPayload,
        scale: 3,
        includetext: false,
      });
    } catch {
      // DataMatrix render failed silently
    }
  }, [dataMatrixPayload]);

  return (
    <div
      style={{
        width: "100mm",
        height: "70mm",
        boxSizing: "border-box",
        padding: "4mm",
        background: "white",
        border: "1px solid rgba(0,0,0,.08)",
        borderRadius: 6,
        boxShadow: "0 6px 24px rgba(0,0,0,.10)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top section: DM + Text content */}
      <div style={{ display: "flex", gap: "4mm", flexGrow: 1 }}>
        {/* Left: DataMatrix */}
        <div style={{ flexShrink: 0 }}>
          <canvas ref={dmRef} style={{ width: "28mm", height: "28mm" }} />
        </div>

        {/* Right: Text details */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", overflow: "hidden", flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "7mm",
              lineHeight: 1.1,
              letterSpacing: "-0.06mm",
              wordBreak: "break-word",
              maxHeight: "16mm",
              overflow: "hidden",
            }}
          >
            {customerName}
          </div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "5mm",
              lineHeight: 1.2,
              opacity: 0.9,
              marginTop: '2mm',
            }}
          >
            #{orderNumber}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,.1)', margin: '2mm 0' }} />

      {/* Middle section: Details */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1 }}>
        <div>
          {deliveryDate && (
            <div style={{ fontSize: '3.5mm', color: '#4b5563', marginBottom: '1mm' }}>
              <span style={{ fontWeight: 500 }}>Delivery:</span> {deliveryDate}
            </div>
          )}
          {trolleyNumber && (
            <div style={{ fontSize: '6mm', fontWeight: 700 }}>
              Trolley {trolleyNumber}
              {totalTrolleys && totalTrolleys > 1 && (
                <span style={{ fontSize: '3.5mm', fontWeight: 400, color: '#6b7280', marginLeft: '2mm' }}>
                  of {totalTrolleys}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom section: Scan instruction */}
      <div
        style={{
          fontSize: "3mm",
          textAlign: "center",
          color: "#9ca3af",
          paddingTop: '2mm',
          borderTop: '1px solid rgba(0,0,0,.1)',
          marginTop: 'auto',
        }}
      >
        Scan to start picking
      </div>
    </div>
  );
}
