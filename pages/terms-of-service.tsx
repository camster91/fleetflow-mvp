import React from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';

export default function TermsOfServicePage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Terms of Service"
        subtitle="Last updated: February 28, 2024"
      />

      <Card className="max-w-4xl">
        <div className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
          <p className="text-slate-600 mb-4">
            By accessing or using FleetFlow's services, you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, please do not use our services.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Description of Service</h2>
          <p className="text-slate-600 mb-4">
            FleetFlow provides a cloud-based fleet management platform that allows businesses to track, 
            manage, and optimize their vehicle fleets. Our services include vehicle tracking, maintenance 
            scheduling, driver management, and analytics reporting.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Account Registration</h2>
          <p className="text-slate-600 mb-4">
            To use our services, you must:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Be at least 18 years of age</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly notify us of any unauthorized use of your account</li>
          </ul>
          <p className="text-slate-600 mb-4">
            You are responsible for all activities that occur under your account.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Subscription and Payment</h2>
          <p className="text-slate-600 mb-4">
            Some of our services require payment of subscription fees. By subscribing:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>You agree to pay all fees associated with your subscription plan</li>
            <li>Subscription fees are billed in advance on a monthly or annual basis</li>
            <li>Refunds are provided in accordance with our refund policy</li>
            <li>We reserve the right to change pricing with 30 days notice</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Acceptable Use</h2>
          <p className="text-slate-600 mb-4">
            You agree not to use our services to:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on the rights of others</li>
            <li>Transmit any harmful code or malware</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with other users' access to the service</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Data Ownership</h2>
          <p className="text-slate-600 mb-4">
            You retain ownership of all data you upload to our platform. By using our services, you 
            grant us a license to use, store, and process your data solely for the purpose of providing 
            and improving our services.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Termination</h2>
          <p className="text-slate-600 mb-4">
            We may suspend or terminate your access to our services at any time, with or without cause, 
            and with or without notice. Upon termination:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Your right to use the services immediately ceases</li>
            <li>We may delete your data in accordance with our data retention policy</li>
            <li>Any outstanding fees become immediately due</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Limitation of Liability</h2>
          <p className="text-slate-600 mb-4">
            To the maximum extent permitted by law, FleetFlow shall not be liable for any indirect, 
            incidental, special, consequential, or punitive damages arising out of or relating to 
            your use of our services.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">9. Changes to Terms</h2>
          <p className="text-slate-600 mb-4">
            We reserve the right to modify these terms at any time. We will notify you of significant 
            changes via email or through our platform. Your continued use of the services after such 
            changes constitutes acceptance of the new terms.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">10. Contact Information</h2>
          <p className="text-slate-600">
            For questions about these Terms of Service, please contact us at:<br />
            Email: legal@fleetflow.io<br />
            Address: 123 Fleet Street, Toronto, ON M5V 1K4, Canada
          </p>
        </div>
      </Card>
    </DashboardLayout>
  );
}
