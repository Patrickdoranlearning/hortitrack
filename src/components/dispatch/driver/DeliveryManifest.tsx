'use client';

import { forwardRef } from 'react';
import { format } from 'date-fns';

interface DeliveryStop {
  id: string;
  sequenceNumber: number;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  address?: {
    line1: string;
    line2?: string;
    city?: string;
    county?: string;
    eircode?: string;
  };
  trolleysDelivered: number;
  trolleysReturned: number;
  trolleysOutstanding: number;
  status: string;
  deliveryNotes?: string;
  estimatedDeliveryTime?: string;
  actualDeliveryTime?: string;
}

interface DeliveryManifestProps {
  runNumber: string;
  runDate: string;
  driverName?: string;
  vehicleRegistration?: string;
  haulierName?: string;
  stops: DeliveryStop[];
  totalTrolleys: number;
}

/**
 * Printable delivery manifest for drivers
 * Designed for A4 paper, includes signature lines
 */
export const DeliveryManifest = forwardRef<HTMLDivElement, DeliveryManifestProps>(
  function DeliveryManifest(
    { runNumber, runDate, driverName, vehicleRegistration, haulierName, stops, totalTrolleys },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 max-w-[210mm] mx-auto font-sans text-sm"
        style={{ lineHeight: 1.4 }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-black">
          <div>
            <h1 className="text-2xl font-bold mb-1">DELIVERY MANIFEST</h1>
            <p className="text-lg font-semibold">{runNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{format(new Date(runDate), 'EEEE, d MMMM yyyy')}</p>
            {driverName && <p>Driver: {driverName}</p>}
            {vehicleRegistration && <p>Vehicle: {vehicleRegistration}</p>}
            {haulierName && <p>Haulier: {haulierName}</p>}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-100 rounded">
          <div className="text-center">
            <p className="text-2xl font-bold">{stops.length}</p>
            <p className="text-xs text-gray-600">Total Stops</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalTrolleys}</p>
            <p className="text-xs text-gray-600">Total Trolleys</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {stops.reduce((sum, s) => sum + s.trolleysOutstanding, 0)}
            </p>
            <p className="text-xs text-gray-600">Outstanding Returns</p>
          </div>
        </div>

        {/* Delivery Stops */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-black bg-gray-100">
              <th className="text-left p-2 w-8">#</th>
              <th className="text-left p-2">Customer</th>
              <th className="text-left p-2">Address</th>
              <th className="text-center p-2 w-20">Trolleys</th>
              <th className="text-center p-2 w-24">Signature</th>
            </tr>
          </thead>
          <tbody>
            {stops.map((stop, index) => (
              <tr key={stop.id} className="border-b border-gray-300">
                <td className="p-2 font-bold">{stop.sequenceNumber || index + 1}</td>
                <td className="p-2">
                  <div className="font-semibold">{stop.customerName}</div>
                  <div className="text-xs text-gray-600">
                    Order: {stop.orderNumber}
                  </div>
                  {stop.customerPhone && (
                    <div className="text-xs text-gray-600">
                      Tel: {stop.customerPhone}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {stop.address ? (
                    <div className="text-xs">
                      <div>{stop.address.line1}</div>
                      {stop.address.line2 && <div>{stop.address.line2}</div>}
                      <div>
                        {[stop.address.city, stop.address.county].filter(Boolean).join(', ')}
                      </div>
                      {stop.address.eircode && (
                        <div className="font-mono">{stop.address.eircode}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">No address</span>
                  )}
                  {stop.deliveryNotes && (
                    <div className="text-xs text-orange-600 mt-1 italic">
                      Note: {stop.deliveryNotes}
                    </div>
                  )}
                </td>
                <td className="p-2 text-center">
                  <div className="font-bold text-lg">{stop.trolleysDelivered}</div>
                  {stop.trolleysOutstanding > 0 && (
                    <div className="text-xs text-red-600">
                      ({stop.trolleysOutstanding} due back)
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {/* Signature box */}
                  <div className="border border-gray-300 h-12 rounded"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Trolley Returns Section */}
        <div className="mb-6 p-4 border border-gray-300 rounded">
          <h3 className="font-bold mb-2">Trolley Returns</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Customer</th>
                <th className="text-center py-1">Delivered</th>
                <th className="text-center py-1">Returned</th>
                <th className="text-center py-1">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((stop) => (
                <tr key={stop.id} className="border-b border-gray-200">
                  <td className="py-1">{stop.customerName}</td>
                  <td className="text-center py-1">{stop.trolleysDelivered}</td>
                  <td className="text-center py-1">
                    {/* Empty box for driver to fill in */}
                    <span className="inline-block w-8 h-6 border border-gray-300 rounded"></span>
                  </td>
                  <td className="text-center py-1">
                    {stop.trolleysOutstanding > 0 ? stop.trolleysOutstanding : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Driver Notes */}
        <div className="mb-6">
          <h3 className="font-bold mb-2">Driver Notes</h3>
          <div className="border border-gray-300 rounded p-2 min-h-[80px]"></div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-end pt-4 border-t border-gray-300">
          <div>
            <p className="text-xs text-gray-600">
              Printed: {format(new Date(), 'PPp')}
            </p>
          </div>
          <div className="text-right">
            <div className="mb-2">
              <span className="text-xs text-gray-600 mr-2">Driver Signature:</span>
              <span className="inline-block border-b border-gray-400 w-48"></span>
            </div>
            <div>
              <span className="text-xs text-gray-600 mr-2">Date:</span>
              <span className="inline-block border-b border-gray-400 w-32"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
