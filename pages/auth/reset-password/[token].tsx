import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '../../../components/layouts/AuthLayout';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabaseClient } from '../../../lib/supabase';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const isPasswordValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      
      if (error || !session) {
        setError('Invalid or expired reset link. Please request a new one.');
      }
      
      setValidating(false);
    };

    if (router.isReady) {
      checkSession();
    }
  }, [router.isReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabaseClient.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        toast.error(updateError.message);
      } else {
        setSuccess(true);
        toast.success('Password updated successfully!');
        
        // Redirect to login after a delay
        setTimeout(() => {
          router.push('/auth/login');
        }, 2000);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthLayout title="Reset Password" subtitle="">
        <div className="text-center py-8">
          <div className="animate-pulse">
            <p className="text-slate-600">Validating reset link...</p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (error && !password) {
    return (
      <AuthLayout title="Invalid Link" subtitle="">
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Invalid Reset Link
          </h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link href="/auth/forgot-password">
            <Button variant="primary" fullWidth>
              Request New Link
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password Updated" subtitle="">
        <div className="text-center py-8">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Password Updated!
          </h2>
          <p className="text-slate-600 mb-6">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <Link href="/auth/login">
            <Button variant="primary" fullWidth>
              Go to Login
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset Password" subtitle="">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Create new password</h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter your new password below
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
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="h-5 w-5" />}
          placeholder="••••••••"
          required
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          loading={loading}
        >
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
}
