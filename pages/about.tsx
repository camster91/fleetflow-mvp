import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Truck,
  Target,
  Heart,
  Users,
  Award,
  Globe,
  Zap,
  ArrowRight,
  Mail,
  Send,
  CheckCircle,
} from 'lucide-react';
import { MarketingLayout } from '../components/layouts/MarketingLayout';
import { Button } from '../components/ui/Button';

// Company stats
const stats = [
  { value: '10K+', label: 'Vehicles Managed', icon: Truck },
  { value: '500+', label: 'Happy Customers', icon: Heart },
  { value: '50+', label: 'Countries Served', icon: Globe },
  { value: '99.9%', label: 'Uptime SLA', icon: Zap },
];

// Team members
const team = [
  { name: 'John Smith', role: 'CEO & Co-founder', image: '/team/john.jpg' },
  { name: 'Sarah Johnson', role: 'CTO', image: '/team/sarah.jpg' },
  { name: 'Mike Davis', role: 'Head of Product', image: '/team/mike.jpg' },
];

// Values
const values = [
  { icon: Target, title: 'Mission Driven', description: 'We help businesses move the world more efficiently.' },
  { icon: Heart, title: 'Customer First', description: 'Every decision we make starts with our customers.' },
  { icon: Award, title: 'Excellence', description: 'We strive for excellence in everything we do.' },
];

export default function AboutPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            About FleetFlow
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            We're on a mission to revolutionize fleet management with innovative technology 
            and exceptional service.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="h-8 w-8 mx-auto text-blue-600 mb-3" />
                <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            Our Values
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-white p-8 rounded-xl shadow-sm">
                <value.icon className="h-10 w-10 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{value.title}</h3>
                <p className="text-slate-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to transform your fleet?
          </h2>
          <p className="text-xl text-blue-200 mb-8">
            Join thousands of companies already using FleetFlow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg">
              Start Free Trial
            </Button>
            <Link
              href="/contact"
              className="px-6 py-3 text-white font-medium hover:text-blue-200 transition-colors"
            >
              Contact Sales →
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
