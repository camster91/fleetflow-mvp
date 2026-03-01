import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useSession } from 'next-auth/react';
import { 
  FileText, 
  Download, 
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoicePdf: string | null;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
}

const InvoicesPage: React.FC = () => {
  const { data: session } = useSession();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/subscription/invoices');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch invoices');
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'open':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'uncollectible':
      case 'void':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'uncollectible':
      case 'void':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <DashboardLayout 
      title="Invoices" 
      subtitle="View and download your billing history"
      breadcrumbs={[
        { label: 'Billing', href: '/billing' },
        { label: 'Invoices' },
      ]}
    >
      <div className="space-y-6">
        {/* Back Link */}
        <Link
          href="/billing"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Billing
        </Link>

        {/* Invoices List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Payment History</h2>
            <p className="text-sm text-slate-500 mt-1">
              View and download your past invoices
            </p>
          </div>

          {isLoading ? (
            <div className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No invoices yet</h3>
              <p className="text-slate-500 mt-1">
                Your invoices will appear here once you have a paid subscription.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Billing Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-slate-400 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Invoice #{invoice.id.slice(-8).toUpperCase()}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(invoice.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-slate-600">
                          <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                          {new Date(invoice.periodStart).toLocaleDateString()} - {new Date(invoice.periodEnd).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-slate-900">
                          <DollarSign className="h-4 w-4 mr-1 text-slate-400" />
                          {formatAmount(invoice.amount, invoice.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(invoice.status)}
                          <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(invoice.status)}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {invoice.invoicePdf ? (
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            <Download className="h-4 w-4 mr-1.5" />
                            Download
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">Not available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary Card */}
        {!isLoading && invoices.length > 0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-600">Total Invoices</p>
                <p className="text-2xl font-semibold text-slate-900">{invoices.length}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Paid</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {formatAmount(
                    invoices
                      .filter(inv => inv.status.toLowerCase() === 'paid')
                      .reduce((sum, inv) => sum + inv.amount, 0),
                    'USD'
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Last Payment</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {new Date(invoices[0]?.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default InvoicesPage;
