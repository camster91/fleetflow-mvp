import { useState, useRef, useEffect } from 'react';
import { Shield, AlertCircle, Loader2, Lock } from 'lucide-react';
import { Button } from '../ui/Button';

interface TwoFactorChallengeProps {
  onVerify: (code: string, rememberDevice: boolean) => Promise<void>;
  onCancel: () => void;
  error?: string;
  loading?: boolean;
}

export function TwoFactorChallenge({ 
  onVerify, 
  onCancel, 
  error: externalError,
  loading: externalLoading 
}: TwoFactorChallengeProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState(externalError || '');
  const [loading, setLoading] = useState(externalLoading || false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (externalError) setError(externalError);
  }, [externalError]);

  useEffect(() => {
    setLoading(!!externalLoading);
  }, [externalLoading]);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take only the last character
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join('');
      if (fullCode.length === 6) {
        handleSubmit(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (fullCode?: string) => {
    const codeToSubmit = fullCode || code.join('');
    
    if (codeToSubmit.length !== 6) {
      setError('Please enter a complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onVerify(codeToSubmit, rememberDevice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleUseBackupCode = () => {
    // Switch to backup code input mode
    // For simplicity, we'll just allow 8-10 character input
    // This could be expanded to have a separate UI for backup codes
  };

  return (
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-blue-900" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Two-Factor Authentication
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Code Input */}
        <div className="flex justify-center space-x-2">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={loading}
              className={`
                w-12 h-14 text-center text-2xl font-semibold rounded-lg border-2 
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition-all duration-200
                ${digit ? 'border-blue-900 bg-blue-50 text-blue-900' : 'border-slate-300 text-slate-900'}
                ${error ? 'border-red-300' : ''}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              autoFocus={index === 0}
            />
          ))}
        </div>

        {/* Remember Device Checkbox */}
        <label className="flex items-center justify-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
          />
          <span className="text-sm text-slate-600">
            Remember this device for 30 days
          </span>
        </label>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => handleSubmit()}
            loading={loading}
            disabled={code.join('').length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Verify
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>

        {/* Help Links */}
        <div className="text-center space-y-2 pt-2">
          <p className="text-xs text-slate-500">
            Lost access to your authenticator?{' '}
            <button
              type="button"
              onClick={handleUseBackupCode}
              className="text-blue-900 hover:underline font-medium"
            >
              Use backup code
            </button>
          </p>
          <p className="text-xs text-slate-400">
            Can&apos;t sign in? Contact{' '}
            <a href="/support" className="text-blue-900 hover:underline">
              support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Backup Code Input Component
export function BackupCodeInput({
  onVerify,
  onCancel,
  error,
  loading,
}: TwoFactorChallengeProps) {
  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 8) return;
    await onVerify(code, rememberDevice);
  };

  return (
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          Use Backup Code
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Enter one of your backup codes to sign in
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX"
          disabled={loading}
          className="w-full px-4 py-3 text-center text-lg font-mono tracking-wider border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          autoFocus
        />

        <label className="flex items-center justify-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
          />
          <span className="text-sm text-slate-600">
            Remember this device for 30 days
          </span>
        </label>

        <div className="space-y-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={code.length < 8}
          >
            Verify Backup Code
          </Button>

          <Button
            variant="ghost"
            fullWidth
            onClick={onCancel}
            disabled={loading}
          >
            Back to 2FA Code
          </Button>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Backup codes can only be used once each.
        </p>
      </form>
    </div>
  );
}
