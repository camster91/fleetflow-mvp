import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, sendCode } from '@/lib/session';
import { Mail, ArrowRight, ArrowLeft, AlertCircle, KeyRound } from 'lucide-react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code' | 'two-factor'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await sendCode(email.toLowerCase().trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success('Check your email for a login code');
    setStep('code');
    setResendCooldown(60);
    // Focus first code input
    setTimeout(() => codeRefs.current[0]?.focus(), 100);
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-advance to next input
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5 && newCode.every(d => d)) {
      handleVerifyCode(newCode.join(''));
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      codeRefs.current[5]?.focus();
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = async (codeStr?: string) => {
    const fullCode = step === 'two-factor' ? twoFactorCode.trim() : (codeStr || code.join(''));
    if (step !== 'two-factor' && fullCode.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    const result = step === 'two-factor'
      ? await fetch('/api/auth/2fa/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: fullCode }),
        }).then(async (response) => ({
          ok: response.ok,
          error: response.ok ? null : (await response.json()).error || 'Invalid verification code',
        }))
      : await signIn('credentials', {
          email: email.toLowerCase().trim(),
          code: fullCode,
          redirect: false,
        });

    if (!result || result.error) {
      setError(result?.error || 'Invalid code');
      toast.error(result?.error || 'Invalid code');
      setCode(['', '', '', '', '', '']);
      codeRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
      setStep('two-factor');
      setCode(['', '', '', '', '', '']);
      setLoading(false);
      return;
    }

    toast.success('Welcome back!');
    const callbackUrl = (router.query.callbackUrl as string) || '/dashboard';
    // A full navigation lets the session provider initialize with the new
    // authentication cookie instead of briefly rendering placeholder identity.
    window.location.assign(callbackUrl);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError('');
    await sendCode(email.toLowerCase().trim());
    setLoading(false);
    setResendCooldown(60);
    setCode(['', '', '', '', '', '']);
    toast.success('New code sent to your email');
    codeRefs.current[0]?.focus();
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to manage your fleet operations"
    >
      {step === 'email' ? (
        <>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter your email and we&apos;ll send you a login code
            </p>
          </div>

          <form onSubmit={handleSendCode} className="space-y-5">
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

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              iconRight={!loading ? <ArrowRight className="h-4 w-4" /> : undefined}
            >
              Send Login Code
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <KeyRound className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {step === 'two-factor' ? 'Two-factor authentication' : 'Check your email'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {step === 'two-factor'
                ? 'Enter the code from your authenticator app or a backup code.'
                : <>We sent a 6-digit code to <strong>{email}</strong></>}
            </p>
          </div>

          <div className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-fade-in">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {step === 'two-factor' ? (
              <Input
                label="Authenticator or backup code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                placeholder="123456 or 1234-5678-9012"
                autoComplete="one-time-code"
                required
              />
            ) : <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  autoComplete="one-time-code"
                  aria-label={`Login code digit ${i + 1}`}
                />
              ))}
            </div>}

            <Button
              type="button"
              variant="primary"
              fullWidth
              size="lg"
              loading={loading}
              onClick={() => handleVerifyCode()}
              disabled={step === 'two-factor' ? !twoFactorCode.trim() : code.some(d => !d)}
            >
              {step === 'two-factor' ? 'Verify and sign in' : 'Verify Code'}
            </Button>

            {step === 'code' ? <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); setCode(['', '', '', '', '', '']); }}
                className="flex items-center text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Change email
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className={`transition-colors ${resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div> : (
              <button
                type="button"
                onClick={() => { setStep('email'); setTwoFactorCode(''); setError(''); }}
                className="flex items-center text-sm text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Start over
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-8 text-center text-xs text-slate-500">
        Access is by invitation only. Contact your administrator for access.
      </p>
    </AuthLayout>
  );
}
