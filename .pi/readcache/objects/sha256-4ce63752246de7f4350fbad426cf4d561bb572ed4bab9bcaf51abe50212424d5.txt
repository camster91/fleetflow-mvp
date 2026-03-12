import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { 
  Shield, 
  Lock, 
  Smartphone, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Eye,
  EyeOff,
  Key,
  History,
  Trash2,
  Download,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface SecuritySettings {
  twoFactorEnabled: boolean;
  lastPasswordChange: string | null;
  lastLoginAt: string | null;
  loginHistory: LoginRecord[];
}

interface LoginRecord {
  id: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  location?: string;
}

export default function SecuritySettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  
  // 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [settingUp2FA, setSettingUp2FA] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }

    if (status === 'authenticated') {
      fetchSecuritySettings();
    }
  }, [status, router]);

  const fetchSecuritySettings = async () => {
    try {
      const response = await fetch('/api/auth/security-settings');
      if (response.ok) {
        const data = await response.json();
        setSecuritySettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch security settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const start2FASetup = async () => {
    setSettingUp2FA(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to setup 2FA');
      }
      
      const data = await response.json();
      setTwoFASetup(data);
      setShow2FAModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup 2FA');
    } finally {
      setSettingUp2FA(false);
    }
  };

  const verifyAndEnable2FA = async () => {
    if (!twoFASetup || !twoFACode) return;
    
    setSettingUp2FA(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: twoFACode,
          backupCodes: twoFASetup.backupCodes,
          isSetup: true,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid code');
      }
      
      setSuccess('Two-factor authentication enabled successfully!');
      setShow2FAModal(false);
      setTwoFASetup(null);
      setTwoFACode('');
      fetchSecuritySettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setSettingUp2FA(false);
    }
  };

  const disable2FA = async (code: string) => {
    setSettingUp2FA(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disable 2FA');
      }
      
      setSuccess('Two-factor authentication disabled successfully!');
      fetchSecuritySettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setSettingUp2FA(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    setChangingPassword(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to change password');
      }
      
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadBackupCodes = () => {
    if (!twoFASetup) return;
    
    const content = `FleetFlow 2FA Backup Codes
Generated: ${new Date().toLocaleString()}

${twoFASetup.backupCodes.join('\n')}

IMPORTANT: Keep these codes in a safe place. Each code can only be used once.
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fleetflow-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="h-6 w-6 text-blue-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Security Settings</h1>
              <p className="text-slate-600">Manage your account security and authentication</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Security Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Two-Factor Authentication */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center space-x-3">
                  <Smartphone className="h-5 w-5 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Two-Factor Authentication</h2>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-900 font-medium">
                      {securitySettings?.twoFactorEnabled 
                        ? 'Two-factor authentication is enabled' 
                        : 'Add an extra layer of security'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {securitySettings?.twoFactorEnabled
                        ? 'Your account is protected with an authenticator app.'
                        : 'Protect your account by requiring a verification code in addition to your password.'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {securitySettings?.twoFactorEnabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>

                {!securitySettings?.twoFactorEnabled && (
                  <Button
                    variant="primary"
                    onClick={start2FASetup}
                    loading={settingUp2FA}
                    className="mt-4"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Enable 2FA
                  </Button>
                )}
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center space-x-3">
                  <Lock className="h-5 w-5 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
                </div>
              </div>
              <div className="p-6">
                <form onSubmit={changePassword} className="space-y-4">
                  <div className="relative">
                    <Input
                      label="Current Password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                  </div>

                  <div className="relative">
                    <Input
                      label="New Password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                  </div>

                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : undefined}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    loading={changingPassword}
                    disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Update Password
                  </Button>
                </form>
              </div>
            </div>

            {/* Login History */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <History className="h-5 w-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-900">Recent Login Activity</h2>
                  </div>
                  <Button variant="ghost" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-slate-200">
                {securitySettings?.loginHistory?.slice(0, 5).map((login) => (
                  <div key={login.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${login.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {login.success ? 'Successful login' : 'Failed login attempt'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(login.timestamp).toLocaleString()} • {login.ipAddress} • {login.location || 'Unknown location'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {!securitySettings?.loginHistory?.length && (
                  <div className="px-6 py-8 text-center text-slate-500">
                    No recent login activity
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Security Status */}
          <div className="space-y-6">
            {/* Security Status Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-semibold text-slate-900">Security Status</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-slate-700">Password set</span>
                </div>
                <div className="flex items-center space-x-3">
                  {securitySettings?.twoFactorEnabled ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-slate-700">2FA enabled</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <span className="text-sm text-slate-700">2FA not enabled</span>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-slate-700">Email verified</span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-lg shadow-sm border border-red-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-red-200 bg-red-50">
                <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button variant="danger" fullWidth>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Setup Modal */}
      {show2FAModal && twoFASetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Smartphone className="h-8 w-8 text-blue-900" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Set Up Two-Factor Authentication</h2>
              <p className="text-sm text-slate-600 mt-2">
                Scan the QR code with your authenticator app
              </p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <img 
                src={twoFASetup.qrCode} 
                alt="2FA QR Code" 
                className="w-48 h-48 border-4 border-white shadow-lg rounded-lg"
              />
            </div>

            {/* Manual Entry */}
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-600 mb-2">Can&apos;t scan? Enter this code manually:</p>
              <code className="block bg-slate-100 rounded px-3 py-2 text-sm font-mono break-all">
                {twoFASetup.secret}
              </code>
            </div>

            {/* Backup Codes */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-900">Backup Codes</p>
                <Button variant="ghost" size="sm" onClick={downloadBackupCodes}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {twoFASetup.backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="bg-slate-50 rounded px-2 py-1 text-xs font-mono text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Save these codes in a safe place. Each can only be used once.
              </p>
            </div>

            {/* Verification Code Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Enter 6-digit code from your app
              </label>
              <input
                type="text"
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-2 text-center text-2xl font-mono tracking-widest border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={6}
              />
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShow2FAModal(false);
                  setTwoFASetup(null);
                  setTwoFACode('');
                }}
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={verifyAndEnable2FA}
                loading={settingUp2FA}
                disabled={twoFACode.length !== 6}
                fullWidth
              >
                Verify & Enable
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
