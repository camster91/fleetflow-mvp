import { useRouter } from 'next/router';
import { AlertCircle, XCircle, Mail, Shield, Lock } from 'lucide-react';
import Link from 'next/link';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button } from '../../components/ui/Button';

const errorMessages: Record<string, { title: string; message: string; icon: React.ReactNode; action?: string; actionHref?: string }> = {
  default: {
    title: 'Authentication Error',
    message: 'An error occurred during authentication. Please try again.',
    icon: <XCircle className="h-8 w-8 text-red-600" />,
  },
  Configuration: {
    title: 'Server Error',
    message: 'There is a problem with the server configuration. Please contact support.',
    icon: <AlertCircle className="h-8 w-8 text-red-600" />,
  },
  AccessDenied: {
    title: 'Access Denied',
    message: 'You do not have permission to access this resource.',
    icon: <Shield className="h-8 w-8 text-amber-600" />,
  },
  Verification: {
    title: 'Email Not Verified',
    message: 'Please verify your email address before signing in. Check your inbox for the verification link.',
    icon: <Mail className="h-8 w-8 text-amber-600" />,
    action: 'Resend Verification Email',
    actionHref: '/auth/login?resend=true',
  },
  CredentialsSignin: {
    title: 'Invalid Credentials',
    message: 'The email or password you entered is incorrect. Please try again.',
    icon: <Lock className="h-8 w-8 text-red-600" />,
    action: 'Try Again',
    actionHref: '/auth/login',
  },
  AccountNotFound: {
    title: 'Account Not Found',
    message: 'No account found with this email address. Please check your email or create a new account.',
    icon: <AlertCircle className="h-8 w-8 text-amber-600" />,
    action: 'Create Account',
    actionHref: '/auth/register',
  },
  AccountLocked: {
    title: 'Account Locked',
    message: 'Your account has been temporarily locked due to too many failed login attempts. Please try again later.',
    icon: <Lock className="h-8 w-8 text-red-600" />,
    action: 'Contact Support',
    actionHref: '/support',
  },
  OAuthSignin: {
    title: 'OAuth Error',
    message: 'Error signing in with the selected provider. Please try again or use a different method.',
    icon: <AlertCircle className="h-8 w-8 text-red-600" />,
  },
  OAuthCallback: {
    title: 'OAuth Callback Error',
    message: 'Error processing OAuth callback. Please try again.',
    icon: <AlertCircle className="h-8 w-8 text-red-600" />,
  },
  OAuthCreateAccount: {
    title: 'Account Creation Failed',
    message: 'Could not create an account using the selected provider. Please try a different method.',
    icon: <AlertCircle className="h-8 w-8 text-red-600" />,
  },
  EmailCreateAccount: {
    title: 'Registration Failed',
    message: 'Could not create an account. Please try again with a different email.',
    icon: <Mail className="h-8 w-8 text-red-600" />,
  },
  Callback: {
    title: 'Callback Error',
    message: 'Error processing authentication callback. Please try again.',
    icon: <AlertCircle className="h-8 w-8 text-red-600" />,
  },
  OAuthAccountNotLinked: {
    title: 'Account Not Linked',
    message: 'This email is already associated with another account. Please sign in using your original method.',
    icon: <AlertCircle className="h-8 w-8 text-amber-600" />,
  },
  EmailSignin: {
    title: 'Email Error',
    message: 'Error sending the email. Please try again.',
    icon: <Mail className="h-8 w-8 text-red-600" />,
  },
};

export default function AuthErrorPage() {
  const router = useRouter();
  const { error } = router.query;

  const errorKey = typeof error === 'string' && errorMessages[error] ? error : 'default';
  const errorData = errorMessages[errorKey];

  return (
    <AuthLayout
      title={errorData.title}
      subtitle="Authentication Error"
    >
      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          {errorData.icon}
        </div>
        
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {errorData.title}
        </h2>
        
        <p className="text-slate-600 mb-6">
          {errorData.message}
        </p>

        <div className="space-y-3">
          {errorData.action && errorData.actionHref && (
            <Link href={errorData.actionHref}>
              <Button variant="primary" fullWidth>
                {errorData.action}
              </Button>
            </Link>
          )}
          
          <Link href="/auth/login">
            <Button variant="outline" fullWidth>
              Back to Login
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Need help?{' '}
          <Link href="/support" className="text-blue-900 hover:underline">
            Contact Support
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
