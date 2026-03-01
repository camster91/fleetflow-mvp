import { useState } from 'react';
import { useRouter } from 'next/router';
import { Mail, Lock, AlertCircle, ArrowRight, Building, User, Check } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const roles = [
  { value: 'fleet_manager', label: 'Fleet Manager', description: 'Manage vehicles and maintenance' },
  { value: 'dispatch', label: 'Dispatch Operator', description: 'Assign deliveries and optimize routes' },
  { value: 'driver', label: 'Driver', description: 'Complete deliveries and track progress' },
  { value: 'maintenance', label: 'Maintenance Technician', description: 'Handle vehicle repairs and inspections' },
  { value: 'safety_officer', label: 'Safety Officer', description: 'Monitor compliance and safety protocols' },
  { value: 'finance', label: 'Finance/HR', description: 'Handle payroll and financial reporting' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('fleet_manager');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          company,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/auth/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join FleetFlow Pro to streamline your operations"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Start your 14-day free trial today
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User className="h-5 w-5" />}
            placeholder="John Doe"
            required
            autoComplete="name"
          />

          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="h-5 w-5" />}
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-5 w-5" />}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            helperText="At least 8 characters with letters and numbers"
          />

          <Input
            label="Company"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            leftIcon={<Building className="h-5 w-5" />}
            placeholder="Your Company LLC"
            autoComplete="organization"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            What is your role?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roles.map((r) => (
              <div
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`
                  relative border rounded-lg p-4 cursor-pointer transition-all
                  ${role === r.value
                    ? 'border-blue-900 bg-blue-50 ring-1 ring-blue-900'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }
                `}
              >
                <div className="flex items-start">
                  <div className={`
                    h-5 w-5 rounded-full border flex items-center justify-center mr-3 mt-0.5
                    ${role === r.value ? 'border-blue-900 bg-blue-900' : 'border-slate-300'}
                  `}>
                    {role === r.value && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{r.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
          />
          <span className="text-sm text-slate-600">
            I agree to the{' '}
            <Link href="/terms" className="font-medium text-blue-900 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-blue-900 hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="lg"
          loading={loading}
          iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
        >
          Create account
        </Button>
      </form>

      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Already have an account?</span>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/auth/login">
            <Button variant="outline" fullWidth size="lg">
              Sign in instead
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Admin accounts require manual approval. Contact support for admin access.
      </p>

      <div className="mt-4 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </AuthLayout>
  );
}
