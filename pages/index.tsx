import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import {
  Truck,
  MapPin,
  Wrench,
  Users,
  Fuel,
  Route,
  FileCheck,
  ArrowRight,
  Play,
  ChevronLeft,
  ChevronRight,
  Building2,
  Package,
  Bus,
  Construction,
} from 'lucide-react';
import { MarketingLayout } from '../components/layouts/MarketingLayout';
import { FeatureCard } from '../components/marketing/FeatureCard';
import { TestimonialCard } from '../components/marketing/TestimonialCard';
import { FAQ } from '../components/marketing/FAQ';
import { Button } from '../components/ui/Button';

// Feature data
const features = [
  {
    icon: MapPin,
    title: 'Real-time Vehicle Tracking',
    description: 'Track your entire fleet in real-time with GPS precision. Know exactly where every vehicle is at any moment.',
  },
  {
    icon: Wrench,
    title: 'Maintenance Scheduling',
    description: 'Automated maintenance reminders and scheduling to keep your vehicles in top condition and avoid costly breakdowns.',
  },
  {
    icon: Users,
    title: 'Driver Management',
    description: 'Manage driver profiles, certifications, schedules, and performance all in one centralized platform.',
  },
  {
    icon: Fuel,
    title: 'Fuel Cost Analytics',
    description: 'Track fuel consumption, identify inefficiencies, and reduce costs with detailed analytics and insights.',
  },
  {
    icon: Route,
    title: 'Route Optimization',
    description: 'AI-powered route planning to minimize travel time, reduce fuel costs, and maximize delivery efficiency.',
  },
  {
    icon: FileCheck,
    title: 'Compliance Reporting',
    description: 'Stay compliant with automated reports for inspections, certifications, and regulatory requirements.',
  },
];

// How it works steps
const howItWorksSteps = [
  {
    number: '01',
    title: 'Import Your Fleet',
    description: 'Easily add your vehicles, drivers, and routes to FleetFlow. Import from spreadsheets or connect your existing systems.',
  },
  {
    number: '02',
    title: 'Track & Optimize',
    description: 'Monitor your fleet in real-time, automate maintenance schedules, and optimize routes for maximum efficiency.',
  },
  {
    number: '03',
    title: 'Grow Your Business',
    description: 'Use insights and analytics to make data-driven decisions that reduce costs and improve customer satisfaction.',
  },
];

// Testimonials data
const testimonials = [
  {
    quote: "FleetFlow transformed how we manage our delivery fleet. We've reduced fuel costs by 23% and improved on-time deliveries significantly.",
    author: "Michael Chen",
    role: "Operations Director",
    company: "Swift Logistics",
    rating: 5,
  },
  {
    quote: "The maintenance scheduling feature alone has saved us thousands in preventable repairs. Best fleet management investment we've made.",
    author: "Sarah Johnson",
    role: "Fleet Manager",
    company: "Metro Transit",
    rating: 5,
  },
  {
    quote: "Implementation was seamless and the support team is fantastic. Our drivers love the mobile app for route updates.",
    author: "David Rodriguez",
    role: "CEO",
    company: "Coastal Delivery Co.",
    rating: 5,
  },
  {
    quote: "We evaluated 5 different fleet solutions and FleetFlow stood out for its ease of use and comprehensive feature set.",
    author: "Emily Thompson",
    role: "VP of Operations",
    company: "Nationwide Transport",
    rating: 5,
  },
];

