import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Wrench,
  Users,
  Fuel,
  Route,
  FileCheck,
  BarChart3,
  Bell,
  Smartphone,
  Shield,
  Zap,
  Globe,
  Check,
  ArrowRight,
} from 'lucide-react';
import { MarketingLayout } from '../components/layouts/MarketingLayout';
import { FeatureCard, FeatureCardLarge } from '../components/marketing/FeatureCard';
import { Button } from '../components/ui/Button';

// Feature categories
const featureCategories = [
  {
    icon: MapPin,
    title: 'Fleet Tracking',
    description: 'Real-time GPS tracking and route monitoring for your entire fleet.',
    features: ['Live location updates', 'Geofencing alerts', 'Route history', 'Speed monitoring'],
  },
  {
    icon: Wrench,
    title: 'Maintenance',
    description: 'Proactive maintenance scheduling to prevent costly breakdowns.',
    features: ['Automated reminders', 'Service history', 'Parts inventory', 'Vendor management'],
  },
  {
    icon: Users,
    title: 'Driver Management',
    description: 'Complete driver profiles, certifications, and performance tracking.',
    features: ['Driver profiles', 'License tracking', 'Hours of service', 'Performance scores'],
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Powerful insights to optimize your fleet performance.',
    features: ['Cost analysis', 'Utilization reports', 'Fuel efficiency', 'Custom dashboards'],
  },
];

// Detailed features
const detailedFeatures = [
  {
    icon: MapPin,
    title: 'Real-Time GPS Tracking',
    description: 'Know where every vehicle is at any moment with precision GPS tracking. Our system updates locations every 30 seconds and stores historical route data for up to 2 years.',
    features: ['Live map view', '30-second updates', '2-year history', 'Mobile access'],
    imagePosition: 'right' as const,
  },
  {
    icon: Route,
    title: 'AI Route Optimization',
    description: 'Our machine learning algorithms analyze traffic patterns, delivery windows, and vehicle capacity to suggest the most efficient routes for your drivers.',
    features: ['Traffic-aware routing', 'Multi-stop optimization', 'Delivery time windows', 'Fuel-efficient paths'],
    imagePosition: 'left' as const,
  },
  {
    icon: Wrench,
    title: 'Predictive Maintenance',
    description: 'Prevent breakdowns before they happen. Our system monitors vehicle diagnostics and predicts maintenance needs based on mileage, engine data, and historical patterns.',
    features: ['Diagnostic alerts', 'Mileage tracking', 'Service scheduling', 'Parts forecasting'],
    imagePosition: 'right' as const,
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Make data-driven decisions with comprehensive reports on fuel consumption, driver performance, vehicle utilization, and operational costs.',
    features: ['Custom reports', 'Data export', 'Scheduled emails', 'Benchmarking'],
    imagePosition: 'left' as const,
  },
];

// Comparison table data
const comparisonFeatures = [
  { name: 'Real-time GPS tracking', starter: true, professional: true, enterprise: true },
  { name: 'Mobile app access', starter: true, professional: true, enterprise: true },
  { name: 'Maintenance scheduling', starter: true, professional: true, enterprise: true },
  { name: 'Driver management', starter: 'Basic', professional: 'Advanced', enterprise: 'Advanced' },
  { name: 'Fuel cost tracking', starter: true, professional: true, enterprise: true },
  { name: 'Route optimization', starter: false, professional: true, enterprise: true },
  { name: 'API access', starter: false, professional: true, enterprise: true },
  { name: 'Custom reports', starter: false, professional: true, enterprise: true },
  { name: 'White-label option', starter: false, professional: false, enterprise: true },
  { name: 'Dedicated support', starter: false, professional: false, enterprise: true },
  { name: 'SSO integration', starter: false, professional: false, enterprise: true },
  { name: 'Custom integrations', starter: false, professional: false, enterprise: true },
];

// Use cases
const useCases = [
  {
    icon: Zap,
    title: 'Delivery Services',
    description: 'Optimize last-mile delivery with route planning, real-time tracking, and proof of delivery.',
  },
  {
    icon: Globe,
    title: 'Transportation',
    description: 'Manage large fleets with dispatch tools, driver scheduling, and compliance tracking.',
  },
  {
    icon: Shield,
    title: 'Field Services',
    description: 'Coordinate service teams with job scheduling, parts tracking, and customer notifications.',
  },
  {
    icon: Smartphone,
    title: 'Ride Sharing',
    description: 'Track vehicles, monitor driver behavior, and ensure passenger safety.',
  },
];

