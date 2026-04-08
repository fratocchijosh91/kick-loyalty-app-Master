import React, { useState } from 'react';
import { Shield, Copy, Download, Trash2, Check, AlertCircle } from 'lucide-react';

/**
 * TwoFactorSetup Component
 * Modal/section for enabling and managing 2FA
 * Call from SettingsPage
 */
export default function TwoFactorSetup({ onEnable, onDisable }) {
  const [step, setStep] = useState('status'); // status | setup | verify | enabled
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [twoFAStatus, setTwoFAStatus] = useState(null);

  // Fetch 2FA status on mount
  React.useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/2fa/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setTwoFAStatus(data);
      setStep(data.enabled ? 'enabled' : 'status');
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    }
  };

  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep('setup');
    } catch (err) {
      setError('Failed to setup 2FA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: verifyCode })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Verification failed');
      }

      const data = await res.json();
      setBackupCodes(data.backupCodes.map(bc => bc.code));
      setStep('enabled');
      setStatus('success');
      onEnable?.();
    } catch (err) {
      setError('Invalid code. Please try again: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Are you sure? This will disable 2FA on your account.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const disableCode = prompt('Enter a 2FA code to confirm:');
      
      if (!disableCode) return;

      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: disableCode })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disable 2FA');
      }

      setStep('status');
      setQrCode(null);
      setSecret(null);
      setBackupCodes(null);
      setVerifyCode('');
      setStatus(null);
      onDisable?.();
      fetchStatus();
    } catch (err) {
      setError('Failed to disable 2FA: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const downloadBackupCodes = () => {
    const content = backupCodes?.map((code, idx) => `${idx + 1}. ${code}`).join('\n');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', 'backup-codes.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Status view - not enabled
  if (step === 'status' && !twoFAStatus?.enabled) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="text-center">
          <Shield size={48} className="text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Enhance Your Security</h3>
          <p className="text-gray-600 mb-6">
            Two-Factor Authentication adds an extra layer of protection to your account
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="text-left space-y-2">
              <div className="flex items-start gap-3">
                <Check size={20} className="text-green-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">Time-based verification</p>
                  <p className="text-sm text-gray-600">Use an authenticator app on your phone</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check size={20} className="text-green-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">Backup codes</p>
                  <p className="text-sm text-gray-600">10 emergency codes if you lose your phone</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check size={20} className="text-green-600 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">Trusted devices</p>
                  <p className="text-sm text-gray-600">Skip 2FA on trusted computers</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleStartSetup}
            disabled={loading}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
          >
            {loading ? 'Setting up...' : 'Enable 2FA'}
          </button>
        </div>
      </div>
    );
  }

  // Setup view - scan QR and see secret
  if (step === 'setup' && qrCode) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 max-w-2xl">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Setup Two-Factor Authentication</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: QR Code */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-600 font-semibold">STEP 1: Scan QR Code</p>
            <img src={qrCode} alt="QR Code" className="border-4 border-gray-300 p-2 rounded" />
            <p className="text-xs text-gray-500 text-center">
              Use Google Authenticator, Microsoft Authenticator, Authy, or any TOTP app
            </p>
          </div>

          {/* Right: Secret & Next */}
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-sm text-gray-600 font-semibold mb-4">STEP 2: Or Enter Manually</p>
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-600 mb-2">Your Secret Key:</p>
                <div className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded p-3">
                  <code className="font-mono text-lg font-bold text-gray-900">{secret}</code>
                  <button
                    onClick={() => copyToClipboard(secret)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-900 font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Important
                </p>
                <p className="text-xs text-amber-800">
                  Store your secret key in a safe place. You'll need it if you lose access to your authenticator app.
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 font-semibold mb-4">STEP 3: Enter Verification Code</p>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <input
                  type="text"
                  placeholder="000000"
                  maxLength="6"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold tracking-widest"
                />
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifyCode.length < 6 || loading}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                >
                  {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Enabled view - show backup codes and options
  if (step === 'enabled' && backupCodes) {
    return (
      <div className="bg-white border border-green-200 rounded-lg p-8 bg-green-50">
        <div className="flex items-center gap-3 mb-6">
          <Check size={32} className="text-green-600" />
          <div>
            <h3 className="text-2xl font-bold text-gray-900">2FA Enabled!</h3>
            <p className="text-gray-600">Your account is now protected with two-factor authentication</p>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">Backup Codes</h4>
          <p className="text-sm text-gray-600 mb-4">
            Save these 10 codes in a safe place. You can use them to login if you lose your authenticator app.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-sm space-y-1 max-h-32 overflow-y-auto">
            {backupCodes.map((code, idx) => (
              <div key={idx} className="flex justify-between text-gray-800">
                <span>{idx + 1}.</span>
                <code>{code}</code>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => copyToClipboard(backupCodes.join('\n'))}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-semibold"
            >
              <Copy size={18} /> Copy
            </button>
            <button
              onClick={downloadBackupCodes}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-semibold"
            >
              <Download size={18} /> Download
            </button>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">Next time you login, you'll be asked for a code from your authenticator app</p>
          <button
            onClick={() => fetchStatus()}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Enabled view - management options
  if (step === 'enabled' && twoFAStatus?.enabled) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield size={32} className="text-green-600" />
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h3>
            <p className="text-green-600 font-semibold">✓ Enabled</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Status Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 font-semibold">Status</p>
            <p className="text-2xl font-bold text-green-600 mt-2">Active</p>
            <p className="text-xs text-gray-500 mt-2">
              Enabled on {new Date(twoFAStatus.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Backup Codes Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 font-semibold">Backup Codes</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              {twoFAStatus.backupCodesRemaining}/10
            </p>
            <p className="text-xs text-gray-500 mt-2">Remaining</p>
          </div>

          {/* Trusted Devices Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 font-semibold">Trusted Devices</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">
              {twoFAStatus.trustedDevices}
            </p>
            <p className="text-xs text-gray-500 mt-2">Devices</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <button
            className="w-full px-4 py-3 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 font-semibold text-left flex items-center gap-2"
          >
            <Download size={18} /> Download Backup Codes
          </button>

          <button
            onClick={handleDisable}
            disabled={loading}
            className="w-full px-4 py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-semibold text-left flex items-center gap-2"
          >
            <Trash2 size={18} /> Disable 2FA
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h4 className="font-bold text-gray-900 mb-4">How 2FA Works</h4>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="font-bold text-gray-900">1.</span>
              <span>When you login, you'll be asked for a code from your authenticator app</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-gray-900">2.</span>
              <span>Use backup codes if you lose access to your authenticator app</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-gray-900">3.</span>
              <span>Mark devices as trusted to skip 2FA on known computers</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  return null;
}
