import React from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';

export default function PrivacyPolicyPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Privacy Policy"
        subtitle="Last updated: February 28, 2024"
      />

      <Card className="max-w-4xl">
        <div className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
          <p className="text-slate-600 mb-4">
            FleetFlow ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy 
            explains how we collect, use, disclose, and safeguard your information when you use our 
            fleet management platform and services.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Information We Collect</h2>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">2.1 Personal Information</h3>
          <p className="text-slate-600 mb-4">
            We may collect personal information that you voluntarily provide to us when you:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Register for an account</li>
            <li>Add team members to your organization</li>
            <li>Upload vehicle and driver information</li>
            <li>Contact our support team</li>
            <li>Subscribe to our newsletters</li>
          </ul>
          <p className="text-slate-600 mb-4">
            This information may include your name, email address, phone number, company name, 
            and billing information.
          </p>

          <h3 className="text-xl font-semibold text-slate-900 mb-2">2.2 Fleet Data</h3>
          <p className="text-slate-600 mb-4">
            As a fleet management platform, we collect and store data about your vehicles, including:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Vehicle identification information (VIN, license plate, etc.)</li>
            <li>GPS location data (with your consent)</li>
            <li>Maintenance records and schedules</li>
            <li>Fuel consumption data</li>
            <li>Driver information and performance metrics</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">3. How We Use Your Information</h2>
          <p className="text-slate-600 mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send administrative information, such as updates and security alerts</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Monitor and analyze usage patterns and trends</li>
            <li>Detect, prevent, and address technical issues and fraudulent activities</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Data Security</h2>
          <p className="text-slate-600 mb-4">
            We implement appropriate technical and organizational measures to protect your personal 
            information against unauthorized access, alteration, disclosure, or destruction. These 
            measures include:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments and penetration testing</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Employee training on data protection</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Your Rights</h2>
          <p className="text-slate-600 mb-4">
            Depending on your location, you may have certain rights regarding your personal information, 
            including:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>The right to access your personal information</li>
            <li>The right to correct inaccurate information</li>
            <li>The right to request deletion of your information</li>
            <li>The right to restrict or object to processing</li>
            <li>The right to data portability</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Contact Us</h2>
          <p className="text-slate-600 mb-4">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p className="text-slate-600">
            Email: privacy@fleetflow.io<br />
            Address: 123 Fleet Street, Toronto, ON M5V 1K4, Canada
          </p>
        </div>
      </Card>
    </DashboardLayout>
  );
}
