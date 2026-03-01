import React from 'react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Download, Mail } from 'lucide-react';

export default function GDPRPage() {
  return (
    <DashboardLayout>
      <PageHeader
        title="GDPR Compliance"
        subtitle="Your data rights under the General Data Protection Regulation"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mb-6">
            <div className="prose prose-slate max-w-none">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Commitment to GDPR</h2>
              <p className="text-slate-600 mb-4">
                FleetFlow is committed to ensuring the security and protection of the personal 
                information that we process, and to providing a compliant and consistent approach 
                to data protection. We have always had a robust and effective data protection program 
                in place which complies with existing law and abides by the data protection principles.
              </p>
              <p className="text-slate-600 mb-4">
                However, we recognize our obligations in updating and expanding this program to meet 
                the demands of the GDPR and the UK's Data Protection Bill.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mb-4">Your Data Rights</h2>
              <p className="text-slate-600 mb-4">
                Under GDPR, you have the following rights:
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-2">1. Right to Access</h3>
              <p className="text-slate-600 mb-4">
                You have the right to request copies of your personal data. We may charge you a 
                small fee for this service, or provide it free of charge as per our policy.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-2">2. Right to Rectification</h3>
              <p className="text-slate-600 mb-4">
                You have the right to request that we correct any information you believe is 
                inaccurate or complete information you believe is incomplete.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-2">3. Right to Erasure</h3>
              <p className="text-slate-600 mb-4">
                You have the right to request that we erase your personal data, under certain 
                conditions. This is also known as the "right to be forgotten."
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-2">4. Right to Restrict Processing</h3>
              <p className="text-slate-600 mb-4">
                You have the right to request that we restrict the processing of your personal 
                data, under certain conditions.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-2">5. Right to Object</h3>
              <p className="text-slate-600 mb-4">
                You have the right to object to our processing of your personal data, under 
                certain conditions.
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-2">6. Right to Data Portability</h3>
              <p className="text-slate-600 mb-4">
                You have the right to request that we transfer the data that we have collected 
                to another organization, or directly to you, under certain conditions.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mb-4">Data Processing Agreement</h2>
              <p className="text-slate-600 mb-4">
                As a data processor, we have implemented appropriate technical and organizational 
                measures to ensure that personal data is processed according to GDPR requirements. 
                Our Data Processing Agreement (DPA) is available upon request.
              </p>

              <h2 className="text-2xl font-bold text-slate-900 mb-4">International Data Transfers</h2>
              <p className="text-slate-600 mb-4">
                FleetFlow stores and processes data in secure data centers. When we transfer data 
                internationally, we ensure appropriate safeguards are in place, including Standard 
                Contractual Clauses (SCCs) approved by the European Commission.
              </p>
            </div>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div>
          <Card className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">Data Export</h3>
            <p className="text-sm text-slate-600 mb-4">
              Download a copy of all your personal data that we store.
            </p>
            <Button
              variant="outline"
              fullWidth
              iconLeft={<Download className="h-4 w-4" />}
            >
              Export My Data
            </Button>
          </Card>

          <Card className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-4">Delete Account</h3>
            <p className="text-sm text-slate-600 mb-4">
              Request permanent deletion of your account and all associated data.
            </p>
            <Button
              variant="danger"
              fullWidth
            >
              Request Deletion
            </Button>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Contact DPO</h3>
            <p className="text-sm text-slate-600 mb-4">
              Our Data Protection Officer is available to address your concerns.
            </p>
            <Button
              variant="ghost"
              fullWidth
              iconLeft={<Mail className="h-4 w-4" />}
            >
              dpo@fleetflow.io
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
