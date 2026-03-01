import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { AuthLayout } from '../../../components/layouts/AuthLayout';
import { Button } from '../../../components/ui/Button';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (!token || typeof token !== 'string') return;

    const verifyEmail = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            router.push('/auth/login?verified=true');
          }, 3000);
        } else {
          if (data.code === 'ALREADY_VERIFIED') {
            setStatus('success');
            setMessage('Your email is already verified.');
          } else if (data.code === 'TOKEN_INVALID' || data.code === 'TOKEN_EXPIRED') {
            setStatus('expired');
            setMessage('This verification link is invalid or has expired.');
          } else {
            setStatus('error');
            setMessage(data.error || 'Failed to verify email');
          }
        }
      } catch (error) {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    };

    verifyEmail();
  }, [token, router]);

  const handleResendEmail = async () => {
    // This would need the email, which we don't have here
    // Redirect to login with a message to resend
    router.push('/auth/login?resend=true');
  };

  return (
    <AuthLayout
      title="Email Verification"
      subtitle="Confirming your email address"
    >
      <div className="text-center py-8">
        {status === 'loading' && (
          <>
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 text-blue-900 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Verifying your email...
            </h2>
            <p className="text-slate-600">Please wait while we confirm your email address.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Email Verified!
            </h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <p className="text-sm text-slate-500">
              Redirecting you to login in a few seconds...
            </p>
            <Button
              variant="primary"
              onClick={() => router.push('/auth/login')}
              className="mt-4"
            >
              Go to Login
            </Button>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Link Expired
            </h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <div className="space-y-3">
              <Button
                variant="primary"
                onClick={handleResendEmail}
              >
                Request New Verification Email
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/auth/login')}
                fullWidth
              >
                Back to Login
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Verification Failed
            </h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Button
              variant="outline"
              onClick={() => router.push('/auth/login')}
            >
              Back to Login
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
