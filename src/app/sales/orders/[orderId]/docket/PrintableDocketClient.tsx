'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import Image from 'next/image';

interface DocketData {
  orderNumber: string;
  status: string;
  createdAt: string;
  deliveryDate: string | null;
  notes: string | null;
  customer: {
    name: string;
    address: string;
    phone: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
  }>;
  company: {
    name: string;
    address: string;
    phone: string;
    logoUrl: string | null;
  };
}

interface PrintableDocketClientProps {
  docket: DocketData;
}

export default function PrintableDocketClient({ docket }: PrintableDocketClientProps) {
  const handlePrint = () => {
    window.print();
  };

  const { company } = docket;
  const addressLines = company.address ? company.address.split('\n').filter(Boolean) : [];

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          nav, header, footer, aside {
            display: none !important;
          }
          .print-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            background: white;
          }
        }
        
        @media screen {
          .print-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
          }
        }
      `}</style>

      {/* Print Button - Fixed position on screen */}
      <div className="no-print fixed top-4 right-4 z-50">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Docket
        </Button>
      </div>

      {/* Docket Content */}
      <div className="print-container bg-white min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-900 pb-5 mb-5">
          <div className="flex gap-4">
            {company.logoUrl && (
              <div className="relative h-14 w-14 flex-shrink-0">
                <Image
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold mb-1">{company.name}</h1>
              {addressLines.map((line, i) => (
                <p key={i} className="text-gray-500 text-sm">{line}</p>
              ))}
              {!company.address && (
                <p className="text-gray-500 text-sm">Plant Nursery & Garden Centre</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold uppercase tracking-wide">Delivery Docket</h2>
            <div className="text-lg font-bold mt-2">{docket.orderNumber}</div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300 pb-1 mb-3">
              Deliver To
            </h3>
            <p className="font-semibold text-base">{docket.customer.name}</p>
            <p className="text-sm">{docket.customer.address}</p>
            {docket.customer.phone && <p className="text-sm">Tel: {docket.customer.phone}</p>}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300 pb-1 mb-3">
              Order Details
            </h3>
            <p className="text-sm"><strong>Date:</strong> {docket.createdAt}</p>
            {docket.deliveryDate && (
              <p className="text-sm"><strong>Delivery Date:</strong> {docket.deliveryDate}</p>
            )}
            <p className="text-sm"><strong>Status:</strong> {docket.status}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-900">
              <th className="py-3 px-2 text-left text-xs uppercase tracking-wide">Description</th>
              <th className="py-3 px-2 text-center text-xs uppercase tracking-wide w-20">Qty</th>
              <th className="py-3 px-2 text-center text-xs uppercase tracking-wide w-20">Checked</th>
            </tr>
          </thead>
          <tbody>
            {docket.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-3 px-2">{item.description}</td>
                <td className="py-3 px-2 text-center">{item.quantity}</td>
                <td className="py-3 px-2 text-center">
                  <div className="w-5 h-5 border-2 border-gray-900 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Notes */}
        {docket.notes && (
          <div className="bg-gray-50 p-4 rounded mb-8">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Notes</h4>
            <p className="text-sm">{docket.notes}</p>
          </div>
        )}

        {/* Signature Section */}
        <div className="grid grid-cols-2 gap-10 mt-10 pt-5 border-t border-gray-300">
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-10">Packed By</h4>
            <div className="border-b border-gray-900 mb-2" />
            <p className="text-xs text-gray-500">Name & Date</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-10">Received By</h4>
            <div className="border-b border-gray-900 mb-2" />
            <p className="text-xs text-gray-500">Customer Signature & Date</p>
          </div>
        </div>
      </div>
    </>
  );
}
