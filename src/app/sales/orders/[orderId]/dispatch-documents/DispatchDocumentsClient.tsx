'use client';

import { Button } from '@/components/ui/button';
import { Printer, FileText, Truck } from 'lucide-react';
import Image from 'next/image';

interface DocumentItem {
  id: string;
  description: string;
  quantity: number;
  pickedQty: number;
  unitPrice: number;
  vatRate: number;
  total: number;
  varietyName: string | null;
  sizeName: string | null;
  familyName: string | null;
  batchNumber: string | null;
  skuCode: string | null;
}

interface DispatchDocumentsData {
  order: {
    orderNumber: string;
    status: string;
    requestedDeliveryDate: string;
    notes: string | null;
  };
  invoice: {
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    subtotalExVat: number;
    vatAmount: number;
    totalIncVat: number;
    balanceDue: number;
    notes: string | null;
  };
  customer: {
    name: string;
    address: string;
    addressLines: string[];
    phone: string | null;
    email: string | null;
    vatNumber: string | null;
  };
  items: DocumentItem[];
  vatSummary: Array<{
    rate: number;
    total: number;
    vat: number;
  }>;
  company: {
    name: string;
    address: string;
    email: string;
    phone: string;
    website: string;
    vatNumber: string;
    companyRegNumber: string;
    logoUrl: string | null;
  };
  bank: {
    bankName: string;
    bankIban: string;
    bankBic: string;
  };
  invoiceSettings: {
    footerText: string;
  };
  generatedAt: string;
}

interface DispatchDocumentsClientProps {
  data: DispatchDocumentsData;
}

