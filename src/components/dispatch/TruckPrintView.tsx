'use client';

import { forwardRef } from 'react';
import { TruckLayout, getStopColor, STOP_COLORS } from './TruckVisualization';
import { TrolleySlotData } from './TruckSlot';
import { DeliveryStop } from './DeliveryStopCard';
import { format } from 'date-fns';

interface TruckPrintViewProps {
  layout: TruckLayout;
  trolleys: TrolleySlotData[];
  stops: DeliveryStop[];
  runNumber: string;
  runDate: string;
  driverName?: string;
  vehicleRegistration?: string;
}

const TruckPrintView = forwardRef<HTMLDivElement, TruckPrintViewProps>(
  ({ layout, trolleys, stops, runNumber, runDate, driverName, vehicleRegistration }, ref) => {
    // Create a map of slot index to trolley data
    const trolleyMap = new Map<number, TrolleySlotData>();
    trolleys.forEach((trolley, idx) => {
      const slotIndex = trolley.slotIndex ?? idx;
      trolleyMap.set(slotIndex, trolley);
    });

    // Get unique stops for legend
    const uniqueStops = new Map<string, { name: string; orderNumber: string; colorIndex: number; trolleyCount: number }>();
    stops.forEach((stop, idx) => {
      const stopTrolleys = trolleys.filter(t => t.customerName === stop.customerName);
      if (!uniqueStops.has(stop.customerName)) {
        uniqueStops.set(stop.customerName, {
          name: stop.customerName,
          orderNumber: stop.orderNumber,
          colorIndex: idx,
          trolleyCount: stopTrolleys.length,
        });
      }
    });

    // Calculate grid dimensions for print
    const cellSize = 35;
    const gap = 3;
    const gridWidth = layout.columns * (cellSize + gap) - gap;
    const gridHeight = layout.rows * (cellSize + gap) - gap;

    // Map Tailwind colors to print-safe colors
    const colorMap: Record<string, string> = {
      'bg-blue-500': '#3b82f6',
      'bg-green-500': '#22c55e',
      'bg-orange-500': '#f97316',
      'bg-purple-500': '#a855f7',
      'bg-pink-500': '#ec4899',
      'bg-cyan-500': '#06b6d4',
      'bg-amber-500': '#f59e0b',
      'bg-red-500': '#ef4444',
      'bg-indigo-500': '#6366f1',
      'bg-teal-500': '#14b8a6',
    };

    const getColor = (index: number) => {
      const color = STOP_COLORS[index % STOP_COLORS.length];
      return colorMap[color.bg] || '#94a3b8';
    };

    return (
      <div
        ref={ref}
        className="print-view bg-white p-8"
        style={{
          width: '210mm', // A4 width
          minHeight: '297mm', // A4 height
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{runNumber}</h1>
              <p className="text-gray-600">{format(new Date(runDate), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <div className="text-right">
              {driverName && <p><strong>Driver:</strong> {driverName}</p>}
              {vehicleRegistration && <p><strong>Vehicle:</strong> {vehicleRegistration}</p>}
              <p className="text-sm text-gray-500">Printed: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
        </div>

        {/* Truck Diagram */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Truck Loading Diagram</h2>
          <div className="flex items-center gap-4">
            {/* Cab */}
            <div className="flex flex-col items-center">
              <div
                className="border-2 border-gray-400 bg-gray-200 rounded"
                style={{ width: 50, height: 60 }}
              >
                <div className="text-[8px] text-center mt-1 text-gray-500">CAB</div>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">→ FRONT</div>
            </div>

            {/* Cargo area */}
            <div
              className="border-2 border-gray-400 p-2"
              style={{ width: gridWidth + 20, minWidth: 300 }}
            >
              <div className="text-[10px] text-gray-500 text-center mb-1">REAR (Load First) ←</div>
              <div
                className="grid gap-[3px]"
                style={{
                  gridTemplateColumns: `repeat(${layout.columns}, ${cellSize}px)`,
                  direction: 'rtl', // Reverse so slot 1 is at the back
                }}
              >
                {Array.from({ length: layout.rows * layout.columns }).map((_, index) => {
                  const trolley = trolleyMap.get(index);
                  const colorIndex = trolley?.stopIndex;
                  const bgColor = colorIndex !== undefined ? getColor(colorIndex) : '#f1f5f9';
                  const isEmpty = !trolley;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-center text-[9px] font-medium"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: bgColor,
                        border: isEmpty ? '2px dashed #cbd5e1' : '1px solid #64748b',
                        borderRadius: 3,
                        color: isEmpty ? '#94a3b8' : 'white',
                        direction: 'ltr',
                      }}
                    >
                      {trolley ? (
                        <div className="text-center">
                          {trolley.trolleyNumber && (
                            <div className="font-bold">{trolley.trolleyNumber}</div>
                          )}
                          {trolley.stopIndex !== undefined && (
                            <div className="text-[7px]">Stop {trolley.stopIndex + 1}</div>
                          )}
                        </div>
                      ) : (
                        index + 1
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Legend</h2>
          <div className="grid grid-cols-2 gap-2">
            {Array.from(uniqueStops.values()).map((stop, idx) => (
              <div key={stop.name} className="flex items-center gap-2 text-sm">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getColor(idx) }}
                />
                <span className="font-medium">Stop {idx + 1}:</span>
                <span>{stop.name}</span>
                <span className="text-gray-500">(#{stop.orderNumber}, {stop.trolleyCount} trolleys)</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 rounded"
                style={{ border: '2px dashed #cbd5e1' }}
              />
              <span className="text-gray-500">Empty slot</span>
            </div>
          </div>
        </div>

        {/* Delivery Schedule */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Delivery Schedule</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2 w-12">Stop</th>
                <th className="text-left py-2 px-2">Customer</th>
                <th className="text-left py-2 px-2">Order</th>
                <th className="text-left py-2 px-2">Address</th>
                <th className="text-center py-2 px-2 w-20">Trolleys</th>
                <th className="text-center py-2 px-2 w-20">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((stop, idx) => (
                <tr key={stop.id} className="border-b border-gray-200">
                  <td className="py-2 px-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: getColor(idx) }}
                    >
                      {idx + 1}
                    </div>
                  </td>
                  <td className="py-2 px-2 font-medium">{stop.customerName}</td>
                  <td className="py-2 px-2">#{stop.orderNumber}</td>
                  <td className="py-2 px-2 text-gray-600">
                    {stop.address && (
                      <>
                        {stop.address.line1}
                        {stop.address.city && `, ${stop.address.city}`}
                        {stop.address.eircode && ` ${stop.address.eircode}`}
                      </>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">{stop.trolleysDelivered}</td>
                  <td className="py-2 px-2 text-center">
                    <div className="w-5 h-5 border-2 border-gray-400 rounded mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes section */}
        <div className="mt-6 pt-4 border-t border-gray-300">
          <h2 className="text-lg font-semibold mb-2">Notes</h2>
          <div className="border border-gray-300 rounded p-3 min-h-[80px] bg-gray-50">
            {/* Space for handwritten notes */}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-sm text-gray-500">
          <div className="flex justify-between">
            <span>Total: {trolleys.length} trolleys, {stops.length} stops</span>
            <span>Vehicle capacity: {layout.trolleySlots} slots</span>
          </div>
        </div>

        {/* Print styles */}
        <style jsx>{`
          @media print {
            .print-view {
              width: 100% !important;
              min-height: auto !important;
              padding: 10mm !important;
            }
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}</style>
      </div>
    );
  }
);

TruckPrintView.displayName = 'TruckPrintView';

export default TruckPrintView;

