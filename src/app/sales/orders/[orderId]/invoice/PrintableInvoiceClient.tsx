'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import Image from 'next/image';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';

interface InvoiceData {
  invoiceNumber: string;
  status: string;
  currency?: string;
  issueDate: string;
  dueDate: string;
  orderNumber: string;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  balanceDue: number;
  notes: string | null;
  customer: {
    name: string;
    address: string;
    phone: string | null;
    email: string | null;
    vatNumber: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    total: number;
    // Enhanced fields
    varietyName: string | null;
    sizeName: string | null;
    familyName: string | null;
    batchNumber: string | null;
    skuCode: string | null;
  }>;
  fees?: Array<{
    id: string;
    name: string;
    feeType: string;
    quantity: number;
    unitAmount: number;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
  }>;
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
}

interface PrintableInvoiceClientProps {
  invoice: InvoiceData;
}

export default function PrintableInvoiceClient({ invoice }: PrintableInvoiceClientProps) {
  const handlePrint = () => {
    window.print();
  };

  const { company, bank, invoiceSettings } = invoice;
  const hasBankInfo = bank.bankName || bank.bankIban || bank.bankBic;
  const currency = (invoice.currency === 'GBP' ? 'GBP' : 'EUR') as CurrencyCode;
  const fc = (amount: number) => formatCurrency(amount, currency);

  // Parse address into lines for display
  const addressLines = company.address ? company.address.split('\n').filter(Boolean) : [];

  // Check if any items have enhanced plant details
  const hasPlantDetails = invoice.items.some(item => item.familyName || item.batchNumber);

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
        <Button onClick={handlePrint} className="gap-2 bg-green-600 hover:bg-green-700">
          <Printer className="h-4 w-4" />
          Print Invoice
        </Button>
      </div>

      {/* Invoice Content */}
      <div className="print-container bg-white min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-start border-b-4 border-green-600 pb-5 mb-8">
          <div className="flex gap-4">
            {company.logoUrl && (
              <div className="relative h-16 w-16 flex-shrink-0">
                <Image
                  src={company.logoUrl}
                  alt={`${company.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-green-600 mb-1">{company.name}</h1>
              {addressLines.map((line, i) => (
                <p key={i} className="text-gray-500 text-sm">{line}</p>
              ))}
              {company.vatNumber && <p className="text-gray-500 text-sm">VAT: {company.vatNumber}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-4xl font-light tracking-widest text-gray-700 uppercase">Invoice</h2>
            <div className="text-lg font-semibold text-green-600 mt-2">{invoice.invoiceNumber}</div>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="bg-gray-50 p-4 rounded mb-8">
          <div className="grid grid-cols-4 gap-6">
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
              <span className="font-semibold text-sm">{invoice.orderNumber}</span>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Status</label>
              <span className="font-semibold text-sm capitalize">{invoice.status}</span>
            </div>
          </div>
        </div>

        {/* Bill To / From */}
        <div className="grid grid-cols-2 gap-10 mb-8">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-green-600 border-b border-gray-200 pb-2 mb-3">Bill To</h3>
            <p className="font-semibold text-base">{invoice.customer.name}</p>
            <p className="text-sm text-gray-600">{invoice.customer.address}</p>
            {invoice.customer.phone && <p className="text-sm text-gray-600">Tel: {invoice.customer.phone}</p>}
            {invoice.customer.email && <p className="text-sm text-gray-600">Email: {invoice.customer.email}</p>}
            {invoice.customer.vatNumber && <p className="text-sm text-gray-600">VAT: {invoice.customer.vatNumber}</p>}
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-wide text-green-600 border-b border-gray-200 pb-2 mb-3">From</h3>
            <p className="font-semibold text-base">{company.name}</p>
            {addressLines.map((line, i) => (
              <p key={i} className="text-sm text-gray-600">{line}</p>
            ))}
            {company.phone && <p className="text-sm text-gray-600">Tel: {company.phone}</p>}
            {company.email && <p className="text-sm text-gray-600">Email: {company.email}</p>}
            {company.website && <p className="text-sm text-gray-600">{company.website}</p>}
          </div>
        </div>

        {/* Items Table - Enhanced with Family and Batch columns if available */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-green-600 text-white">
              <th className="py-3 px-3 text-left text-xs uppercase tracking-wide">Description</th>
              {hasPlantDetails && (
                <>
                  <th className="py-3 px-3 text-left text-xs uppercase tracking-wide w-28">Family</th>
                  <th className="py-3 px-3 text-left text-xs uppercase tracking-wide w-28">Batch</th>
                </>
              )}
              <th className="py-3 px-3 text-right text-xs uppercase tracking-wide w-16">Qty</th>
              <th className="py-3 px-3 text-right text-xs uppercase tracking-wide w-20">Unit Price</th>
              <th className="py-3 px-3 text-right text-xs uppercase tracking-wide w-16">VAT %</th>
              <th className="py-3 px-3 text-right text-xs uppercase tracking-wide w-20">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 1 ? 'bg-gray-50' : ''}>
                <td className="py-3 px-3 border-b border-gray-200">
                  <div className="font-medium">{item.description}</div>
                  {item.skuCode && (
                    <div className="text-xs text-gray-400">SKU: {item.skuCode}</div>
                  )}
                </td>
                {hasPlantDetails && (
                  <>
                    <td className="py-3 px-3 border-b border-gray-200 text-sm text-gray-600">
                      {item.familyName || '-'}
                    </td>
                    <td className="py-3 px-3 border-b border-gray-200 text-sm text-gray-600">
                      {item.batchNumber || '-'}
                    </td>
                  </>
                )}
                <td className="py-3 px-3 border-b border-gray-200 text-right">{item.quantity}</td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{fc(item.unitPrice)}</td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{item.vatRate}%</td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{fc(item.total)}</td>
              </tr>
            ))}
            {/* Fee lines (pre-pricing, delivery, etc.) */}
            {invoice.fees?.map(fee => (
              <tr key={fee.id} className="bg-green-50/50">
                <td className="py-3 px-3 border-b border-gray-200" colSpan={hasPlantDetails ? 3 : 1}>
                  <div className="font-medium text-gray-700">{fee.name}</div>
                </td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{fee.quantity}</td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{fc(fee.unitAmount)}</td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{fee.vatRate}%</td>
                <td className="py-3 px-3 border-b border-gray-200 text-right">{fc(fee.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* VAT Summary */}
        <div className="mb-8">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">VAT Summary</h4>
          <table className="w-72 text-sm">
            <thead>
              <tr>
                <th className="py-1 px-2 text-left">Rate</th>
                <th className="py-1 px-2 text-right">Net</th>
                <th className="py-1 px-2 text-right">VAT</th>
              </tr>
            </thead>
            <tbody>
              {invoice.vatSummary.map((vat) => (
                <tr key={vat.rate}>
                  <td className="py-1 px-2">{vat.rate}%</td>
                  <td className="py-1 px-2 text-right">{fc(vat.total)}</td>
                  <td className="py-1 px-2 text-right">{fc(vat.vat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span>Subtotal (ex VAT)</span>
              <span>{fc(invoice.subtotalExVat)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span>VAT</span>
              <span>{fc(invoice.vatAmount)}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-green-600 mt-2 text-lg font-bold">
              <span>Total</span>
              <span>{fc(invoice.totalIncVat)}</span>
            </div>
            {invoice.balanceDue > 0 && (
              <div className="flex justify-between py-3 bg-amber-100 -mx-2 px-2 rounded mt-2">
                <span>Balance Due</span>
                <span className="font-bold">{fc(invoice.balanceDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment Info - Only show if bank details are configured */}
        {hasBankInfo && (
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-600 mb-6">
            <h4 className="font-semibold text-green-600 mb-2">Payment Information</h4>
            {bank.bankName && <p className="text-sm text-gray-600">Bank: {bank.bankName}</p>}
            {bank.bankIban && <p className="text-sm text-gray-600">IBAN: {bank.bankIban}</p>}
            {bank.bankBic && <p className="text-sm text-gray-600">BIC: {bank.bankBic}</p>}
            <p className="text-sm text-gray-600">Reference: {invoice.invoiceNumber}</p>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="bg-gray-50 p-4 rounded mb-6">
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Notes</h4>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 pt-5 border-t border-gray-200 text-center text-gray-500 text-xs">
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
    </>
  );
}
