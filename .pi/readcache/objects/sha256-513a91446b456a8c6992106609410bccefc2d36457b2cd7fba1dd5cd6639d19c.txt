import { useState } from 'react';
import { useRouter } from 'next/router';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';
import { supabaseClient } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const msg = authError.message || 'Invalid email or password';
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    toast.success('Login successful!');
    const callbackUrl = router.query.callbackUrl as string;
    router.push(callbackUrl || '/dashboard');
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to manage your fleet operations"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter your credentials to access your dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

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

        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-5 w-5" />}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Remember me</span>
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          size="lg"
          loading={loading}
          iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
        >
          Sign in
        </Button>
      </form>

      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Don&apos;t have an account?</span>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/auth/register">
            <Button variant="outline" fullWidth size="lg">
              Create an account
            </Button>
          </Link>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        By signing in, you agree to our{' '}
        <Link href="/terms" className="text-blue-600 hover:text-blue-800 hover:underline">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-blue-600 hover:text-blue-800 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-6 text-center">
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
