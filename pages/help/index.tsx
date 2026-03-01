import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import {
  Search,
  Book,
  Truck,
  Users,
  Wrench,
  CreditCard,
  Shield,
  MessageCircle,
  FileText,
  ChevronRight,
  LifeBuoy,
  Video,
} from 'lucide-react';

const categories = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of FleetFlow',
    icon: <Book className="h-6 w-6" />,
    color: 'bg-blue-50 text-blue-600',
    articles: 12,
  },
  {
    id: 'vehicles',
    title: 'Vehicle Management',
    description: 'Manage your fleet vehicles',
    icon: <Truck className="h-6 w-6" />,
    color: 'bg-emerald-50 text-emerald-600',
    articles: 18,
  },
  {
    id: 'team',
    title: 'Team & Permissions',
    description: 'Invite and manage team members',
    icon: <Users className="h-6 w-6" />,
    color: 'bg-purple-50 text-purple-600',
    articles: 8,
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    description: 'Schedule and track maintenance',
    icon: <Wrench className="h-6 w-6" />,
    color: 'bg-amber-50 text-amber-600',
    articles: 15,
  },
  {
    id: 'billing',
    title: 'Billing & Plans',
    description: 'Manage subscriptions and payments',
    icon: <CreditCard className="h-6 w-6" />,
    color: 'bg-rose-50 text-rose-600',
    articles: 6,
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    description: 'Keep your data safe',
    icon: <Shield className="h-6 w-6" />,
    color: 'bg-cyan-50 text-cyan-600',
    articles: 10,
  },
];

const popularArticles = [
  { id: '1', title: 'How to add your first vehicle', category: 'getting-started', views: 2340 },
  { id: '2', title: 'Setting up maintenance schedules', category: 'maintenance', views: 1856 },
  { id: '3', title: 'Inviting team members', category: 'team', views: 1523 },
  { id: '4', title: 'Understanding analytics dashboards', category: 'getting-started', views: 1289 },
  { id: '5', title: 'Exporting reports', category: 'vehicles', views: 987 },
];

export default function HelpPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/help/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Help Center"
        subtitle="Find answers and learn how to use FleetFlow"
      />

      {/* Search */}
      <Card className="mb-8 bg-gradient-to-br from-blue-600 to-blue-700 border-0">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            How can we help you?
          </h2>
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search for articles, guides, and more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
              />
              <Button
                type="submit"
                variant="primary"
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                Search
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {categories.map((category) => (
          <Card
            key={category.id}
            className="cursor-pointer hover:shadow-md transition-all group"
            onClick={() => router.push(`/help/${category.id}`)}
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${category.color}`}>
                {category.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {category.description}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  {category.articles} articles
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500" />
            </div>
          </Card>
        ))}
      </div>

      {/* Popular Articles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Popular Articles
          </h2>
          <Card>
            <div className="divide-y divide-slate-200">
              {popularArticles.map((article, index) => (
                <button
                  key={article.id}
                  onClick={() => router.push(`/help/${article.category}/${article.id}`)}
                  className="w-full flex items-center justify-between py-4 first:pt-0 last:pb-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-400 w-6">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="font-medium text-slate-900">
                        {article.title}
                      </h4>
                      <p className="text-sm text-slate-500">
                        {article.views.toLocaleString()} views
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Contact Support */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Need More Help?
          </h2>
          <Card>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Live Chat</h4>
                  <p className="text-sm text-slate-500">
                    Chat with our support team
                  </p>
                  <Button variant="ghost" size="sm" className="mt-1">
                    Start Chat
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <LifeBuoy className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Email Support</h4>
                  <p className="text-sm text-slate-500">
                    Get help via email
                  </p>
                  <Button variant="ghost" size="sm" className="mt-1">
                    Send Email
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Video className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Video Tutorials</h4>
                  <p className="text-sm text-slate-500">
                    Watch step-by-step guides
                  </p>
                  <Button variant="ghost" size="sm" className="mt-1">
                    Watch Videos
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