// FAQ data
const faqItems = [
  {
    question: "How does the free trial work?",
    answer: "Start with a 14-day free trial with full access to all features. No credit card required. At the end of your trial, choose a plan that works for your fleet size.",
  },
  {
    question: "Can I import my existing fleet data?",
    answer: "Absolutely! You can import vehicles, drivers, and maintenance records via CSV upload. Our team can also help with data migration from other systems.",
  },
  {
    question: "Is there a mobile app for drivers?",
    answer: "Yes, our mobile app is available for iOS and Android. Drivers can view routes, update delivery status, log hours, and communicate with dispatch.",
  },
  {
    question: "What kind of support do you offer?",
    answer: "All plans include email support. Professional plans get priority support with faster response times. Enterprise customers receive dedicated account managers and 24/7 phone support.",
  },
  {
    question: "How does vehicle tracking work?",
    answer: "FleetFlow integrates with most GPS tracking devices and ELDs. We also offer our own GPS hardware for fleets that need it. Real-time location data updates every 30 seconds.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer: "Yes, you can change your plan at any time. Upgrades take effect immediately, and downgrades are applied at the start of your next billing cycle.",
  },
  {
    question: "Is my data secure?",
    answer: "Security is our top priority. We use bank-level encryption, SOC 2 Type II compliance, regular security audits, and automatic data backups to keep your information safe.",
  },
  {
    question: "Do you offer custom integrations?",
    answer: "Enterprise plans include API access and custom integration support. We can connect FleetFlow with your ERP, accounting software, CRM, and other business systems.",
  },
];

// Customer logos
const customerLogos = [
  { icon: Building2, name: "Construction Pro" },
  { icon: Package, name: "Package Plus" },
  { icon: Bus, name: "Transit Lines" },
  { icon: Truck, name: "Freight Co" },
  { icon: Construction, name: "BuildRight" },
  { icon: Building2, name: "Logistics Inc" },
];

