import Link from 'next/link';
import { useState } from 'react';
import {
  Calendar,
  Clock,
  ArrowRight,
  User,
  Search,
  Tag,
} from 'lucide-react';
import { MarketingLayout } from '../../components/layouts/MarketingLayout';

// Blog categories
const categories = [
  { id: 'all', label: 'All Posts' },
  { id: 'fleet-management', label: 'Fleet Management' },
  { id: 'technology', label: 'Technology' },
  { id: 'industry', label: 'Industry Insights' },
  { id: 'sustainability', label: 'Sustainability' },
  { id: 'tips', label: 'Tips & Tricks' },
];

// Blog posts data
const blogPosts = [
  {
    slug: 'future-of-fleet-management-2024',
    title: 'The Future of Fleet Management in 2024',
    excerpt: 'Explore the emerging technologies and trends that are reshaping how businesses manage their vehicle fleets, from AI-powered optimization to electric vehicle integration.',
    category: 'fleet-management',
    categoryLabel: 'Fleet Management',
    author: 'Alex Rivera',
    date: 'Jan 15, 2024',
    readTime: '8 min read',
    featured: true,
    imageColor: 'from-blue-500 to-blue-700',
  },
  {
    slug: 'reducing-fuel-costs-data-driven-strategies',
    title: 'Reducing Fuel Costs: 5 Data-Driven Strategies',
    excerpt: 'Learn how leading fleets are using analytics to cut fuel expenses by up to 20% through smarter routing, driver behavior monitoring, and vehicle maintenance.',
    category: 'tips',
    categoryLabel: 'Tips & Tricks',
    author: 'Sarah Chen',
    date: 'Jan 10, 2024',
    readTime: '6 min read',
    featured: false,
    imageColor: 'from-emerald-500 to-emerald-700',
  },
  {
    slug: 'electric-vehicles-fleet-transition-guide',
    title: 'The Complete Guide to EV Fleet Transition',
    excerpt: 'Everything you need to know about transitioning to electric vehicles, from infrastructure planning to total cost of ownership analysis.',
    category: 'sustainability',
    categoryLabel: 'Sustainability',
    author: 'Michael Torres',
    date: 'Jan 5, 2024',
    readTime: '12 min read',
    featured: false,
    imageColor: 'from-green-500 to-green-700',
  },
  {
    slug: 'ai-route-optimization-explained',
    title: 'AI Route Optimization Explained',
    excerpt: 'A deep dive into how artificial intelligence is revolutionizing route planning, saving time, fuel, and reducing environmental impact.',
    category: 'technology',
    categoryLabel: 'Technology',
    author: 'David Kim',
    date: 'Dec 28, 2023',
    readTime: '7 min read',
    featured: false,
    imageColor: 'from-purple-500 to-purple-700',
  },
  {
    slug: 'dot-compliance-checklist-2024',
    title: 'DOT Compliance Checklist for 2024',
    excerpt: 'Stay compliant with the latest Department of Transportation regulations. Our comprehensive checklist covers everything you need to know.',
    category: 'industry',
    categoryLabel: 'Industry Insights',
    author: 'Emily Johnson',
    date: 'Dec 20, 2023',
    readTime: '10 min read',
    featured: false,
    imageColor: 'from-amber-500 to-amber-700',
  },
  {
    slug: 'driver-retention-strategies',
    title: 'Proven Driver Retention Strategies',
    excerpt: 'The driver shortage is real. Learn how top fleets are keeping their best drivers happy and reducing turnover by up to 40%.',
    category: 'fleet-management',
    categoryLabel: 'Fleet Management',
    author: 'Lisa Anderson',
    date: 'Dec 15, 2023',
    readTime: '9 min read',
    featured: false,
    imageColor: 'from-rose-500 to-rose-700',
  },
  {
    slug: 'predictive-maintenance-benefits',
    title: 'The ROI of Predictive Maintenance',
    excerpt: 'Why waiting for something to break is costing you money. Discover how predictive maintenance can reduce downtime and extend vehicle life.',
    category: 'technology',
    categoryLabel: 'Technology',
    author: 'Sarah Chen',
    date: 'Dec 10, 2023',
    readTime: '8 min read',
    featured: false,
    imageColor: 'from-cyan-500 to-cyan-700',
  },
  {
    slug: 'sustainable-fleet-best-practices',
    title: 'Building a Sustainable Fleet: Best Practices',
    excerpt: 'Environmental responsibility meets cost savings. Learn practical strategies for reducing your fleet\'s carbon footprint while improving the bottom line.',
    category: 'sustainability',
    categoryLabel: 'Sustainability',
    author: 'Michael Torres',
    date: 'Dec 5, 2023',
    readTime: '7 min read',
    featured: false,
    imageColor: 'from-teal-500 to-teal-700',
  },
];

export default function BlogIndexPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPosts = blogPosts.filter((post) => {
    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPost = blogPosts.find((post) => post.featured);
  const regularPosts = filteredPosts.filter((post) => !post.featured || selectedCategory !== 'all');

  return (
    <MarketingLayout
      title="Blog - FleetFlow"
      description="Insights, tips, and best practices for modern fleet management."
    >
      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
              <Tag className="h-4 w-4" />
              <span>Fleet Insights</span>
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              FleetFlow Blog
            </h1>
            <p className="text-lg sm:text-xl text-slate-600">
              Insights, tips, and best practices for modern fleet management
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-8 bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full md:w-64"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Post */}
      {selectedCategory === 'all' && !searchQuery && featuredPost && (
        <section className="py-12 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
              <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
                Featured Article
              </span>
            </div>
            <Link href={`/blog/${featuredPost.slug}`}>
              <article className="grid lg:grid-cols-2 gap-8 items-center group">
                <div className={`aspect-[16/10] rounded-2xl bg-gradient-to-br ${featuredPost.imageColor} flex items-center justify-center overflow-hidden`}>
                  <div className="text-center text-white p-8">
                    <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                      <Tag className="h-10 w-10 text-white" />
                    </div>
                    <span className="text-white/80 text-sm">Featured Image</span>
                  </div>
                </div>
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">
                    {featuredPost.categoryLabel}
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors">
                    {featuredPost.title}
                  </h2>
                  <p className="text-lg text-slate-600 mb-6">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-slate-500">
                    <span className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{featuredPost.author}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{featuredPost.date}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>{featuredPost.readTime}</span>
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          </div>
        </section>
      )}

      {/* Blog Posts Grid */}
      <section className="py-12 lg:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              {selectedCategory === 'all' && !searchQuery ? 'Latest Articles' : 'Articles'}
            </h2>
          </div>

          {regularPosts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {regularPosts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`}>
                  <article className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all h-full flex flex-col">
                    <div className={`aspect-video bg-gradient-to-br ${post.imageColor} flex items-center justify-center`}>
                      <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Tag className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-3 self-start">
                        {post.categoryLabel}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-slate-600 text-sm mb-4 line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                        <span className="flex items-center space-x-1">
                          <User className="h-3 w-3" />
                          <span>{post.author}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{post.readTime}</span>
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No articles found</h3>
              <p className="text-slate-600">Try adjusting your search or category filter</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Subscribe to our newsletter
          </h2>
          <p className="text-slate-600 mb-8">
            Get the latest fleet management tips and insights delivered to your inbox.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <span>Subscribe</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>
    </MarketingLayout>
  );
}
