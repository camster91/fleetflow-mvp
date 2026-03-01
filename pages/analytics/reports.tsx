import React, { useState } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import {
  FileText,
  Download,
  Plus,
  Clock,
  Calendar,
  Mail,
  FileSpreadsheet,
  FileImage,
  File as FilePdf,
  MoreHorizontal,
  Trash2,
  Edit,
  Play,
} from 'lucide-react';
import { notify } from '../../services/notifications';
import { format } from 'date-fns';

interface Report {
  id: string;
  name: string;
  type: 'fleet' | 'maintenance' | 'fuel' | 'driver' | 'custom';
  schedule: 'once' | 'daily' | 'weekly' | 'monthly' | null;
  lastRun: string | null;
  nextRun: string | null;
  format: 'pdf' | 'excel' | 'csv';
  emailRecipients: string[];
}

const reportTemplates = [
  { id: 'fleet-summary', name: 'Fleet Summary Report', type: 'fleet', description: 'Overview of all vehicles and their status' },
  { id: 'maintenance-log', name: 'Maintenance History', type: 'maintenance', description: 'Detailed maintenance records' },
  { id: 'fuel-analysis', name: 'Fuel Consumption Analysis', type: 'fuel', description: 'Fuel efficiency and cost analysis' },
  { id: 'driver-performance', name: 'Driver Performance Report', type: 'driver', description: 'Driver scores and incidents' },
  { id: 'cost-breakdown', name: 'Cost Breakdown', type: 'fleet', description: 'Total cost of ownership analysis' },
];

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      name: 'Weekly Fleet Summary',
      type: 'fleet',
      schedule: 'weekly',
      lastRun: new Date(Date.now() - 86400000 * 2).toISOString(),
      nextRun: new Date(Date.now() + 86400000 * 5).toISOString(),
      format: 'pdf',
      emailRecipients: ['manager@example.com'],
    },
    {
      id: '2',
      name: 'Monthly Maintenance Report',
      type: 'maintenance',
      schedule: 'monthly',
      lastRun: new Date(Date.now() - 86400000 * 15).toISOString(),
      nextRun: new Date(Date.now() + 86400000 * 15).toISOString(),
      format: 'excel',
      emailRecipients: [],
    },
  ]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDeleteReport = (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    setReports(reports.filter(r => r.id !== id));
    notify.success('Report deleted');
  };

  const handleRunReport = (report: Report) => {
    notify.success(`Running ${report.name}...`);
    // Simulate report generation
    setTimeout(() => {
      notify.success(`${report.name} generated successfully`);
    }, 2000);
  };

  const filteredReports = reports.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScheduleLabel = (schedule: string | null) => {
    if (!schedule) return 'On-demand';
    return schedule.charAt(0).toUpperCase() + schedule.slice(1);
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <FilePdf className="h-4 w-4 text-red-500" />;
      case 'excel': return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
      case 'csv': return <FileText className="h-4 w-4 text-blue-500" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Analytics', href: '/analytics' },
        { label: 'Reports' },
      ]}
    >
      <PageHeader
        title="Reports"
        subtitle="Generate and schedule custom reports"
        actions={
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            iconLeft={<Plus className="h-4 w-4" />}
          >
            Create Report
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRunReport(report)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg"
                  title="Run now"
                >
                  <Play className="h-4 w-4 text-slate-600" />
                </button>
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>

            <h3 className="font-semibold text-slate-900 mb-1">{report.name}</h3>
            <Badge variant="default" size="sm" className="mb-3">
              {report.type.charAt(0).toUpperCase() + report.type.slice(1)}
            </Badge>

            <div className="space-y-2 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{getScheduleLabel(report.schedule)}</span>
              </div>
              {report.lastRun && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Last run: {format(new Date(report.lastRun), 'MMM d, yyyy')}</span>
                </div>
              )}
              {report.emailRecipients.length > 0 && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{report.emailRecipients.length} recipient(s)</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {getFormatIcon(report.format)}
                <span className="text-sm font-medium uppercase">{report.format}</span>
              </div>
              <Button variant="ghost" size="sm" iconLeft={<Download className="h-4 w-4" />}>
                Download
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Report Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Report"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Choose a Template
            </label>
            <div className="space-y-3">
              {reportTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`
                    w-full p-4 rounded-lg border text-left transition-all
                    ${selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-5 h-5 rounded-full border flex items-center justify-center
                      ${selectedTemplate === template.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-slate-300'
                      }
                    `}>
                      {selectedTemplate === template.id && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{template.name}</h4>
                      <p className="text-sm text-slate-500">{template.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!selectedTemplate}
              onClick={() => {
                notify.success('Report created successfully');
                setIsCreateModalOpen(false);
              }}
            >
              Create Report
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
