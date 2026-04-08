import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Globe, Trash2, Lock, Unlock } from 'lucide-react';

/**
 * TrustedDevices Component
 * Display and manage trusted devices for 2FA
 * Call from SettingsPage 2FA settings section
 */
export default function TrustedDevices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrustedDevices();
  }, []);

  const fetchTrustedDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/2fa/trusted-devices', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch trusted devices');
      }

      const data = await res.json();
      setDevices(data.devices || []);
    } catch (err) {
      console.error('Error fetching trusted devices:', err);
      setError('Failed to load trusted devices');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!window.confirm('Remove this trusted device? You\'ll need to enter a 2FA code on your next login from this device.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/2fa/trusted-devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to remove device');
      }

      setDevices(devices.filter(d => d.deviceId !== deviceId));
    } catch (err) {
      console.error('Error removing device:', err);
      setError('Failed to remove device');
    }
  };

  const getDeviceIcon = (userAgent) => {
    const ua = (userAgent || '').toLowerCase();
    
    if (ua.includes('iphone') || ua.includes('ipad')) {
      return <Smartphone size={20} className="text-gray-600" />;
    } else if (ua.includes('android')) {
      return <Smartphone size={20} className="text-green-600" />;
    } else if (ua.includes('mac') || ua.includes('window') || ua.includes('linux')) {
      return <Monitor size={20} className="text-blue-600" />;
    }
    
    return <Globe size={20} className="text-gray-600" />;
  };

  const getDeviceType = (userAgent) => {
    const ua = (userAgent || '').toLowerCase();
    
    if (ua.includes('iphone')) {
      return 'iPhone';
    } else if (ua.includes('ipad')) {
      return 'iPad';
    } else if (ua.includes('android')) {
      return 'Android Device';
    } else if (ua.includes('mac')) {
      return 'Mac';
    } else if (ua.includes('window')) {
      return 'Windows';
    } else if (ua.includes('linux')) {
      return 'Linux';
    }
    
    return 'Device';
  };

  const isExpired = (trustedUntil) => {
    return new Date(trustedUntil) < new Date();
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading trusted devices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Trusted Devices</h3>
          <p className="text-sm text-gray-600 mt-1">
            Devices where you don't need to enter a 2FA code ({devices.length} device{devices.length !== 1 ? 's' : ''})
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {devices.length === 0 ? (
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-8 text-center">
          <Lock size={32} className="text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            No trusted devices yet. When you login with 2FA and choose to trust a device, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const expired = isExpired(device.trustedUntil);
            
            return (
              <div
                key={device.deviceId}
                className={`border rounded-lg p-4 flex items-start justify-between gap-4 ${
                  expired
                    ? 'bg-gray-50 border-gray-300 opacity-60'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Device Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getDeviceIcon(device.userAgent)}
                    <div>
                      <p className="font-bold text-gray-900">
                        {device.deviceName || getDeviceType(device.userAgent)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {device.ipAddress}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 ml-8 text-xs text-gray-600">
                    <p>
                      <strong>Trusted:</strong>{' '}
                      {new Date(device.trustedAt).toLocaleDateString()} at{' '}
                      {new Date(device.trustedAt).toLocaleTimeString()}
                    </p>
                    <p>
                      <strong>Expires:</strong>{' '}
                      {new Date(device.trustedUntil).toLocaleDateString()}
                      {expired && (
                        <span className="text-red-600 font-semibold"> (Expired)</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveDevice(device.deviceId)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded font-semibold text-sm transition"
                  title="Remove this trusted device"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {devices.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-900 flex items-start gap-2">
            <Unlock size={16} className="mt-1 flex-shrink-0" />
            <span>
              Trusted devices are remembered for 30 days. After that, you'll need to enter a 2FA code again.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
