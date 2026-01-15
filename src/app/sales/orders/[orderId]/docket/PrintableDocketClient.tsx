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
            padding: 16px;
            background: white;
          }
        }

        @media screen and (max-width: 640px) {
          .print-container {
            padding: 12px;
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
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-gray-900 pb-5 mb-5">
          <div className="flex gap-3 sm:gap-4">
            {company.logoUrl && (
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0">
                <Image
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold mb-1">{company.name}</h1>
              {addressLines.map((line, i) => (
                <p key={i} className="text-gray-500 text-xs sm:text-sm">{line}</p>
              ))}
              {!company.address && (
                <p className="text-gray-500 text-xs sm:text-sm">Plant Nursery & Garden Centre</p>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            <h2 className="text-lg sm:text-xl font-semibold uppercase tracking-wide">Delivery Docket</h2>
            <div className="text-base sm:text-lg font-bold mt-1 sm:mt-2">{docket.orderNumber}</div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300 pb-1 mb-2 sm:mb-3">
              Deliver To
            </h3>
            <p className="font-semibold text-sm sm:text-base">{docket.customer.name}</p>
            <p className="text-xs sm:text-sm">{docket.customer.address}</p>
            {docket.customer.phone && <p className="text-xs sm:text-sm">Tel: {docket.customer.phone}</p>}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300 pb-1 mb-2 sm:mb-3">
              Order Details
            </h3>
            <p className="text-xs sm:text-sm"><strong>Date:</strong> {docket.createdAt}</p>
            {docket.deliveryDate && (
              <p className="text-xs sm:text-sm"><strong>Delivery Date:</strong> {docket.deliveryDate}</p>
            )}
            <p className="text-xs sm:text-sm"><strong>Status:</strong> {docket.status}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto mb-6 sm:mb-8">
          <table className="w-full min-w-[300px]">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-900">
                <th className="py-2 sm:py-3 px-2 text-left text-xs uppercase tracking-wide">Description</th>
                <th className="py-2 sm:py-3 px-2 text-center text-xs uppercase tracking-wide w-16 sm:w-20">Qty</th>
                <th className="py-2 sm:py-3 px-2 text-center text-xs uppercase tracking-wide w-16 sm:w-20">Checked</th>
              </tr>
            </thead>
            <tbody>
              {docket.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm">{item.description}</td>
                  <td className="py-2 sm:py-3 px-2 text-center text-xs sm:text-sm">{item.quantity}</td>
                  <td className="py-2 sm:py-3 px-2 text-center">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-gray-900 mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {docket.notes && (
          <div className="bg-gray-50 p-3 sm:p-4 rounded mb-6 sm:mb-8">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1 sm:mb-2">Notes</h4>
            <p className="text-xs sm:text-sm">{docket.notes}</p>
          </div>
        )}

        {/* Signature Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10 mt-6 sm:mt-10 pt-4 sm:pt-5 border-t border-gray-300">
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-6 sm:mb-10">Packed By</h4>
            <div className="border-b border-gray-900 mb-2" />
            <p className="text-xs text-gray-500">Name & Date</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-6 sm:mb-10">Received By</h4>
            <div className="border-b border-gray-900 mb-2" />
            <p className="text-xs text-gray-500">Customer Signature & Date</p>
          </div>
        </div>
      </div>
    </>
  );
}