// Additional features grid
const additionalFeatures = [
  { icon: Bell, title: 'Instant Alerts', description: 'Get notified about important events in real-time' },
  { icon: Shield, title: 'Compliance', description: 'Stay compliant with DOT, ELD, and safety regulations' },
  { icon: Smartphone, title: 'Mobile App', description: 'Manage your fleet from anywhere with iOS and Android apps' },
  { icon: Globe, title: 'Multi-location', description: 'Support for fleets across multiple depots and regions' },
  { icon: FileCheck, title: 'Inspections', description: 'Digital DVIRs and inspection checklists' },
  { icon: Fuel, title: 'Fuel Cards', description: 'Integrate with major fuel card providers' },
];

export default function FeaturesPage() {
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({});
  const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    Object.entries(sectionsRef.current).forEach(([id, element]) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionsRef.current[id] = el;
  };

  return (
    <MarketingLayout
      title="Features - FleetFlow"
      description="Explore the powerful features that make FleetFlow the leading fleet management platform."
    >
      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 bg-gradient-to-br from-blue-50 via-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
              <span>Powerful Features</span>
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              Everything you need to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-900 to-blue-600">
                manage your fleet
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 mb-8">
              From real-time tracking to predictive maintenance, FleetFlow provides all the tools you need to run an efficient, cost-effective fleet operation.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.location.href = '/auth/register'}
                iconRight={<ArrowRight className="h-5 w-5" />}
              >
                Start Free Trial
              </Button>
              <Link
                href="/pricing"
                className="text-slate-600 hover:text-blue-600 font-medium transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Categories */}
      <section
        id="categories"
        ref={setRef('categories')}
        className="py-20 lg:py-32"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Feature Categories
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Comprehensive tools covering every aspect of fleet management
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {featureCategories.map((category, index) => (
              <div
                key={index}
                className={`p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all duration-300 ${
                  isVisible['categories'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <category.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{category.title}</h3>
                    <p className="text-slate-600 mb-4">{category.description}</p>
                    <ul className="grid grid-cols-2 gap-2">
                      {category.features.map((feature, fIndex) => (
                        <li key={fIndex} className="flex items-center space-x-2 text-sm text-slate-600">
                          <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Features */}
      <section className="py-20 lg:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Detailed Feature Breakdown
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Dive deeper into what makes each feature powerful
            </p>
          </div>

          <div className="space-y-20">
            {detailedFeatures.map((feature, index) => (
              <FeatureCardLarge key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Additional Features Grid */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              And much more...
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Additional features to make fleet management even easier
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {additionalFeatures.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-xl bg-slate-50 hover:bg-blue-50 transition-colors"
              >
                <feature.icon className="h-8 w-8 text-blue-600 mb-4" />
                <h3 className="font-semibold text-slate-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 lg:py-32 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Compare Plans
            </h2>
            <p className="text-lg text-slate-600">
              See which features are included in each plan
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-6 py-4 text-left font-semibold">Feature</th>
                    <th className="px-6 py-4 text-center font-semibold">Starter</th>
                    <th className="px-6 py-4 text-center font-semibold bg-blue-800">Professional</th>
                    <th className="px-6 py-4 text-center font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, index) => (
                    <tr key={index} className="border-b border-slate-100 last:border-0">
                      <td className="px-6 py-4 text-slate-900 font-medium">{feature.name}</td>
                      <td className="px-6 py-4 text-center">
                        {typeof feature.starter === 'boolean' ? (
                          feature.starter ? (
                            <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="text-sm text-slate-600">{feature.starter}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center bg-blue-50/50">
                        {typeof feature.professional === 'boolean' ? (
                          feature.professional ? (
                            <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="text-sm text-slate-600">{feature.professional}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {typeof feature.enterprise === 'boolean' ? (
                          feature.enterprise ? (
                            <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )
                        ) : (
                          <span className="text-sm text-slate-600">{feature.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Built for Every Industry
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              FleetFlow adapts to your specific industry needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-soft transition-all text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <useCase.icon className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{useCase.title}</h3>
                <p className="text-sm text-slate-600">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-blue-900 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to experience these features?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Start your free trial today and see how FleetFlow can transform your fleet management.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => window.location.href = '/auth/register'}
            >
              Start Free Trial
            </Button>
            <Link
              href="/pricing"
              className="px-6 py-3 text-white font-medium hover:text-blue-200 transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