export default function LandingPage() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
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

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const setRef = (id: string) => (el: HTMLElement | null) => {
    sectionsRef.current[id] = el;
  };

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-slate-50">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-300/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span>Now with AI-powered route optimization</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Fleet Management,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-900 to-blue-600">
                  Simplified
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                Track vehicles, schedule maintenance, and optimize your fleet operations with FleetFlow. The all-in-one platform for modern fleet management.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => window.location.href = '/auth/register'}
                  iconRight={<ArrowRight className="h-5 w-5" />}
                >
                  Start Free Trial
                </Button>
                <button className="flex items-center space-x-2 px-6 py-3 text-slate-600 hover:text-blue-600 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center">
                    <Play className="h-4 w-4 text-blue-600 ml-0.5" />
                  </div>
                  <span className="font-medium">Watch Demo</span>
                </button>
              </div>

              {/* Trust badges */}
              <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-slate-500">
                <span className="flex items-center space-x-1">
                  <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Free 14-day trial</span>
                </span>
                <span className="flex items-center space-x-1">
                  <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>No credit card required</span>
                </span>
                <span className="flex items-center space-x-1">
                  <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Cancel anytime</span>
                </span>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden shadow-elevated bg-white p-2">
                <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Truck className="h-12 w-12 text-white" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 bg-slate-200 rounded w-3/4 mx-auto"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2 mx-auto"></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 p-4 bg-white rounded-xl shadow-soft">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Live Tracking</div>
                    <div className="text-xs text-slate-500">42 vehicles active</div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 p-4 bg-white rounded-xl shadow-soft">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Maintenance</div>
                    <div className="text-xs text-slate-500">3 tasks due</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section
        id="social-proof"
        ref={setRef('social-proof')}
        className="py-16 bg-white border-y border-slate-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-slate-500 uppercase tracking-wider mb-8">
            Trusted by leading companies worldwide
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center opacity-60">
            {customerLogos.map((logo, index) => (
              <div key={index} className="flex flex-col items-center space-y-2">
                <logo.icon className="h-8 w-8 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium hidden sm:block">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        ref={setRef('features')}
        className="py-20 lg:py-32"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-semibold text-sm uppercase tracking-wider">Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2 mb-4">
              Everything you need to manage your fleet
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Powerful tools designed to streamline your operations, reduce costs, and improve efficiency.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ${
                  isVisible['features'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <FeatureCard {...feature} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        ref={setRef('how-it-works')}
        className="py-20 lg:py-32 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-semibold text-sm uppercase tracking-wider">How It Works</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2 mb-4">
              Get started in three easy steps
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From setup to optimization, FleetFlow makes fleet management simple and efficient.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorksSteps.map((step, index) => (
              <div
                key={index}
                className={`relative text-center transition-all duration-500 ${
                  isVisible['how-it-works'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                {/* Connector line */}
                {index < howItWorksSteps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-blue-200 to-transparent"></div>
                )}
                
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 mb-6">
                  <span className="text-3xl font-bold text-blue-600">{step.number}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-blue-900 to-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <span className="text-blue-300 font-semibold text-sm uppercase tracking-wider">Pricing</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-4">
                Simple, transparent pricing
              </h2>
              <p className="text-blue-100 text-lg mb-8">
                Choose the plan that fits your fleet. All plans include a 14-day free trial with no credit card required.
              </p>
              <div className="space-y-4">
                {[
                  { name: 'Starter', price: '$29/mo', desc: 'Up to 10 vehicles' },
                  { name: 'Professional', price: '$79/mo', desc: 'Up to 50 vehicles' },
                  { name: 'Enterprise', price: '$199/mo', desc: 'Unlimited vehicles' },
                ].map((plan) => (
                  <div key={plan.name} className="flex items-center justify-between p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                    <div>
                      <div className="font-semibold">{plan.name}</div>
                      <div className="text-sm text-blue-200">{plan.desc}</div>
                    </div>
                    <div className="font-bold text-xl">{plan.price}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link
                  href="/pricing"
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-white text-blue-900 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <span>View Full Pricing</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="p-8 bg-white rounded-2xl shadow-elevated">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">Professional</h3>
                  <p className="text-slate-500">Most popular for growing fleets</p>
                </div>
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold text-slate-900">$79</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Up to 50 vehicles',
                    'Real-time GPS tracking',
                    'Maintenance scheduling',
                    'Driver management',
                    'Fuel analytics',
                    'Route optimization',
                    'Priority support',
                    'API access',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center space-x-3 text-slate-600">
                      <svg className="h-5 w-5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => window.location.href = '/auth/register'}
                >
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section
        id="testimonials"
        ref={setRef('testimonials')}
        className="py-20 lg:py-32 bg-slate-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-blue-600 font-semibold text-sm uppercase tracking-wider">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2 mb-4">
              Loved by fleet managers worldwide
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              See what our customers have to say about their experience with FleetFlow.
            </p>
          </div>

          {/* Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-2 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ${
                  isVisible['testimonials'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <TestimonialCard {...testimonial} />
              </div>
            ))}
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300"
                style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}
              >
                {testimonials.map((testimonial, index) => (
                  <div key={index} className="w-full flex-shrink-0 px-4">
                    <TestimonialCard {...testimonial} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center mt-6 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentTestimonial === index ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
            <button
              onClick={prevTestimonial}
              className="absolute top-1/2 -left-2 -translate-y-1/2 p-2 bg-white rounded-full shadow-soft"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <button
              onClick={nextTestimonial}
              className="absolute top-1/2 -right-2 -translate-y-1/2 p-2 bg-white rounded-full shadow-soft"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section
        id="faq"
        ref={setRef('faq')}
        className="py-20 lg:py-32 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FAQ
            items={faqItems}
            title="Frequently Asked Questions"
            subtitle="Everything you need to know about FleetFlow. Can't find what you're looking for? Contact our support team."
          />
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to transform your fleet management?
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
            Join thousands of fleet managers who trust FleetFlow to streamline their operations and reduce costs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => window.location.href = '/auth/register'}
              iconRight={<ArrowRight className="h-5 w-5" />}
            >
              Start Your Free Trial
            </Button>
            <Link
              href="/pricing"
              className="px-6 py-3 text-white font-medium hover:text-blue-300 transition-colors"
            >
              View Pricing
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
