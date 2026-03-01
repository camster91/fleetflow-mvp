import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Server,
  Database,
  Globe,
  Mail,
  Bell,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  uptime: number;
  lastChecked: string;
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'critical' | 'major' | 'minor';
  startedAt: string;
  resolvedAt?: string;
  updates: {
    time: string;
    message: string;
  }[];
}

const services: ServiceStatus[] = [
  { name: 'Web Application', status: 'operational', uptime: 99.99, lastChecked: '2 min ago' },
  { name: 'API', status: 'operational', uptime: 99.98, lastChecked: '2 min ago' },
  { name: 'Database', status: 'operational', uptime: 99.99, lastChecked: '1 min ago' },
  { name: 'Authentication', status: 'operational', uptime: 99.97, lastChecked: '2 min ago' },
  { name: 'Email Notifications', status: 'operational', uptime: 99.95, lastChecked: '5 min ago' },
  { name: 'File Storage', status: 'operational', uptime: 99.99, lastChecked: '3 min ago' },
];

const incidents: Incident[] = [
  {
    id: '1',
    title: 'Delayed Email Notifications',
    status: 'resolved',
    severity: 'minor',
    startedAt: '2024-02-10T14:30:00Z',
    resolvedAt: '2024-02-10T15:45:00Z',
    updates: [
      { time: '2024-02-10T15:45:00Z', message: 'Issue resolved. Email queue is now processing normally.' },
      { time: '2024-02-10T14:45:00Z', message: 'Identified issue with email provider. Working on a fix.' },
      { time: '2024-02-10T14:30:00Z', message: 'Investigating delays in email notifications.' },
    ],
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'operational':
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    case 'degraded':
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    case 'down':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'maintenance':
      return <Clock className="h-5 w-5 text-blue-500" />;
    default:
      return <CheckCircle className="h-5 w-5" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'success' | 'warning' | 'danger' | 'primary'> = {
    operational: 'success',
    degraded: 'warning',
    down: 'danger',
    maintenance: 'primary',
  };
  return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'text-red-600 bg-red-50';
    case 'major':
      return 'text-orange-600 bg-orange-50';
    case 'minor':
      return 'text-amber-600 bg-amber-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
};

export default function StatusPage() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const allOperational = services.every(s => s.status === 'operational');

  return (
    <DashboardLayout>
      <PageHeader
        title="System Status"
        subtitle="Real-time status of FleetFlow services"
      />

      {/* Overall Status */}
      <Card className={`mb-8 ${allOperational ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${allOperational ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              {allOperational ? (
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              ) : (
                <AlertCircle className="h-8 w-8 text-amber-600" />
              )}
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${allOperational ? 'text-emerald-900' : 'text-amber-900'}`}>
                {allOperational ? 'All Systems Operational' : 'Some Systems Degraded'}
              </h2>
              <p className={allOperational ? 'text-emerald-700' : 'text-amber-700'}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            iconLeft={<RefreshCw className="h-4 w-4" />}
            onClick={() => setLastUpdated(new Date())}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Services Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Services</h3>
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="font-medium text-slate-900">{service.name}</p>
                    <p className="text-xs text-slate-500">
                      Uptime: {service.uptime}% • Checked {service.lastChecked}
                    </p>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            ))}
          </div>
        </Card>

        {/* Uptime Stats */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Uptime History</h3>
          <div className="space-y-4">
            {['30 days', '60 days', '90 days'].map((period) => (
              <div key={period} className="flex items-center justify-between">
                <span className="text-slate-600">Last {period}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: '99.9%' }}
                    />
                  </div>
                  <span className="font-medium text-slate-900">99.9%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <h4 className="text-sm font-medium text-slate-900 mb-3">Monthly Uptime</h4>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 30 }, (_, i) => (
                <div
                  key={i}
                  className={`h-8 rounded ${Math.random() > 0.95 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  title={`Day ${i + 1}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Incident History */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Incident History</h3>
          <Button variant="ghost" size="sm" iconLeft={<ExternalLink className="h-4 w-4" />}>
            Subscribe to Updates
          </Button>
        </div>

        {incidents.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
            <p className="text-slate-600">No incidents in the past 90 days</p>
          </div>
        ) : (
          <div className="space-y-6">
            {incidents.map((incident) => (
              <div key={incident.id} className="border-l-4 border-amber-400 pl-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-slate-900">{incident.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={incident.status === 'resolved' ? 'success' : 'warning'}>
                        {incident.status}
                      </Badge>
                      <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-slate-500">
                    {new Date(incident.startedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-2 mt-3">
                  {incident.updates.map((update, index) => (
                    <div key={index} className="text-sm">
                      <span className="text-slate-400">
                        {new Date(update.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-slate-600 ml-3">{update.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
