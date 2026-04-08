import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Check, Clock, Gift } from 'lucide-react';
import './redemptions.css';

/**
 * RedemptionRequestForm - Allows viewers to request reward redemptions
 * Features:
 * - Display available rewards with point costs
 * - Quantity selection with validation
 * - Real-time balance checking
 * - Success confirmation with expiry date
 */
export default function RedemptionRequestForm() {
  const { slug } = useParams();
  const [rewards, setRewards] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [userBalance, setUserBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch rewards and user balance
  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch rewards
      const rewardsRes = await fetch(`${window.API_URL}/rewards?organizationSlug=${slug}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (!rewardsRes.ok) throw new Error('Failed to fetch rewards');
      const rewardsData = await rewardsRes.json();
      setRewards(rewardsData.data || []);

      // Fetch user balance
      const balanceRes = await fetch(`${window.API_URL}/viewers/me?organizationSlug=${slug}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (balanceRes.ok) {
        const userData = await balanceRes.json();
        setUserBalance(userData.points || 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRewardSelect = (reward) => {
    setSelectedReward(reward);
    setQuantity(1);
    setError('');
    setSuccess(null);
  };

  const calculateTotalCost = () => {
    if (!selectedReward) return 0;
    return selectedReward.pointsCost * quantity;
  };

  const canRedeemMore = () => {
    if (!selectedReward) return false;
    const totalCost = calculateTotalCost();
    return totalCost <= userBalance && quantity > 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedReward) {
      setError('Please select a reward');
      return;
    }

    const totalCost = calculateTotalCost();
    if (totalCost > userBalance) {
      setError('Insufficient balance for this redemption');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const response = await fetch(`${window.API_URL}/redemptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          rewardId: selectedReward._id,
          quantity: quantity
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create redemption');
      }

      const result = await response.json();
      
      // Format expiry date
      const expiryDate = new Date(result.expiresAt).toLocaleDateString();
      
      setSuccess({
        message: `Redemption request submitted successfully!`,
        redemptionId: result._id,
        expiresAt: expiryDate,
        pointsSpent: totalCost,
        status: result.status
      });

      // Reset form
      setSelectedReward(null);
      setQuantity(1);
      
      // Update balance
      setUserBalance(userBalance - totalCost);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="redemption-loading">Loading rewards...</div>;
  }

  return (
    <div className="redemption-form-container">
      <div className="redemption-form-header">
        <Gift className="icon-large" />
        <h2>Request a Reward</h2>
        <p>Your current balance: <strong>{userBalance.toLocaleString()} points</strong></p>
      </div>

      {error && (
        <div className="redemption-alert error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="redemption-alert success-alert">
          <Check size={20} />
          <div>
            <p>{success.message}</p>
            <p style={{ fontSize: '0.9em', marginTop: '0.5em' }}>
              Request ID: {success.redemptionId} | Expires: {success.expiresAt}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="redemption-form">
        <div className="rewards-grid">
          {rewards
            .filter(r => r.active)
            .map(reward => (
              <div
                key={reward._id}
                className={`reward-card ${selectedReward?._id === reward._id ? 'selected' : ''}`}
                onClick={() => handleRewardSelect(reward)}
              >
                <div className="reward-card-header">
                  <h3>{reward.name}</h3>
                  {reward.icon && <span className="reward-icon">{reward.icon}</span>}
                </div>
                
                <p className="reward-description">{reward.description}</p>
                
                <div className="reward-cost">
                  <span className="cost-label">Points:</span>
                  <span className="cost-value">{reward.pointsCost.toLocaleString()}</span>
                </div>

                {reward.inventory !== null && (
                  <div className="reward-stock">
                    Remaining: {reward.inventory}
                  </div>
                )}
              </div>
            ))}
        </div>

        {selectedReward && (
          <div className="redemption-form-details">
            <h3>Redemption Details</h3>
            
            <div className="form-group">
              <label htmlFor="quantity">Quantity</label>
              <div className="quantity-input">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                />
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={selectedReward.inventory !== null && quantity >= selectedReward.inventory}
                >
                  +
                </button>
              </div>
            </div>

            <div className="form-summary">
              <div className="summary-row">
                <span>Points per unit:</span>
                <strong>{selectedReward.pointsCost.toLocaleString()}</strong>
              </div>
              <div className="summary-row">
                <span>Quantity:</span>
                <strong>{quantity}</strong>
              </div>
              <div className="summary-row total">
                <span>Total cost:</span>
                <strong>{calculateTotalCost().toLocaleString()} points</strong>
              </div>
              <div className="summary-row">
                <span>Remaining balance:</span>
                <strong className={userBalance - calculateTotalCost() >= 0 ? 'success' : 'error'}>
                  {Math.max(0, userBalance - calculateTotalCost()).toLocaleString()} points
                </strong>
              </div>
            </div>

            {!canRedeemMore() && (
              <div className="redemption-alert warning-alert">
                <AlertCircle size={20} />
                <span>Insufficient points for this redemption</span>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={!canRedeemMore() || isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'Request Redemption'}
            </button>
          </div>
        )}

        {!selectedReward && rewards.length === 0 && (
          <div className="no-rewards">
            <p>No rewards available for redemption</p>
          </div>
        )}
      </form>
    </div>
  );
}
