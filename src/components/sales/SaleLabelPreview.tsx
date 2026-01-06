// src/components/sales/SaleLabelPreview.tsx
"use client";
import { useEffect, useRef } from "react";
import bwipjs from "bwip-js";

type Props = {
  productTitle: string;
  size: string;
  priceText: string;
  barcode: string;
  lotNumber?: string;
  footerSmall?: string;
  // Template dimensions
  widthMm?: number;
  heightMm?: number;
};

export default function SaleLabelPreview({
  productTitle,
  size,
  priceText,
  barcode,
  lotNumber,
  footerSmall,
  widthMm = 70,
  heightMm = 50,
}: Props) {
  const barcodeRef = useRef<HTMLCanvasElement | null>(null);
  const isCompact = widthMm <= 45 && heightMm <= 45;

  useEffect(() => {
    if (!barcodeRef.current || !barcode) return;
    try {
      bwipjs.toCanvas(barcodeRef.current, {
        bcid: "code128",
        text: barcode,
        scale: 2,
        height: isCompact ? 8 : 10,
        includetext: true,
        textxalign: "center",
        textsize: 8,
      });
    } catch (e) {
      console.error("Barcode render failed:", e);
    }
  }, [barcode, isCompact]);

  // Compact layout (40x40mm)
  if (isCompact) {
    return (
      <div
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          boxSizing: "border-box",
          padding: "2mm",
          background: "white",
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: 4,
          boxShadow: "0 4px 16px rgba(0,0,0,.08)",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Barcode at top */}
        <div style={{ flexShrink: 0, marginBottom: "1mm" }}>
          <canvas
            ref={barcodeRef}
            style={{ maxWidth: `${widthMm - 4}mm`, height: "auto" }}
          />
        </div>

        {/* Product title (centered) */}
        <div
          style={{
            fontWeight: 600,
            fontSize: "3.5mm",
            lineHeight: 1.2,
            textAlign: "center",
            wordBreak: "break-word",
            overflow: "hidden",
            maxHeight: "8mm",
          }}
        >
          {productTitle}
        </div>

        {/* Price (bold, centered) */}
        <div
          style={{
            fontWeight: 800,
            fontSize: "5mm",
            lineHeight: 1,
            textAlign: "center",
            color: "#1a1a1a",
          }}
        >
          {priceText}
        </div>
      </div>
    );
  }

  // Full layout (70x50mm)
  return (
    <div
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        boxSizing: "border-box",
        padding: "3mm",
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
      {/* Top: Product info */}
      <div style={{ flexGrow: 1 }}>
        {/* Product title */}
        <div
          style={{
            fontWeight: 700,
            fontSize: "4.5mm",
            lineHeight: 1.2,
            letterSpacing: "-0.02mm",
            wordBreak: "break-word",
            marginBottom: "1.5mm",
          }}
        >
          {productTitle}
        </div>

        {/* Size */}
        <div
          style={{
            fontSize: "3.5mm",
            lineHeight: 1.3,
            opacity: 0.8,
            marginBottom: "2mm",
          }}
        >
          {size}
        </div>

        {/* Price */}
        <div
          style={{
            fontWeight: 800,
            fontSize: "6mm",
            lineHeight: 1,
            color: "#1a1a1a",
            marginBottom: "2mm",
          }}
        >
          {priceText}
        </div>
      </div>

      {/* Barcode */}
      <div style={{ flexShrink: 0, marginBottom: "1mm" }}>
        <canvas
          ref={barcodeRef}
          style={{ maxWidth: `${widthMm - 6}mm`, height: "auto" }}
        />
      </div>

      {/* Optional lot number */}
      {lotNumber && (
        <div
          style={{
            fontSize: "2.5mm",
            lineHeight: 1.2,
            opacity: 0.7,
            marginBottom: "1mm",
          }}
        >
          Lot: {lotNumber}
        </div>
      )}

      {/* Footer */}
      {footerSmall && (
        <div
          style={{
            fontSize: "2.5mm",
            lineHeight: 1.2,
            opacity: 0.6,
            borderTop: "1px solid rgba(0,0,0,.1)",
            paddingTop: "1mm",
          }}
        >
          {footerSmall}
        </div>
      )}
    </div>
  );
}







