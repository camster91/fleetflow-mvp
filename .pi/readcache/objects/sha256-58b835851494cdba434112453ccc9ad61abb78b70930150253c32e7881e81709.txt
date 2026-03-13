import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  ArrowRight,
  Mail,
} from 'lucide-react';

interface InviteDetails {
  teamName: string;
  invitedBy: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { token } = router.query;
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);

  useEffect(() => {
    if (!token || typeof token !== 'string') return;

    // In a real app, fetch invite details from API
    // For now, using mock data
    setTimeout(() => {
      setInvite({
        teamName: 'Acme Logistics',
        invitedBy: 'John Smith',
        role: 'Manager',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setIsLoading(false);
    }, 1000);
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const response = await fetch('/api/team/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: token,
          accept: true,
        }),
      });

      if (response.ok) {
        setIsAccepted(true);
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to accept invitation');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    try {
      await fetch('/api/team/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitationId: token,
          accept: false,
        }),
      });
      router.push('/');
    } catch (err) {
      setError('Failed to decline invitation');
    }
  };

  if (isLoading) {
    return (
      <AuthLayout>
        <Card className="text-center py-12">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-blue-600 mb-4" />
          <p className="text-slate-600">Loading invitation...</p>
        </Card>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <Card className="text-center py-12">
          <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Invalid Invitation
          </h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Button variant="primary" onClick={() => router.push('/')}>
            Go to Dashboard
          </Button>
        </Card>
      </AuthLayout>
    );
  }

  if (isAccepted) {
    return (
      <AuthLayout>
        <Card className="text-center py-12">
          <CheckCircle className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Welcome to the Team!
          </h1>
          <p className="text-slate-600">
            You have successfully joined {invite?.teamName}.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Redirecting to dashboard...
          </p>
        </Card>
      </AuthLayout>
    );
  }

  // Not logged in
  if (status === 'unauthenticated') {
    return (
      <AuthLayout>
        <Card className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Team Invitation
            </h1>
            <p className="text-slate-600 mt-2">
              You have been invited to join <strong>{invite?.teamName}</strong>
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-700 font-medium">
                  {invite?.invitedBy.charAt(0)}
                </span>
              </div>
              <div>
                <p className="font-medium text-slate-900">{invite?.invitedBy}</p>
                <p className="text-sm text-slate-500">Team Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="h-4 w-4" />
              <span>Role: {invite?.role}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => signIn(undefined, { callbackUrl: router.asPath })}
            >
              Sign in to Accept
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => router.push('/auth/register')}
            >
              Create an Account
            </Button>
          </div>
        </Card>
      </AuthLayout>
    );
  }

  // Logged in - show accept/decline
  return (
    <AuthLayout>
      <Card className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Team Invitation
          </h1>
          <p className="text-slate-600 mt-2">
            Join <strong>{invite?.teamName}</strong>
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-700 font-medium">
                {invite?.invitedBy.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium text-slate-900">{invite?.invitedBy}</p>
              <p className="text-sm text-slate-500">Invited you as {invite?.role}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            variant="primary"
            fullWidth
            onClick={handleAccept}
            loading={isAccepting}
          >
            Accept Invitation
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={handleDecline}
            disabled={isAccepting}
          >
            Decline
          </Button>
        </div>
      </Card>
    </AuthLayout>
  );
}
