import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Gift, Shield } from 'lucide-react';
import RedemptionRequestForm from '../components/redemptions/RedemptionRequestForm';
import RedemptionHistory from '../components/redemptions/RedemptionHistory';
import RedemptionApprovalPanel from '../components/admin/RedemptionApprovalPanel';

/**
 * RedemptionsPage - Main page for redemption workflows
 * Shows different UIs based on user role:
 * - Viewers: Request form + history
 * - Admins: Approval panel + statistics
 */
export default function RedemptionsPage() {
  const { slug } = useParams();
  const [userRole, setUserRole] = useState('viewer');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('request');

  // Check user role on mount
  useEffect(() => {
    fetchUserRole();
  }, [slug]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch(
        `${window.API_URL}/org/${slug}/me`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (response.ok) {
        const userData = await response.json();
        // Check if user has admin permissions for redemptions
        const hasRedemptionPermission = userData.permissions?.includes('redemptions:approve');
        setUserRole(hasRedemptionPermission ? 'admin' : 'viewer');
      }
    } catch (err) {
      console.error('Failed to fetch user role:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="redemptions-page">
      {userRole === 'viewer' ? (
        // VIEWER VIEW: Request form + History
        <>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div className="page-tabs" style={{ borderBottom: '2px solid #e5e7eb', marginBottom: '2rem' }}>
              <button
                className={`tab-button ${activeTab === 'request' ? 'active' : ''}`}
                onClick={() => setActiveTab('request')}
                style={{
                  padding: '1rem 1.5rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'request' ? '3px solid #6366f1' : '3px solid transparent',
                  color: activeTab === 'request' ? '#6366f1' : '#6b7280',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Gift size={18} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Request Reward
              </button>
              <button
                className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '1rem 1.5rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'history' ? '3px solid #6366f1' : '3px solid transparent',
                  color: activeTab === 'history' ? '#6366f1' : '#6b7280',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📋 My Redemptions
              </button>
            </div>
          </div>

          {activeTab === 'request' && <RedemptionRequestForm />}
          {activeTab === 'history' && <RedemptionHistory />}
        </>
      ) : (
        // ADMIN VIEW: Approval panel
        <>
          <RedemptionApprovalPanel />
        </>
      )}
    </div>
  );
}
