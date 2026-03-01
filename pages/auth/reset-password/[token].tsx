import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Lock, CheckCircle, XCircle, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '../../../components/layouts/AuthLayout';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [expired, setExpired] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passwordsMatch = password === confirmPassword && password !== '';

  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  useEffect(() => {
    if (!token || typeof token !== 'string') return;

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setValid(true);
        } else if (data.expired) {
          setExpired(true);
        } else {
          setValid(false);
        }
      } catch (error) {
        setValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthLayout title="Reset Password" subtitle="Validating your request">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 text-blue-900 animate-spin mx-auto" />
          <p className="mt-4 text-slate-600">Validating reset link...</p>
        </div>
      </AuthLayout>
    );
  }

  if (!valid) {
    return (
      <AuthLayout title="Invalid Link" subtitle="Password reset failed">
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {expired ? 'Link Expired' : 'Invalid Link'}
          </h2>
          <p className="text-slate-600 mb-6">
            {expired 
              ? 'This password reset link has expired. Please request a new one.'
              : 'This password reset link is invalid or has already been used.'}
          </p>
          <Button
            variant="primary"
            onClick={() => router.push('/auth/forgot-password')}
          >
            Request New Reset Link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password Reset" subtitle="Success">
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Password Reset Successful
          </h2>
          <p className="text-slate-600 mb-6">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push('/auth/login')}
          >
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset Password" subtitle="Create a new password">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Create new password</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter a new password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="relative">
          <Input
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-5 w-5" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
            placeholder="••••••••"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="relative">
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="h-5 w-5" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            }
            placeholder="••••••••"
            required
            autoComplete="new-password"
            error={confirmPassword && !passwordsMatch ? 'Passwords do not match' : undefined}
          />
        </div>

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
          loading={loading}
          disabled={!isPasswordValid || !passwordsMatch}
        >
          Reset Password
        </Button>

        <p className="text-center text-sm text-slate-500">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-blue-900 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
