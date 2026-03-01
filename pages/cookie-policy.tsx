import React from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';

export default function CookiePolicyPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Cookie Policy"
        subtitle="Last updated: February 28, 2024"
      />

      <Card className="max-w-4xl">
        <div className="prose prose-slate max-w-none">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">1. What Are Cookies</h2>
          <p className="text-slate-600 mb-4">
            Cookies are small text files that are stored on your computer or mobile device when you 
            visit a website. They are widely used to make websites work more efficiently and provide 
            information to the website owners.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">2. How We Use Cookies</h2>
          <p className="text-slate-600 mb-4">
            FleetFlow uses cookies for the following purposes:
          </p>

          <h3 className="text-xl font-semibold text-slate-900 mb-2">2.1 Essential Cookies</h3>
          <p className="text-slate-600 mb-4">
            These cookies are necessary for the website to function properly. They enable core 
            functionality such as security, network management, and account access. You cannot 
            opt out of these cookies.
          </p>

          <h3 className="text-xl font-semibold text-slate-900 mb-2">2.2 Performance Cookies</h3>
          <p className="text-slate-600 mb-4">
            These cookies help us understand how visitors interact with our website by collecting 
            and reporting information anonymously. This helps us improve our website's performance.
          </p>

          <h3 className="text-xl font-semibold text-slate-900 mb-2">2.3 Functionality Cookies</h3>
          <p className="text-slate-600 mb-4">
            These cookies enable the website to provide enhanced functionality and personalization. 
            They may be set by us or by third-party providers whose services we have added to our pages.
          </p>

          <h3 className="text-xl font-semibold text-slate-900 mb-2">2.4 Targeting Cookies</h3>
          <p className="text-slate-600 mb-4">
            These cookies may be set through our site by our advertising partners. They may be used 
            by those companies to build a profile of your interests and show you relevant advertisements 
            on other sites.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Specific Cookies We Use</h2>
          <table className="w-full border-collapse border border-slate-200 mb-4">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-4 py-2 text-left">Cookie Name</th>
                <th className="border border-slate-200 px-4 py-2 text-left">Purpose</th>
                <th className="border border-slate-200 px-4 py-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 px-4 py-2">session_id</td>
                <td className="border border-slate-200 px-4 py-2">Maintains your login session</td>
                <td className="border border-slate-200 px-4 py-2">Session</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-4 py-2">preferences</td>
                <td className="border border-slate-200 px-4 py-2">Stores your user preferences</td>
                <td className="border border-slate-200 px-4 py-2">1 year</td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-4 py-2">analytics_id</td>
                <td className="border border-slate-200 px-4 py-2">Anonymous usage analytics</td>
                <td className="border border-slate-200 px-4 py-2">2 years</td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Managing Cookies</h2>
          <p className="text-slate-600 mb-4">
            Most web browsers allow you to control cookies through their settings. You can:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>View cookies stored on your device</li>
            <li>Delete specific cookies or all cookies</li>
            <li>Block cookies from specific websites</li>
            <li>Block all cookies</li>
            <li>Block third-party cookies while allowing first-party cookies</li>
          </ul>
          <p className="text-slate-600 mb-4">
            Please note that disabling cookies may affect the functionality of our website and 
            prevent you from accessing certain features.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Third-Party Cookies</h2>
          <p className="text-slate-600 mb-4">
            We may use services from third parties that set their own cookies. These include:
          </p>
          <ul className="list-disc pl-6 text-slate-600 mb-4">
            <li>Google Analytics for website analytics</li>
            <li>Intercom for customer support chat</li>
            <li>Stripe for payment processing</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Updates to This Policy</h2>
          <p className="text-slate-600 mb-4">
            We may update this Cookie Policy from time to time. We will notify you of any changes 
            by posting the new policy on this page and updating the "Last updated" date.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Contact Us</h2>
          <p className="text-slate-600">
            If you have any questions about our use of cookies, please contact us at:<br />
            Email: privacy@fleetflow.io
          </p>
        </div>
      </Card>
    </DashboardLayout>
  );
}
