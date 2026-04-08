import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, AlertCircle, Loader, X, Bell } from 'lucide-react';
import './sms.css';

/**
 * SMSSettingsPanel - Manage SMS notifications settings and phone verification
 * Features:
 * - Phone number verification with SMS code
 * - Toggle notification types on/off
 * - Set daily/weekly SMS limits
 * - Opt-in/out of SMS notifications
 */
export default function SMSSettingsPanel() {
  const { slug } = useParams();
  
  // Phone verification
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationStep, setVerificationStep] = useState('phone'); // phone, verify, confirmed
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Settings
  const [smsSettings, setSmsSettings] = useState(null);
  const [notifications, setNotifications] = useState({});
  const [dailyLimit, setDailyLimit] = useState(10);
  const [weeklyLimit, setWeeklyLimit] = useState(50);
  const [smsEnabled, setSmsEnabled] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [slug]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${window.API_URL}/sms/settings?organizationSlug=${slug}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSmsSettings(data);
        setPhoneNumber(data.phoneNumber || '');
        setVerificationStep(data.isPhoneVerified ? 'confirmed' : 'phone');
        setNotifications(data.notifications || {});
        setDailyLimit(data.dailyLimit || 10);
        setWeeklyLimit(data.weeklyLimit || 50);
        setSmsEnabled(data.smsEnabled || false);
      }
    } catch (err) {
      setError('Failed to load SMS settings');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      setError('Phone number must be in E.164 format: +1234567890');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');

      const response = await fetch(`${window.API_URL}/sms/settings/verify-phone?organizationSlug=${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ phoneNumber })
      });

      if (!response.ok) throw new Error('Failed to send verification code');

      setVerificationStep('verify');
      setSuccess('Verification code sent to your phone');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length !== 6) {
      setError('Verification code must be 6 digits');
      return;
    }

    try {
      setIsVerifying(true);
      setError('');

      const response = await fetch(`${window.API_URL}/sms/settings/confirm-phone?organizationSlug=${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ verificationCode })
      });

      if (!response.ok) throw new Error('Invalid verification code');

      setVerificationStep('confirmed');
      setSmsEnabled(true);
      setSuccess('Phone number verified! SMS notifications enabled.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNotificationToggle = (type) => {
    setNotifications({
      ...notifications,
      [type]: !notifications[type]
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      setError('');

      const response = await fetch(`${window.API_URL}/sms/settings?organizationSlug=${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          notifications,
          dailyLimit,
          weeklyLimit
        })
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSuccess('SMS settings saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="sms-settings-loading">Loading SMS settings...</div>;
  }

  return (
    <div className="sms-settings-container">
      <div className="sms-settings-header">
        <Bell className="icon-large" />
        <h2>SMS Notifications</h2>
        <p>Receive text messages for important updates and alerts</p>
      </div>

      {error && (
        <div className="sms-alert error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="sms-alert success-alert">
          <Check size={20} />
          <span>{success}</span>
        </div>
      )}

      <div className="sms-settings-content">
        {/* PHONE VERIFICATION SECTION */}
        <div className="sms-card">
          <div className="card-header">
            <h3>📱 Phone Verification</h3>
            {smsSettings?.isPhoneVerified && (
              <span className="badge-verified">✓ Verified</span>
            )}
          </div>

          {verificationStep === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="verify-form">
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  disabled={isVerifying}
                />
                <small>Format: +1 (country code) (number)</small>
              </div>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isVerifying}
              >
                {isVerifying ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {verificationStep === 'verify' && (
            <form onSubmit={handleVerifyCode} className="verify-form">
              <p className="verification-info">
                Enter the 6-digit code sent to {phoneNumber}
              </p>
              <div className="form-group">
                <label htmlFor="code">Verification Code</label>
                <input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
                  placeholder="000000"
                  maxLength="6"
                  disabled={isVerifying}
                  autoFocus
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isVerifying || verificationCode.length !== 6}
              >
                {isVerifying ? 'Verifying...' : 'Verify Code'}
              </button>
              <button 
                type="button"
                className="btn-secondary"
                onClick={() => setVerificationStep('phone')}
                disabled={isVerifying}
              >
                Back
              </button>
            </form>
          )}

          {verificationStep === 'confirmed' && (
            <div className="verification-confirmed">
              <div className="confirmed-info">
                <Check size={32} className="success-icon" />
                <p>Phone number verified</p>
                <p className="phone-display">{phoneNumber}</p>
              </div>
              <button 
                className="btn-secondary"
                onClick={() => setVerificationStep('phone')}
              >
                Change Phone Number
              </button>
            </div>
          )}
        </div>

        {/* NOTIFICATION PREFERENCES */}
        {verificationStep === 'confirmed' && (
          <>
            <div className="sms-card">
              <div className="card-header">
                <h3>🔔 Notification Preferences</h3>
              </div>

              <form onSubmit={handleSaveSettings} className="preferences-form">
                <div className="notification-group">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={notifications.redemptionApprovals || false}
                      onChange={() => handleNotificationToggle('redemptionApprovals')}
                    />
                    <span>Redemption Approvals</span>
                    <small>Get alerted when your reward requests are approved</small>
                  </label>

                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={notifications.fulfillmentReady || false}
                      onChange={() => handleNotificationToggle('fulfillmentReady')}
                    />
                    <span>Fulfillment Ready</span>
                    <small>Know when your reward is ready for pickup or delivery</small>
                  </label>

                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={notifications.lowPointsAlert || false}
                      onChange={() => handleNotificationToggle('lowPointsAlert')}
                    />
                    <span>Low Points Alert</span>
                    <small>Get notified when your points are running low</small>
                  </label>

                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={notifications.newRewards || false}
                      onChange={() => handleNotificationToggle('newRewards')}
                    />
                    <span>New Rewards Available</span>
                    <small>Learn about new rewards you can redeem</small>
                  </label>

                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={notifications.achievements || false}
                      onChange={() => handleNotificationToggle('achievements')}
                    />
                    <span>Achievements Unlocked</span>
                    <small>Celebrate when you earn new badges</small>
                  </label>

                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={notifications.systemAlerts || false}
                      onChange={() => handleNotificationToggle('systemAlerts')}
                    />
                    <span>System Alerts</span>
                    <small>Important platform announcements</small>
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </button>
              </form>
            </div>

            {/* RATE LIMITS */}
            <div className="sms-card">
              <div className="card-header">
                <h3>⏱️ Rate Limits</h3>
              </div>

              <form onSubmit={handleSaveSettings} className="limits-form">
                <div className="limit-group">
                  <label>
                    Daily SMS Limit
                    <input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Math.max(1, parseInt(e.target.value)))}
                      min="1"
                      max="100"
                    />
                    <small>Maximum SMS messages per day</small>
                  </label>

                  <label>
                    Weekly SMS Limit
                    <input
                      type="number"
                      value={weeklyLimit}
                      onChange={(e) => setWeeklyLimit(Math.max(1, parseInt(e.target.value)))}
                      min="1"
                      max="500"
                    />
                    <small>Maximum SMS messages per week</small>
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Update Limits'}
                </button>
              </form>
            </div>

            {/* INFO SECTION */}
            <div className="sms-card info-card">
              <h4>💡 SMS Information</h4>
              <ul>
                <li>Standard SMS rates may apply based on your carrier</li>
                <li>You can opt-out anytime by disabling notifications</li>
                <li>SMS messages arrive within 1-2 minutes</li>
                <li>We never share your phone number with third parties</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