// Delivery Docket Component
function DeliveryDocket({ 
  data, 
  copyNumber 
}: { 
  data: DispatchDocumentsData; 
  copyNumber: 1 | 2;
}) {
  const { company, customer, order, items } = data;
  const addressLines = company.address ? company.address.split('\n').filter(Boolean) : [];
  const copyLabel = copyNumber === 1 ? 'Customer Copy' : 'Driver Copy';

  return (
    <div className="document-page bg-white p-8 relative">
      {/* Copy Label */}
      <div className="absolute top-4 right-4 bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium">
        {copyLabel}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start border-b-4 border-blue-600 pb-4 mb-6">
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
            <h1 className="text-2xl font-bold text-blue-600 mb-1">{company.name}</h1>
            {addressLines.map((line, i) => (
              <p key={i} className="text-gray-500 text-xs">{line}</p>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <Truck className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-light tracking-widest text-gray-700 uppercase">Delivery Docket</h2>
          </div>
          <div className="text-lg font-semibold text-blue-600 mt-1">{order.orderNumber}</div>
        </div>
      </div>

      {/* Delivery Details */}
      <div className="bg-blue-50 p-4 rounded mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Order Number</label>
            <span className="font-semibold text-sm">{order.orderNumber}</span>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Delivery Date</label>
            <span className="font-semibold text-sm">{order.requestedDeliveryDate}</span>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Status</label>
            <span className="font-semibold text-sm capitalize">{order.status.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>

      {/* Deliver To */}
      <div className="mb-6 border rounded p-4 bg-gray-50">
        <h3 className="text-xs uppercase tracking-wide text-blue-600 border-b border-gray-200 pb-2 mb-3">Deliver To</h3>
        <p className="font-semibold text-lg">{customer.name}</p>
        {customer.addressLines.map((line, i) => (
          <p key={i} className="text-sm text-gray-600">{line}</p>
        ))}
        {customer.phone && <p className="text-sm text-gray-600 mt-2">Tel: {customer.phone}</p>}
      </div>

      {/* Items Table */}
      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="bg-blue-600 text-white">
            <th className="py-2 px-2 text-left text-xs uppercase tracking-wide">Item</th>
            <th className="py-2 px-2 text-left text-xs uppercase tracking-wide w-24">Family</th>
            <th className="py-2 px-2 text-left text-xs uppercase tracking-wide w-24">Batch</th>
            <th className="py-2 px-2 text-center text-xs uppercase tracking-wide w-16">Ordered</th>
            <th className="py-2 px-2 text-center text-xs uppercase tracking-wide w-16">Picked</th>
            <th className="py-2 px-2 text-center text-xs uppercase tracking-wide w-20">Received</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className={index % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="py-2 px-2 border-b border-gray-200">
                <div className="font-medium">{item.description}</div>
                {item.skuCode && (
                  <div className="text-xs text-gray-400">SKU: {item.skuCode}</div>
                )}
              </td>
              <td className="py-2 px-2 border-b border-gray-200 text-gray-600">
                {item.familyName || '-'}
              </td>
              <td className="py-2 px-2 border-b border-gray-200 text-gray-600">
                {item.batchNumber || '-'}
              </td>
              <td className="py-2 px-2 border-b border-gray-200 text-center">{item.quantity}</td>
              <td className="py-2 px-2 border-b border-gray-200 text-center font-medium">{item.pickedQty}</td>
              <td className="py-2 px-2 border-b border-gray-200 text-center">
                <div className="border border-gray-300 rounded h-6 bg-white"></div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-semibold">
            <td colSpan={3} className="py-2 px-2 text-right">Total:</td>
            <td className="py-2 px-2 text-center">{items.reduce((sum, i) => sum + i.quantity, 0)}</td>
            <td className="py-2 px-2 text-center">{items.reduce((sum, i) => sum + i.pickedQty, 0)}</td>
            <td className="py-2 px-2"></td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {order.notes && (
        <div className="bg-amber-50 p-3 rounded mb-4 border border-amber-200">
          <h4 className="text-xs uppercase tracking-wide text-amber-700 mb-1">Delivery Notes</h4>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-6 mt-6 border-t pt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Received by (print name)</p>
          <div className="border-b border-gray-400 h-8"></div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Signature</p>
          <div className="border-b border-gray-400 h-8"></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mt-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Date</p>
          <div className="border-b border-gray-400 h-8"></div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Time</p>
          <div className="border-b border-gray-400 h-8"></div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-gray-200 text-center text-gray-400 text-xs">
        <p>{company.name} • {company.phone} • {company.email}</p>
      </div>
    </div>
  );
}

// Invoice Component
function Invoice({ 
  data, 
  copyNumber 
}: { 
  data: DispatchDocumentsData; 
  copyNumber: 1 | 2;
}) {
  const { company, customer, invoice, items, vatSummary, bank, invoiceSettings } = data;
  const addressLines = company.address ? company.address.split('\n').filter(Boolean) : [];
  const hasBankInfo = bank.bankName || bank.bankIban || bank.bankBic;
  const copyLabel = copyNumber === 1 ? 'Customer Copy' : 'Accounts Copy';

  return (
    <div className="document-page bg-white p-8 relative">
      {/* Copy Label */}
      <div className="absolute top-4 right-4 bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-medium">
        {copyLabel}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start border-b-4 border-green-600 pb-4 mb-6">
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
            <h1 className="text-2xl font-bold text-green-600 mb-1">{company.name}</h1>
            {addressLines.map((line, i) => (
              <p key={i} className="text-gray-500 text-xs">{line}</p>
            ))}
            {company.vatNumber && <p className="text-gray-500 text-xs">VAT: {company.vatNumber}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <FileText className="h-6 w-6 text-green-600" />
            <h2 className="text-2xl font-light tracking-widest text-gray-700 uppercase">Invoice</h2>
          </div>
          <div className="text-lg font-semibold text-green-600 mt-1">{invoice.invoiceNumber}</div>
        </div>
      </div>

      {/* Invoice Meta */}
      <div className="bg-gray-50 p-3 rounded mb-5">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Invoice Date</label>
            <span className="font-semibold text-sm">{invoice.issueDate}</span>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Due Date</label>
            <span className="font-semibold text-sm">{invoice.dueDate}</span>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Order Reference</label>
            <span className="font-semibold text-sm">{data.order.orderNumber}</span>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Status</label>
            <span className="font-semibold text-sm capitalize">{invoice.status}</span>
          </div>
        </div>
      </div>

      {/* Bill To / From */}
      <div className="grid grid-cols-2 gap-8 mb-5">
        <div>
          <h3 className="text-xs uppercase tracking-wide text-green-600 border-b border-gray-200 pb-1 mb-2">Bill To</h3>
          <p className="font-semibold">{customer.name}</p>
          <p className="text-sm text-gray-600">{customer.address}</p>
          {customer.phone && <p className="text-sm text-gray-600">Tel: {customer.phone}</p>}
          {customer.vatNumber && <p className="text-sm text-gray-600">VAT: {customer.vatNumber}</p>}
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wide text-green-600 border-b border-gray-200 pb-1 mb-2">From</h3>
          <p className="font-semibold">{company.name}</p>
          {addressLines.map((line, i) => (
            <p key={i} className="text-sm text-gray-600">{line}</p>
          ))}
          {company.phone && <p className="text-sm text-gray-600">Tel: {company.phone}</p>}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-4 text-sm">
        <thead>
          <tr className="bg-green-600 text-white">
            <th className="py-2 px-2 text-left text-xs uppercase tracking-wide">Description</th>
            <th className="py-2 px-2 text-right text-xs uppercase tracking-wide w-14">Qty</th>
            <th className="py-2 px-2 text-right text-xs uppercase tracking-wide w-18">Unit Price</th>
            <th className="py-2 px-2 text-right text-xs uppercase tracking-wide w-14">VAT %</th>
            <th className="py-2 px-2 text-right text-xs uppercase tracking-wide w-18">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className={index % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="py-1.5 px-2 border-b border-gray-200">
                <div className="font-medium">{item.description}</div>
              </td>
              <td className="py-1.5 px-2 border-b border-gray-200 text-right">{item.pickedQty}</td>
              <td className="py-1.5 px-2 border-b border-gray-200 text-right">€{item.unitPrice.toFixed(2)}</td>
              <td className="py-1.5 px-2 border-b border-gray-200 text-right">{item.vatRate}%</td>
              <td className="py-1.5 px-2 border-b border-gray-200 text-right">€{item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals and VAT Summary side by side */}
      <div className="flex justify-between mb-4">
        {/* VAT Summary */}
        <div>
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-1">VAT Summary</h4>
          <table className="text-xs">
            <thead>
              <tr>
                <th className="py-1 px-2 text-left">Rate</th>
                <th className="py-1 px-2 text-right">Net</th>
                <th className="py-1 px-2 text-right">VAT</th>
              </tr>
            </thead>
            <tbody>
              {vatSummary.map((vat) => (
                <tr key={vat.rate}>
                  <td className="py-0.5 px-2">{vat.rate}%</td>
                  <td className="py-0.5 px-2 text-right">€{vat.total.toFixed(2)}</td>
                  <td className="py-0.5 px-2 text-right">€{vat.vat.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="w-56">
          <div className="flex justify-between py-1 border-b border-gray-200 text-sm">
            <span>Subtotal (ex VAT)</span>
            <span>€{invoice.subtotalExVat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-200 text-sm">
            <span>VAT</span>
            <span>€{invoice.vatAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 border-t-2 border-green-600 mt-1 font-bold">
            <span>Total</span>
            <span>€{invoice.totalIncVat.toFixed(2)}</span>
          </div>
          {invoice.balanceDue > 0 && (
            <div className="flex justify-between py-2 bg-amber-100 -mx-2 px-2 rounded mt-1 text-sm">
              <span>Balance Due</span>
              <span className="font-bold">€{invoice.balanceDue.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Info */}
      {hasBankInfo && (
        <div className="bg-green-50 p-3 rounded border-l-4 border-green-600 mb-4 text-sm">
          <h4 className="font-semibold text-green-600 mb-1">Payment Information</h4>
          <div className="grid grid-cols-3 gap-2 text-gray-600">
            {bank.bankName && <p>Bank: {bank.bankName}</p>}
            {bank.bankIban && <p>IBAN: {bank.bankIban}</p>}
            {bank.bankBic && <p>BIC: {bank.bankBic}</p>}
          </div>
          <p className="text-gray-600 mt-1">Reference: {invoice.invoiceNumber}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 text-center text-gray-400 text-xs">
        {invoiceSettings.footerText ? (
          <p className="whitespace-pre-line">{invoiceSettings.footerText}</p>
        ) : (
          <>
            <p>Thank you for your business!</p>
            {company.companyRegNumber && (
              <p>{company.name} • Registered in Ireland • Company No. {company.companyRegNumber}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DispatchDocumentsClient({ data }: DispatchDocumentsClientProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
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
          }
          .document-page {
            page-break-after: always;
            page-break-inside: avoid;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .document-page:last-child {
            page-break-after: auto;
          }
        }
        
        @media screen {
          .print-container {
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
          }
          .document-page {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }
        }
      `}</style>

      {/* Print Controls - Fixed position on screen */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <Button 
          onClick={handlePrint} 
          className="gap-2 bg-green-600 hover:bg-green-700 shadow-lg"
          size="lg"
        >
          <Printer className="h-5 w-5" />
          Print All Documents
        </Button>
      </div>

      {/* Document Summary - Screen only */}
      <div className="no-print max-w-900px mx-auto px-5 pt-4 pb-2">
        <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Dispatch Documents</h1>
          <p className="text-blue-100">Order: {data.order.orderNumber} • Customer: {data.customer.name}</p>
          <div className="mt-4 flex gap-4 text-sm">
            <div className="bg-white/20 rounded px-3 py-1">
              <Truck className="h-4 w-4 inline mr-1" />
              2× Delivery Dockets
            </div>
            <div className="bg-white/20 rounded px-3 py-1">
              <FileText className="h-4 w-4 inline mr-1" />
              2× Invoices
            </div>
          </div>
        </div>
      </div>

      {/* Print Container with all documents */}
      <div className="print-container">
        {/* Delivery Docket - Customer Copy */}
        <DeliveryDocket data={data} copyNumber={1} />
        
        {/* Delivery Docket - Driver Copy */}
        <DeliveryDocket data={data} copyNumber={2} />
        
        {/* Invoice - Customer Copy */}
        <Invoice data={data} copyNumber={1} />
        
        {/* Invoice - Accounts Copy */}
        <Invoice data={data} copyNumber={2} />
      </div>

      {/* Footer info - Screen only */}
      <div className="no-print max-w-900px mx-auto px-5 pb-8 text-center text-gray-500 text-sm">
        <p>Generated on {data.generatedAt}</p>
        <p className="mt-1">Click "Print All Documents" to print 2 delivery dockets and 2 invoices</p>
      </div>
    </>
  );
}

