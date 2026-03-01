import React from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  GitCommit,
  Sparkles,
  Bug,
  Zap,
  Shield,
  ChevronRight,
  Bell,
} from 'lucide-react';

interface Release {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: {
    type: 'feature' | 'improvement' | 'bugfix' | 'security';
    description: string;
  }[];
}

const releases: Release[] = [
  {
    version: '2.5.0',
    date: '2024-02-15',
    type: 'minor',
    changes: [
      { type: 'feature', description: 'New team management system with role-based permissions' },
      { type: 'feature', description: 'Advanced analytics dashboard with custom reports' },
      { type: 'improvement', description: 'Enhanced notification system with real-time updates' },
    ],
  },
  {
    version: '2.4.0',
    date: '2024-01-28',
    type: 'minor',
    changes: [
      { type: 'feature', description: 'Onboarding checklist for new users' },
      { type: 'improvement', description: 'Faster vehicle search and filtering' },
      { type: 'bugfix', description: 'Fixed issue with maintenance reminder emails' },
    ],
  },
  {
    version: '2.3.2',
    date: '2024-01-15',
    type: 'patch',
    changes: [
      { type: 'bugfix', description: 'Resolved GPS tracking sync issue' },
      { type: 'security', description: 'Updated dependencies for security patches' },
    ],
  },
  {
    version: '2.3.0',
    date: '2024-01-08',
    type: 'minor',
    changes: [
      { type: 'feature', description: 'Integration with QuickBooks for expense tracking' },
      { type: 'improvement', description: 'Redesigned dashboard with new widgets' },
      { type: 'improvement', description: 'Mobile app performance improvements' },
    ],
  },
  {
    version: '2.2.0',
    date: '2023-12-20',
    type: 'minor',
    changes: [
      { type: 'feature', description: 'Dark mode support' },
      { type: 'feature', description: 'Bulk vehicle import via CSV' },
      { type: 'bugfix', description: 'Fixed route optimization algorithm' },
    ],
  },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Sparkles className="h-4 w-4" />;
    case 'improvement':
      return <Zap className="h-4 w-4" />;
    case 'bugfix':
      return <Bug className="h-4 w-4" />;
    case 'security':
      return <Shield className="h-4 w-4" />;
    default:
      return <GitCommit className="h-4 w-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'feature':
      return 'bg-purple-100 text-purple-700';
    case 'improvement':
      return 'bg-blue-100 text-blue-700';
    case 'bugfix':
      return 'bg-amber-100 text-amber-700';
    case 'security':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'feature':
      return 'New Feature';
    case 'improvement':
      return 'Improvement';
    case 'bugfix':
      return 'Bug Fix';
    case 'security':
      return 'Security';
    default:
      return type;
  }
};

export default function ChangelogPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Changelog"
        subtitle="Track updates and improvements to FleetFlow"
        actions={
          <Button
            variant="outline"
            iconLeft={<Bell className="h-4 w-4" />}
          >
            Subscribe to Updates
          </Button>
        }
      />

      {/* Current Version */}
      <Card className="mb-8 bg-gradient-to-br from-blue-600 to-blue-700 border-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Current Version</p>
            <h2 className="text-3xl font-bold text-white mt-1">
              FleetFlow {releases[0].version}
            </h2>
            <p className="text-blue-100 mt-2">
              Released {new Date(releases[0].date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="hidden sm:block">
            <Badge variant="success" size="md" className="bg-white/20 text-white border-0">
              Latest
            </Badge>
          </div>
        </div>
      </Card>

      {/* Release History */}
      <div className="space-y-6">
        {releases.map((release, index) => (
          <Card key={release.version}>
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex flex-col items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <GitCommit className="h-5 w-5 text-blue-600" />
                </div>
                {index < releases.length - 1 && (
                  <div className="w-0.5 h-full bg-slate-200 my-2" />
                )}
              </div>

              <div className="flex-1 pb-8">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-bold text-slate-900">
                    Version {release.version}
                  </h3>
                  <Badge variant={release.type === 'major' ? 'danger' : release.type === 'minor' ? 'primary' : 'default'}>
                    {release.type}
                  </Badge>
                  <span className="text-sm text-slate-500">
                    {new Date(release.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="space-y-3">
                  {release.changes.map((change, changeIndex) => (
                    <div
                      key={changeIndex}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-50"
                    >
                      <div className={`p-1.5 rounded ${getTypeColor(change.type)}`}>
                        {getTypeIcon(change.type)}
                      </div>
                      <div>
                        <Badge
                          variant="default"
                          size="sm"
                          className={`mb-1 ${getTypeColor(change.type)}`}
                        >
                          {getTypeLabel(change.type)}
                        </Badge>
                        <p className="text-slate-700">{change.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Older Versions */}
      <div className="mt-8 text-center">
        <Button variant="ghost" iconRight={<ChevronRight className="h-4 w-4" />}>
          View Older Versions
        </Button>
      </div>
    </DashboardLayout>
  );
}
