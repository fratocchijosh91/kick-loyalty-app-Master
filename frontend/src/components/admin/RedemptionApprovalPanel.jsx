import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Package, AlertCircle, Send } from 'lucide-react';
import './admin.css';

/**
 * RedemptionApprovalPanel - Admin dashboard for reviewing and fulfilling redemptions
 * Features:
 * - Queue of pending redemptions (oldest first)
 * - Approve/Reject/Fulfill actions
 * - Modal dialogs for actions with specific inputs
 * - Fulfillment method selection (digital/physical/credit/voucher)
 * - Real-time status updates
 * - Statistics summary
 */
export default function RedemptionApprovalPanel() {
  const { slug } = useParams();
  const [pending, setPending] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPending, setTotalPending] = useState(0);
  
  // Modal states
  const [selectedRedemption, setSelectedRedemption] = useState(null);
  const [modalType, setModalType] = useState(null); // approve, reject, fulfill
  const [modalData, setModalData] = useState({
    comments: '',
    fulfillmentMethod: 'digital',
    trackingNumber: '',
    voucherCode: '',
    creditAmount: '',
    downloadLink: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const itemsPerPage = 10;

  // Fetch pending redemptions and stats
  useEffect(() => {
    fetchData();
  }, [slug, page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch pending redemptions
      const params = new URLSearchParams({ page, limit: itemsPerPage });
      const response = await fetch(
        `${window.API_URL}/redemptions/pending?${params}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch pending redemptions');
      const data = await response.json();
      setPending(data.redemptions || []);
      setTotalPending(data.total || 0);

      // Fetch stats
      try {
        const statsRes = await fetch(
          `${window.API_URL}/redemptions/stats`,
          { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
        );
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (err) {
        console.warn('Could not fetch stats');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type, redemption) => {
    setSelectedRedemption(redemption);
    setModalType(type);
    setModalData({
      comments: '',
      fulfillmentMethod: 'digital',
      trackingNumber: '',
      voucherCode: '',
      creditAmount: '',
      downloadLink: ''
    });
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedRedemption(null);
  };

  const handleApprove = async () => {
    if (!selectedRedemption) return;

    try {
      setIsProcessing(true);
      const response = await fetch(
        `${window.API_URL}/redemptions/${selectedRedemption._id}/approve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            approverComments: modalData.comments || undefined
          })
        }
      );

      if (!response.ok) throw new Error('Failed to approve redemption');

      // Remove from pending list
      setPending(pending.filter(r => r._id !== selectedRedemption._id));
      setTotalPending(totalPending - 1);
      closeModal();
      
      // Show success message
      alert('Redemption approved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRedemption || !modalData.comments.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch(
        `${window.API_URL}/redemptions/${selectedRedemption._id}/reject`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            reason: modalData.comments
          })
        }
      );

      if (!response.ok) throw new Error('Failed to reject redemption');

      setPending(pending.filter(r => r._id !== selectedRedemption._id));
      setTotalPending(totalPending - 1);
      closeModal();
      
      alert('Redemption rejected successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFulfill = async () => {
    if (!selectedRedemption) return;

    const fulfillmentDetails = {};
    
    switch (modalData.fulfillmentMethod) {
      case 'digital':
        if (modalData.downloadLink) fulfillmentDetails.downloadLink = modalData.downloadLink;
        break;
      case 'physical':
        if (modalData.trackingNumber) fulfillmentDetails.trackingNumber = modalData.trackingNumber;
        break;
      case 'credit':
        if (modalData.creditAmount) fulfillmentDetails.creditAmount = parseFloat(modalData.creditAmount);
        break;
      case 'voucher':
        if (modalData.voucherCode) fulfillmentDetails.voucherCode = modalData.voucherCode;
        break;
      default:
        break;
    }

    try {
      setIsProcessing(true);
      const response = await fetch(
        `${window.API_URL}/redemptions/${selectedRedemption._id}/fulfill`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            fulfillmentMethod: modalData.fulfillmentMethod,
            fulfillmentDetails
          })
        }
      );

      if (!response.ok) throw new Error('Failed to fulfill redemption');

      setPending(pending.filter(r => r._id !== selectedRedemption._id));
      setTotalPending(totalPending - 1);
      closeModal();
      
      alert('Redemption fulfilled successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasMore = page * itemsPerPage < totalPending;

  if (loading && pending.length === 0) {
    return <div className="approval-loading">Loading pending redemptions...</div>;
  }

  return (
    <div className="approval-panel-container">
      <div className="approval-header">
        <h2>Redemption Approval Queue</h2>
        <p>Review and process pending reward redemption requests</p>
      </div>

      {error && (
        <div className="approval-alert error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {stats && (
        <div className="approval-stats">
          <div className="stat-card">
            <div className="stat-number">{stats.statuses?.pending || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.statuses?.approved || 0}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.statuses?.fulfilled || 0}</div>
            <div className="stat-label">Fulfilled</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.statuses?.rejected || 0}</div>
            <div className="stat-label">Rejected</div>
          </div>
          {stats.totalPointsRedeemed && (
            <div className="stat-card">
              <div className="stat-number">{stats.totalPointsRedeemed.toLocaleString()}</div>
              <div className="stat-label">Total Points</div>
            </div>
          )}
        </div>
      )}

      {pending.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={48} className="success" />
          <p>No pending redemptions</p>
          <p className="secondary">All redemptions are up to date!</p>
        </div>
      ) : (
        <>
          <div className="approval-queue">
            {pending.map(redemption => (
              <div key={redemption._id} className="approval-card">
                <div className="card-header">
                  <div className="requester-info">
                    <h4>{redemption.viewerUsername || 'User'}</h4>
                    <p className="requested-date">Requested: {formatDate(redemption.requestedAt)}</p>
                  </div>
                  <div className="card-actions">
                    <button
                      className="btn-action approve"
                      onClick={() => openModal('approve', redemption)}
                      title="Approve this redemption"
                    >
                      <CheckCircle size={18} />
                      Approve
                    </button>
                    <button
                      className="btn-action fulfill"
                      onClick={() => openModal('fulfill', redemption)}
                      title="Mark as fulfilled"
                    >
                      <Package size={18} />
                      Fulfill
                    </button>
                    <button
                      className="btn-action reject"
                      onClick={() => openModal('reject', redemption)}
                      title="Reject this redemption"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                  </div>
                </div>

                <div className="card-content">
                  <div className="content-row">
                    <label>Reward</label>
                    <span>
                      {redemption.reward?.icon && <span className="icon">{redemption.reward.icon}</span>}
                      {redemption.reward?.name || 'Unknown'}
                    </span>
                  </div>
                  <div className="content-row">
                    <label>Quantity / Points</label>
                    <span>{redemption.quantity} × {redemption.reward?.pointsCost || 0} = {redemption.pointsSpent.toLocaleString()} pts</span>
                  </div>
                  <div className="content-row">
                    <label>Status</label>
                    <span className="badge badge-warning">⏳ Pending</span>
                  </div>
                  {redemption.expiresAt && (
                    <div className="content-row">
                      <label>Expires</label>
                      <span>{formatDate(redemption.expiresAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
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
              Page {page} of {Math.ceil(totalPending / itemsPerPage)} ({totalPending} total)
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

      {/* MODALS */}
      {modalType && selectedRedemption && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modalType === 'approve' && 'Approve Redemption'}
                {modalType === 'reject' && 'Reject Redemption'}
                {modalType === 'fulfill' && 'Fulfill Redemption'}
              </h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="modal-info">
                <p><strong>Viewer:</strong> {selectedRedemption.viewerUsername}</p>
                <p><strong>Reward:</strong> {selectedRedemption.reward?.name}</p>
                <p><strong>Quantity:</strong> {selectedRedemption.quantity}</p>
                <p><strong>Points:</strong> {selectedRedemption.pointsSpent.toLocaleString()}</p>
              </div>

              {(modalType === 'approve' || modalType === 'reject') && (
                <div className="form-group">
                  <label htmlFor="comments">
                    {modalType === 'approve' ? 'Optional Comments' : 'Reason (required)'}
                  </label>
                  <textarea
                    id="comments"
                    value={modalData.comments}
                    onChange={(e) => setModalData({ ...modalData, comments: e.target.value })}
                    placeholder={modalType === 'reject' ? 'Why are you rejecting this redemption?' : 'Add any notes...'}
                    rows={3}
                  />
                </div>
              )}

              {modalType === 'fulfill' && (
                <>
                  <div className="form-group">
                    <label htmlFor="method">Fulfillment Method</label>
                    <select
                      id="method"
                      value={modalData.fulfillmentMethod}
                      onChange={(e) => setModalData({ ...modalData, fulfillmentMethod: e.target.value })}
                    >
                      <option value="digital">📥 Digital Download</option>
                      <option value="physical">📦 Physical Shipment</option>
                      <option value="credit">💳 Account Credit</option>
                      <option value="voucher">🎟️ Voucher/Code</option>
                      <option value="other">📋 Other</option>
                    </select>
                  </div>

                  {modalData.fulfillmentMethod === 'digital' && (
                    <div className="form-group">
                      <label htmlFor="link">Download Link</label>
                      <input
                        id="link"
                        type="url"
                        value={modalData.downloadLink}
                        onChange={(e) => setModalData({ ...modalData, downloadLink: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  {modalData.fulfillmentMethod === 'physical' && (
                    <div className="form-group">
                      <label htmlFor="tracking">Tracking Number</label>
                      <input
                        id="tracking"
                        type="text"
                        value={modalData.trackingNumber}
                        onChange={(e) => setModalData({ ...modalData, trackingNumber: e.target.value })}
                        placeholder="Enter tracking number..."
                      />
                    </div>
                  )}

                  {modalData.fulfillmentMethod === 'credit' && (
                    <div className="form-group">
                      <label htmlFor="credit">Credit Amount ($)</label>
                      <input
                        id="credit"
                        type="number"
                        value={modalData.creditAmount}
                        onChange={(e) => setModalData({ ...modalData, creditAmount: e.target.value })}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}

                  {modalData.fulfillmentMethod === 'voucher' && (
                    <div className="form-group">
                      <label htmlFor="voucher">Voucher Code</label>
                      <input
                        id="voucher"
                        type="text"
                        value={modalData.voucherCode}
                        onChange={(e) => setModalData({ ...modalData, voucherCode: e.target.value })}
                        placeholder="Enter voucher code..."
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal} disabled={isProcessing}>
                Cancel
              </button>
              <button
                className={`btn-primary btn-${modalType}`}
                onClick={() => {
                  if (modalType === 'approve') handleApprove();
                  else if (modalType === 'reject') handleReject();
                  else if (modalType === 'fulfill') handleFulfill();
                }}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : (
                  modalType === 'approve' ? 'Approve' :
                  modalType === 'reject' ? 'Reject' :
                  'Fulfill'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
