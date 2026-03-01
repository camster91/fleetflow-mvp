import { useState } from 'react';
import { useRouter } from 'next/router';
import { Mail, Lock, AlertCircle, ArrowRight, Building, User, Check, CheckCircle, Chrome, Building2 } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { signIn } from 'next-auth/react';

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
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('fleet_manager');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registered, setRegistered] = useState(false);

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  const handleNext = () => {
    if (step === 1) {
      if (!name || !email || !password) {
        setError('Please fill in all required fields');
        return;
      }
      if (!isPasswordValid) {
        setError('Password does not meet all requirements');
        return;
      }
      setError('');
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

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

      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: 'google' | 'azure-ad') => {
    setLoading(true);
    signIn(provider, { callbackUrl: '/dashboard' });
  };

  // Success state - show email verification message
  if (registered) {
    return (
      <AuthLayout
        title="Verify Your Email"
        subtitle="Almost there!"
      >
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Check Your Email
          </h2>
          <p className="text-slate-600 mb-4">
            We&apos;ve sent a verification email to
          </p>
          <p className="text-lg font-medium text-slate-900 mb-6">
            {email}
          </p>
          <p className="text-sm text-slate-600 mb-6">
            Click the link in the email to verify your account and start using FleetFlow.
          </p>
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => router.push('/auth/login')}
              fullWidth
            >
              Go to Login
            </Button>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Didn&apos;t receive the email?{' '}
            <button 
              onClick={() => router.push('/auth/login?resend=true')}
              className="text-blue-900 hover:underline font-medium"
            >
              Click here to resend
            </button>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join FleetFlow Pro to streamline your operations"
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            step >= 1 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600'
          }`}>
            1
          </div>
          <div className={`w-16 h-1 ${
            step >= 2 ? 'bg-blue-900' : 'bg-slate-200'
          }`} />
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            step >= 2 ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600'
          }`}>
            2
          </div>
        </div>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">
          {step === 1 ? 'Create your account' : 'Complete your profile'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {step === 1 
            ? 'Start your 14-day free trial today' 
            : 'Tell us a bit more about yourself'}
        </p>
      </div>

      {step === 1 && (
        <>
          {/* Social Login Options */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="flex items-center justify-center"
            >
              <Chrome className="h-5 w-5 mr-2 text-red-500" />
              Google
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSocialLogin('azure-ad')}
              disabled={loading}
              className="flex items-center justify-center"
            >
              <Building2 className="h-5 w-5 mr-2 text-blue-600" />
              Microsoft
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Or with email</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={step === 1 ? handleNext : handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {step === 1 && (
          <>
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

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-5 w-5" />}
              placeholder="••••••••"
              required
              autoComplete="new-password"
            />

            {/* Password Requirements */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-slate-700">Password requirements:</p>
              <ul className="space-y-1">
                <li className={`text-sm flex items-center ${hasMinLength ? 'text-green-600' : 'text-slate-500'}`}>
                  <span className="mr-2">{hasMinLength ? '✓' : '○'}</span>
                  At least 8 characters
                </li>
                <li className={`text-sm flex items-center ${hasUpperCase ? 'text-green-600' : 'text-slate-500'}`}>
                  <span className="mr-2">{hasUpperCase ? '✓' : '○'}</span>
                  One uppercase letter
                </li>
                <li className={`text-sm flex items-center ${hasLowerCase ? 'text-green-600' : 'text-slate-500'}`}>
                  <span className="mr-2">{hasLowerCase ? '✓' : '○'}</span>
                  One lowercase letter
                </li>
                <li className={`text-sm flex items-center ${hasNumber ? 'text-green-600' : 'text-slate-500'}`}>
                  <span className="mr-2">{hasNumber ? '✓' : '○'}</span>
                  One number
                </li>
                <li className={`text-sm flex items-center ${hasSpecialChar ? 'text-green-600' : 'text-slate-500'}`}>
                  <span className="mr-2">{hasSpecialChar ? '✓' : '○'}</span>
                  One special character (!@#$%^&*)
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              iconRight={<ArrowRight className="h-4 w-4" />}
            >
              Continue
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Input
              label="Company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              leftIcon={<Building className="h-5 w-5" />}
              placeholder="Your Company LLC"
              autoComplete="organization"
            />

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

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={!agreedToTerms}
                className="flex-1"
              >
                Create account
              </Button>
            </div>
          </>
        )}
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
