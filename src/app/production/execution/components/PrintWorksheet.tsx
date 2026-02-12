"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format, getWeek } from "date-fns";
import type { PlanningBatch } from "@/lib/planning/types";
import type { ExecutionGroup } from "@/server/production/execution-groups";
import type { ExecutionWorksheetWithBatches } from "@/server/production/execution-worksheets";

type Props = {
  groups: ExecutionGroup[];
  groupedBatches: Record<string, PlanningBatch[]>;
  onClose: () => void;
};

type SavedWorksheetProps = {
  worksheet: ExecutionWorksheetWithBatches;
  onClose: () => void;
};

export function PrintWorksheet({ groups, groupedBatches, onClose }: Props) {
  const [mounted, setMounted] = React.useState(false);

  // Mount portal and trigger print
  React.useEffect(() => {
    setMounted(true);

    // Add print class to body to hide other content
    document.body.classList.add("printing-worksheet");

    const timer = setTimeout(() => {
      window.print();
    }, 150);

    const handleAfterPrint = () => {
      document.body.classList.remove("printing-worksheet");
      onClose();
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      document.body.classList.remove("printing-worksheet");
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [onClose]);

  const today = format(new Date(), "dd/MM/yyyy");

  const printStyles = `
    /* When printing, hide everything except our print content */
    @media print {
      body.printing-worksheet > *:not(#print-portal-root) {
        display: none !important;
      }

      body.printing-worksheet #print-portal-root {
        display: block !important;
      }

      body.printing-worksheet #print-portal-root .print-content {
        display: block !important;
        position: static !important;
      }

      @page {
        margin: 1cm;
        size: A4 portrait;
      }

      .print-group {
        page-break-after: always;
      }

      .print-group:last-child {
        page-break-after: avoid;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #ccc;
        padding: 6px 8px;
        text-align: left;
      }

      .print-table th {
        background-color: #f3f4f6 !important;
        font-weight: 600;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-table td.text-right {
        text-align: right;
      }

      .print-table td.text-center {
        text-align: center;
      }

      .print-checkbox {
        width: 20px;
        height: 20px;
        border: 2px solid #000;
        display: inline-block;
      }

      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #000;
      }

      .print-title {
        font-size: 18pt;
        font-weight: 700;
        margin: 0;
      }

      .print-subtitle {
        font-size: 10pt;
        color: #666;
        margin-top: 4px;
      }

      .print-footer {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #ccc;
      }

      .print-notes {
        margin-top: 16px;
      }

      .print-notes-line {
        border-bottom: 1px solid #ccc;
        height: 24px;
        margin-bottom: 8px;
      }
    }

    /* On screen, hide the print portal */
    @media screen {
      #print-portal-root {
        position: fixed;
        left: -9999px;
        top: 0;
        width: 210mm;
        background: white;
      }
    }
  `;

  const content = (
    <>
      <style>{printStyles}</style>
      <div className="print-content">
        {groups.map((group) => {
          const batches = groupedBatches[group.id] ?? [];
          const totalPlants = batches.reduce((sum, b) => sum + b.quantity, 0);

          return (
            <div key={group.id} className="print-group">
              {/* Header */}
              <div className="print-header">
                <div>
                  <h1 className="print-title">EXECUTION WORKSHEET - {group.name}</h1>
                  <p className="print-subtitle">
                    {group.description ?? "Batch execution checklist"}
                  </p>
                </div>
                <div style={{ textAlign: "right", fontSize: "10pt" }}>
                  <div>
                    <strong>Date:</strong> {today}
                  </div>
                  <div>
                    <strong>Batches:</strong> {batches.length}
                  </div>
                  <div>
                    <strong>Total Plants:</strong> {totalPlants.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Batch table */}
              {batches.length === 0 ? (
                <p style={{ fontStyle: "italic", color: "#666" }}>
                  No batches match the criteria for this group.
                </p>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: "40px" }}>#</th>
                      <th>Variety</th>
                      <th style={{ width: "80px" }}>Size</th>
                      <th style={{ width: "80px", textAlign: "right" }}>Qty</th>
                      <th style={{ width: "100px" }}>Date</th>
                      <th style={{ width: "60px" }}>Week</th>
                      <th>Supplier</th>
                      <th style={{ width: "50px", textAlign: "center" }}>Done</th>
                      <th style={{ width: "150px" }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch, index) => (
                      <tr key={batch.id}>
                        <td>{index + 1}</td>
                        <td>
                          <div>
                            <strong>{batch.varietyName ?? "Unknown"}</strong>
                            {batch.batchNumber && (
                              <span style={{ color: "#666", marginLeft: "8px" }}>
                                #{batch.batchNumber}
                              </span>
                            )}
                          </div>
                          {batch.parentBatchNumber && (
                            <div style={{ fontSize: "8pt", color: "#888" }}>
                              Source: #{batch.parentBatchNumber}
                            </div>
                          )}
                        </td>
                        <td>{batch.sizeName ?? "-"}</td>
                        <td className="text-right">
                          {batch.quantity.toLocaleString()}
                        </td>
                        <td>
                          {batch.readyDate
                            ? format(new Date(batch.readyDate), "EEE dd MMM")
                            : "TBC"}
                        </td>
                        <td>
                          {batch.readyDate
                            ? `W${getWeek(new Date(batch.readyDate))}`
                            : "-"}
                        </td>
                        <td>{batch.supplierName ?? "-"}</td>
                        <td className="text-center">
                          <span className="print-checkbox" />
                        </td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Footer */}
              <div className="print-footer">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>
                    <strong>Total:</strong> {batches.length} batch
                    {batches.length !== 1 ? "es" : ""}, {totalPlants.toLocaleString()}{" "}
                    plants
                  </span>
                  <span style={{ color: "#666" }}>
                    Printed: {format(new Date(), "dd MMM yyyy HH:mm")}
                  </span>
                </div>

                {/* Notes section */}
                <div className="print-notes">
                  <p style={{ marginBottom: "8px" }}>
                    <strong>Staff Notes:</strong>
                  </p>
                  <div className="print-notes-line" />
                  <div className="print-notes-line" />
                  <div className="print-notes-line" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // Create or get portal root element
  React.useEffect(() => {
    let portalRoot = document.getElementById("print-portal-root");
    if (!portalRoot) {
      portalRoot = document.createElement("div");
      portalRoot.id = "print-portal-root";
      document.body.appendChild(portalRoot);
    }
    return () => {
      // Don't remove on cleanup - other print components might use it
    };
  }, []);

  if (!mounted) return null;

  const portalRoot = document.getElementById("print-portal-root");
  if (!portalRoot) return null;

  return createPortal(content, portalRoot);
}

// ---------------------------------------------------------------------------
// Print from Saved Worksheet
// ---------------------------------------------------------------------------

export function PrintWorksheetFromSaved({ worksheet, onClose }: SavedWorksheetProps) {
  const [mounted, setMounted] = React.useState(false);

  // Mount portal and trigger print
  React.useEffect(() => {
    setMounted(true);

    // Add print class to body to hide other content
    document.body.classList.add("printing-worksheet");

    const timer = setTimeout(() => {
      window.print();
    }, 150);

    const handleAfterPrint = () => {
      document.body.classList.remove("printing-worksheet");
      onClose();
    };

    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      clearTimeout(timer);
      document.body.classList.remove("printing-worksheet");
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [onClose]);

  const today = format(new Date(), "dd/MM/yyyy");
  const totalPlants = worksheet.batches.reduce(
    (sum, wb) => sum + (wb.batch?.quantity ?? 0),
    0
  );

  const printStyles = `
    /* When printing, hide everything except our print content */
    @media print {
      body.printing-worksheet > *:not(#print-portal-root) {
        display: none !important;
      }

      body.printing-worksheet #print-portal-root {
        display: block !important;
      }

      body.printing-worksheet #print-portal-root .print-content {
        display: block !important;
        position: static !important;
      }

      @page {
        margin: 1cm;
        size: A4 portrait;
      }

      .print-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #ccc;
        padding: 6px 8px;
        text-align: left;
      }

      .print-table th {
        background-color: #f3f4f6 !important;
        font-weight: 600;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-table td.text-right {
        text-align: right;
      }

      .print-table td.text-center {
        text-align: center;
      }

      .print-checkbox {
        width: 20px;
        height: 20px;
        border: 2px solid #000;
        display: inline-block;
      }

      .print-checkbox-checked {
        width: 20px;
        height: 20px;
        border: 2px solid #000;
        display: inline-block;
        background-color: #4ade80 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        position: relative;
      }

      .print-checkbox-checked::after {
        content: "";
        position: absolute;
        left: 5px;
        top: 1px;
        width: 6px;
        height: 10px;
        border: solid #000;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }

      .print-completed-row {
        background-color: #f0fdf4 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .print-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #000;
      }

      .print-title {
        font-size: 18pt;
        font-weight: 700;
        margin: 0;
      }

      .print-subtitle {
        font-size: 10pt;
        color: #666;
        margin-top: 4px;
      }

      .print-progress {
        margin-top: 4px;
        font-size: 9pt;
      }

      .print-footer {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #ccc;
      }

      .print-notes {
        margin-top: 16px;
      }

      .print-notes-line {
        border-bottom: 1px solid #ccc;
        height: 24px;
        margin-bottom: 8px;
      }
    }

    /* On screen, hide the print portal */
    @media screen {
      #print-portal-root {
        position: fixed;
        left: -9999px;
        top: 0;
        width: 210mm;
        background: white;
      }
    }
  `;

  // Sort batches: incomplete first, then by sort order
  const sortedBatches = [...worksheet.batches].sort((a, b) => {
    if (a.completedAt && !b.completedAt) return 1;
    if (!a.completedAt && b.completedAt) return -1;
    return a.sortOrder - b.sortOrder;
  });

  const content = (
    <>
      <style>{printStyles}</style>
      <div className="print-content">
        <div className="print-group">
          {/* Header */}
          <div className="print-header">
            <div>
              <h1 className="print-title">EXECUTION WORKSHEET - {worksheet.name}</h1>
              <p className="print-subtitle">
                {worksheet.description ?? "Batch execution checklist"}
              </p>
              <p className="print-progress">
                Progress: {worksheet.progress.completed} of {worksheet.progress.total} batches completed
                {worksheet.status === "completed" && " (COMPLETE)"}
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "10pt" }}>
              <div>
                <strong>Date:</strong> {today}
              </div>
              {worksheet.scheduledDate && (
                <div>
                  <strong>Scheduled:</strong>{" "}
                  {format(new Date(worksheet.scheduledDate), "dd/MM/yyyy")}
                </div>
              )}
              <div>
                <strong>Batches:</strong> {worksheet.batches.length}
              </div>
              <div>
                <strong>Total Plants:</strong> {totalPlants.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Batch table */}
          {worksheet.batches.length === 0 ? (
            <p style={{ fontStyle: "italic", color: "#666" }}>
              No batches in this worksheet.
            </p>
          ) : (
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th>Variety</th>
                  <th style={{ width: "80px" }}>Size</th>
                  <th style={{ width: "80px", textAlign: "right" }}>Qty</th>
                  <th style={{ width: "80px" }}>Status</th>
                  <th style={{ width: "50px", textAlign: "center" }}>Done</th>
                  <th style={{ width: "150px" }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {sortedBatches.map((wb, index) => {
                  const batch = wb.batch;
                  const isCompleted = wb.completedAt !== null;

                  return (
                    <tr
                      key={wb.batchId}
                      className={isCompleted ? "print-completed-row" : undefined}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <strong>{batch?.plantVarietyName ?? "Unknown"}</strong>
                        {batch?.batchCode && (
                          <span style={{ color: "#666", marginLeft: "8px" }}>
                            #{batch.batchCode}
                          </span>
                        )}
                      </td>
                      <td>{batch?.sizeName ?? "-"}</td>
                      <td className="text-right">
                        {(batch?.quantity ?? 0).toLocaleString()}
                      </td>
                      <td>{batch?.status ?? "-"}</td>
                      <td className="text-center">
                        <span
                          className={
                            isCompleted ? "print-checkbox-checked" : "print-checkbox"
                          }
                        />
                      </td>
                      <td>{wb.notes ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Footer */}
          <div className="print-footer">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                <strong>Total:</strong> {worksheet.batches.length} batch
                {worksheet.batches.length !== 1 ? "es" : ""},{" "}
                {totalPlants.toLocaleString()} plants
              </span>
              <span style={{ color: "#666" }}>
                Printed: {format(new Date(), "dd MMM yyyy HH:mm")}
              </span>
            </div>

            {/* Notes section */}
            <div className="print-notes">
              <p style={{ marginBottom: "8px" }}>
                <strong>Staff Notes:</strong>
              </p>
              <div className="print-notes-line" />
              <div className="print-notes-line" />
              <div className="print-notes-line" />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Create or get portal root element
  React.useEffect(() => {
    let portalRoot = document.getElementById("print-portal-root");
    if (!portalRoot) {
      portalRoot = document.createElement("div");
      portalRoot.id = "print-portal-root";
      document.body.appendChild(portalRoot);
    }
    return () => {
      // Don't remove on cleanup - other print components might use it
    };
  }, []);

  if (!mounted) return null;

  const portalRoot = document.getElementById("print-portal-root");
  if (!portalRoot) return null;

  return createPortal(content, portalRoot);
}
