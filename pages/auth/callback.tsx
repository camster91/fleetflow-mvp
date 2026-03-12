import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabaseClient } from '../../lib/supabase';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the code from the URL
        const code = router.query.code as string;
        const error = router.query.error as string;
        const error_description = router.query.error_description as string;

        // Handle error from OAuth provider
        if (error) {
          setStatus('error');
          setMessage(error_description || 'Authentication failed');
          setTimeout(() => router.push('/auth/login'), 3000);
          return;
        }

        if (code) {
          // Exchange the code for a session
          const { error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            setStatus('error');
            setMessage(exchangeError.message);
            setTimeout(() => router.push('/auth/login'), 3000);
            return;
          }

          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          
          // Redirect to dashboard after successful auth
          setTimeout(() => router.push('/dashboard'), 1500);
        } else {
          // No code present, check if already authenticated
          const { data: { session } } = await supabaseClient.auth.getSession();
          
          if (session) {
            setStatus('success');
            setMessage('Already authenticated! Redirecting...');
            setTimeout(() => router.push('/dashboard'), 1500);
          } else {
            setStatus('error');
            setMessage('No authentication code found');
            setTimeout(() => router.push('/auth/login'), 3000);
          }
        }
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred');
        setTimeout(() => router.push('/auth/login'), 3000);
      }
    };

    if (router.isReady) {
      handleAuthCallback();
    }
  }, [router]);

  return (
    <AuthLayout title="Authentication" subtitle="">
      <div className="flex flex-col items-center justify-center py-12">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-600">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
            <p className="text-green-700 font-medium">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-600 mb-4" />
            <p className="text-red-700 font-medium">{message}</p>
            <p className="text-slate-500 text-sm mt-2">Redirecting to login...</p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
