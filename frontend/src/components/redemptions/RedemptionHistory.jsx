import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, AlertCircle, Package, Truck, CreditCard } from 'lucide-react';
import './redemptions.css';

/**
 * RedemptionHistory - Display user's redemption history with status filtering
 * Features:
 * - Tabs for different statuses (pending, approved, fulfilled, rejected)
 * - Sortable table with reward info, status, points, dates
 * - Color-coded status badges
 * - Fulfillment details display
 * - Cancellation option for pending items
 */
export default function RedemptionHistory() {
  const { slug } = useParams();
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRedemption, setSelectedRedemption] = useState(null);

  const itemsPerPage = 10;
  const statuses = ['pending', 'approved', 'fulfilled', 'rejected'];

  // Fetch redemptions
  useEffect(() => {
    fetchRedemptions();
  }, [slug, activeTab, page]);

  const fetchRedemptions = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        status: activeTab,
        page: page,
        limit: itemsPerPage
      });

      const response = await fetch(
        `${window.API_URL}/redemptions?${params}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch redemptions');
      
      const data = await response.json();
      setRedemptions(data.data || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'warning', icon: Clock, label: 'Pending Approval' },
      approved: { color: 'info', icon: CheckCircle, label: 'Approved' },
      fulfilled: { color: 'success', icon: Package, label: 'Fulfilled' },
      rejected: { color: 'danger', icon: XCircle, label: 'Rejected' },
      expired: { color: 'danger', icon: AlertCircle, label: 'Expired' },
      cancelled: { color: 'secondary', icon: XCircle, label: 'Cancelled' }
    };

    const badge = badges[status] || badges.pending;
    const IconComponent = badge.icon;

    return (
      <span className={`badge badge-${badge.color}`}>
        <IconComponent size={14} style={{ marginRight: '0.4em' }} />
        {badge.label}
      </span>
    );
  };

  const getFulfillmentIcon = (method) => {
    const icons = {
      digital: '📥',
      physical: '📦',
      credit: '💳',
      voucher: '🎟️',
      other: '📋'
    };
    return icons[method] || '📋';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const hasMore = page * itemsPerPage < totalCount;

  if (loading && redemptions.length === 0) {
    return <div className="redemption-loading">Loading redemption history...</div>;
  }

  return (
    <div className="redemption-history-container">
      <div className="redemption-history-header">
        <h2>My Redemptions</h2>
        <p>View and track all your reward redemption requests</p>
      </div>

      {error && (
        <div className="redemption-alert error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="history-tabs">
        {statuses.map(status => (
          <button
            key={status}
            className={`tab-button ${activeTab === status ? 'active' : ''}`}
            onClick={() => handleTabChange(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="tab-count">
              {redemptions.length > 0 && status === activeTab ? redemptions.length : ''}
            </span>
          </button>
        ))}
      </div>

      {redemptions.length === 0 ? (
        <div className="empty-state">
          <Clock size={48} />
          <p>No {activeTab} redemptions</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="redemption-table">
              <thead>
                <tr>
                  <th>Reward</th>
                  <th>Quantity</th>
                  <th>Points Spent</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map(redemption => (
                  <React.Fragment key={redemption._id}>
                    <tr className="table-row">
                      <td className="reward-name">
                        {redemption.reward?.icon && <span className="icon">{redemption.reward.icon}</span>}
                        {redemption.reward?.name || 'Unknown Reward'}
                      </td>
                      <td>{redemption.quantity}</td>
                      <td className="points-value">{redemption.pointsSpent.toLocaleString()}</td>
                      <td className="date-value">{formatDate(redemption.requestedAt)}</td>
                      <td>{getStatusBadge(redemption.status)}</td>
                      <td>
                        <button
                          className="btn-small"
                          onClick={() => setSelectedRedemption(
                            selectedRedemption?._id === redemption._id ? null : redemption
                          )}
                        >
                          {selectedRedemption?._id === redemption._id ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {selectedRedemption?._id === redemption._id && (
                      <tr className="detail-row">
                        <td colSpan="6">
                          <div className="redemption-details">
                            <div className="detail-grid">
                              <div className="detail-item">
                                <label>ID</label>
                                <code>{redemption._id}</code>
                              </div>

                              {redemption.approverComments && (
                                <div className="detail-item">
                                  <label>Approver Notes</label>
                                  <p>{redemption.approverComments}</p>
                                </div>
                              )}

                              {redemption.reviewedAt && (
                                <div className="detail-item">
                                  <label>Reviewed</label>
                                  <p>{formatDate(redemption.reviewedAt)}</p>
                                </div>
                              )}

                              {redemption.status === 'fulfilled' && redemption.fulfillmentDetails && (
                                <>
                                  <div className="detail-item">
                                    <label>Fulfillment Method</label>
                                    <p>
                                      {getFulfillmentIcon(redemption.fulfillmentMethod)} {redemption.fulfillmentMethod.charAt(0).toUpperCase() + redemption.fulfillmentMethod.slice(1)}
                                    </p>
                                  </div>

                                  <div className="detail-item">
                                    <label>Fulfillment Details</label>
                                    <div className="fulfillment-info">
                                      {redemption.fulfillmentMethod === 'digital' && redemption.fulfillmentDetails.downloadLink && (
                                        <>
                                          <p><strong>Download:</strong></p>
                                          <a href={redemption.fulfillmentDetails.downloadLink} target="_blank" rel="noopener noreferrer" className="link">
                                            {redemption.fulfillmentDetails.downloadLink}
                                          </a>
                                        </>
                                      )}
                                      {redemption.fulfillmentMethod === 'physical' && (
                                        <>
                                          {redemption.fulfillmentDetails.trackingNumber && (
                                            <p><strong>Tracking #:</strong> {redemption.fulfillmentDetails.trackingNumber}</p>
                                          )}
                                          {redemption.fulfillmentDetails.carrier && (
                                            <p><strong>Carrier:</strong> {redemption.fulfillmentDetails.carrier}</p>
                                          )}
                                        </>
                                      )}
                                      {redemption.fulfillmentMethod === 'credit' && redemption.fulfillmentDetails.creditAmount && (
                                        <p><strong>Credit Amount:</strong> ${redemption.fulfillmentDetails.creditAmount}</p>
                                      )}
                                      {redemption.fulfillmentMethod === 'voucher' && redemption.fulfillmentDetails.voucherCode && (
                                        <p><strong>Code:</strong> <code>{redemption.fulfillmentDetails.voucherCode}</code></p>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}

                              {redemption.status === 'fulfilled' && redemption.fulfilledAt && (
                                <div className="detail-item">
                                  <label>Fulfilled Date</label>
                                  <p>{formatDate(redemption.fulfilledAt)}</p>
                                </div>
                              )}

                              {redemption.status === 'rejected' && redemption.approverComments && (
                                <div className="detail-item rejection">
                                  <label>Rejection Reason</label>
                                  <p>{redemption.approverComments}</p>
                                </div>
                              )}

                              {redemption.expiresAt && (
                                <div className="detail-item">
                                  <label>Expires</label>
                                  <p>{formatDate(redemption.expiresAt)}</p>
                                </div>
                              )}
                            </div>

                            {redemption.activityLog && redemption.activityLog.length > 0 && (
                              <div className="activity-log">
                                <h4>Activity Log</h4>
                                <ul>
                                  {redemption.activityLog.map((activity, idx) => (
                                    <li key={idx}>
                                      <span className="activity-action">{activity.action}</span>
                                      <span className="activity-by">by {activity.by}</span>
                                      <span className="activity-time">{formatDate(activity.timestamp)}</span>
                                      {activity.notes && <span className="activity-notes">({activity.notes})</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn-pagination"
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {page} ({redemptions.length} items)
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={!hasMore}
              className="btn-pagination"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
