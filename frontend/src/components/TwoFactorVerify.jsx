import React, { useState } from 'react';
import { Shield, AlertCircle } from 'lucide-react';

/**
 * TwoFactorVerify Component
 * Login modal for TOTP/backup code verification
 * Call from Login.jsx after password verification
 */
export default function TwoFactorVerify({ onVerifySuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [remainingCodes, setRemainingCodes] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/2fa/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          deviceName: trustDevice ? deviceName : undefined,
          trustDevice: trustDevice
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      const data = await response.json();
      setRemainingCodes(data.remainingCodes);
      
      onVerifySuccess({
        deviceId: data.deviceId || null,
        usedBackupCode: data.usedBackupCode || false,
        remainingCodes: data.remainingCodes || null
      });
    } catch (err) {
      console.error('2FA verification error:', err);
      
      if (err.message.includes('locked')) {
        setError('Too many failed attempts. Please try again in a few minutes.');
      } else if (err.message.includes('backup')) {
        setError('Invalid backup code. Please try another one.');
      } else {
        setError('Invalid code. Please try again.');
      }
      
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
    if (useBackupCode) return 'Enter backup code';
    return '000000';
  };

  const getMaxLength = () => {
    if (useBackupCode) return 100;
    return 6;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Shield size={32} />
            <h2 className="text-2xl font-bold">Verify Your Identity</h2>
          </div>
          <p className="text-blue-100 text-sm">
            {useBackupCode
              ? 'Enter one of your backup codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-8">
          <form onSubmit={handleVerify} className="space-y-6">
            {/* Code Input */}
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                {useBackupCode ? 'Backup Code' : 'Authentication Code'}
              </label>
              <input
                type="text"
                placeholder={getPlaceholder()}
                maxLength={getMaxLength()}
                value={code}
                onChange={(e) => {
                  if (useBackupCode) {
                    setCode(e.target.value);
                  } else {
                    setCode(e.target.value.replace(/\D/g, ''));
                  }
                }}
                className={`w-full px-4 py-3 border-2 rounded-lg font-bold tracking-widest text-center transition ${
                  useBackupCode
                    ? 'text-base'
                    : 'text-2xl'
                } ${
                  error
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 focus:border-blue-500 focus:bg-white'
                }`}
                autoFocus
              />
            </div>

            {/* Toggle Backup Code */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode('');
                  setError(null);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {useBackupCode
                  ? '← Back to Authenticator Code'
                  : 'Use a Backup Code Instead →'}
              </button>
            </div>

            {/* Trust Device */}
            {!useBackupCode && (
              <div className="space-y-3 border-t pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    Trust this device for 30 days
                  </span>
                </label>

                {trustDevice && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <input
                      type="text"
                      placeholder="Device name (e.g., Work Laptop)"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      maxLength="50"
                      className="w-full px-3 py-2 border border-blue-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-blue-700 mt-2">
                      You won't need to enter a code on this device for 30 days
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Remaining Codes Info */}
            {remainingCodes !== null && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  You have <strong>{remainingCodes}</strong> backup codes remaining
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-4 flex gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  (useBackupCode ? code.length < 1 : code.length < 6) ||
                  (trustDevice && !deviceName.trim())
                }
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </form>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              Lost your authenticator app?{' '}
              <a href="#" className="text-blue-600 hover:text-blue-700 font-semibold">
                Recovery options
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
