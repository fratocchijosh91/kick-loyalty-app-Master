import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, Check, Plus, Edit2, Trash2, X } from 'lucide-react';
import './sms.css';

/**
 * SMSTemplateEditor - Admin panel for creating and managing SMS templates
 * Features:
 * - Create custom SMS templates with variable support
 * - Template type selection (redemption, achievement, etc.)
 * - Character counter with SMS segment display
 * - Auto-send scheduling on events
 * - Template CRUD operations
 */
export default function SMSTemplateEditor() {
  const { slug } = useParams();
  
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'custom',
    messageTemplate: '',
    description: '',
    autoSend: false,
    sendDelay: 0
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const SMS_TYPES = [
    { value: 'redemption_approved', label: '✅ Redemption Approved' },
    { value: 'redemption_rejected', label: '❌ Redemption Rejected' },
    { value: 'fulfillment_ready', label: '📦 Fulfillment Ready' },
    { value: 'low_points_alert', label: '⚠️ Low Points Alert' },
    { value: 'new_reward_available', label: '🎁 New Reward Available' },
    { value: 'achievement_unlocked', label: '🏆 Achievement Unlocked' },
    { value: 'leaderboard_milestone', label: '📊 Leaderboard Milestone' },
    { value: 'system_alert', label: '🔔 System Alert' },
    { value: 'custom', label: '📝 Custom Message' }
  ];

  const AVAILABLE_VARIABLES = {
    redemption_approved: ['rewardName', 'points', 'estimatedDelivery'],
    redemption_rejected: ['rewardName', 'reason'],
    fulfillment_ready: ['rewardName', 'pickupLocation', 'expiresAt'],
    achievement_unlocked: ['achievementName', 'achievementIcon'],
    low_points_alert: ['currentPoints', 'threshold'],
    new_reward_available: ['rewardName', 'pointsCost'],
    custom: []
  };

  // Fetch templates
  useEffect(() => {
    fetchTemplates();
  }, [slug]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${window.API_URL}/sms/templates?organizationSlug=${slug}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data || []);
      }
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template = null) => {
    if (template) {
      setFormData({
        name: template.name,
        type: template.type,
        messageTemplate: template.messageTemplate,
        description: template.description || '',
        autoSend: template.autoSend || false,
        sendDelay: template.sendDelay || 0
      });
      setEditingId(template._id);
    } else {
      setFormData({
        name: '',
        type: 'custom',
        messageTemplate: '',
        description: '',
        autoSend: false,
        sendDelay: 0
      });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      name: '',
      type: 'custom',
      messageTemplate: '',
      description: '',
      autoSend: false,
      sendDelay: 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.type || !formData.messageTemplate) {
      setError('Name, type, and message are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const endpoint = editingId 
        ? `${window.API_URL}/sms/templates/${editingId}?organizationSlug=${slug}`
        : `${window.API_URL}/sms/templates?organizationSlug=${slug}`;

      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save template');

      setSuccess(editingId ? 'Template updated successfully' : 'Template created successfully');
      handleCloseModal();
      fetchTemplates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      setError('');

      const response = await fetch(
        `${window.API_URL}/sms/templates/${id}?organizationSlug=${slug}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (!response.ok) throw new Error('Failed to delete template');

      setSuccess('Template deleted successfully');
      fetchTemplates();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const getCharacterCount = () => formData.messageTemplate.length;
  const getSegmentCount = () => {
    const hasUnicode = /[^\x00-\x7F]/.test(formData.messageTemplate);
    const limit = hasUnicode ? 67 : 160;
    return Math.ceil(formData.messageTemplate.length / limit);
  };

  const getVariablesForType = () => {
    return AVAILABLE_VARIABLES[formData.type] || [];
  };

  if (loading) {
    return <div className="sms-editor-loading">Loading templates...</div>;
  }

  return (
    <div className="sms-editor-container">
      <div className="sms-editor-header">
        <h2>📱 SMS Templates</h2>
        <p>Create and manage reusable SMS message templates</p>
        <button className="btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} />
          New Template
        </button>
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

      <div className="templates-grid">
        {templates.length === 0 ? (
          <div className="empty-state">
            <p>No templates yet. Create one to get started.</p>
          </div>
        ) : (
          templates.map(template => (
            <div key={template._id} className="template-card">
              <div className="template-header">
                <div>
                  <h4>{template.name}</h4>
                  <span className="template-type">
                    {SMS_TYPES.find(t => t.value === template.type)?.label || template.type}
                  </span>
                </div>
                <div className="template-actions">
                  <button
                    className="btn-icon edit"
                    onClick={() => handleOpenModal(template)}
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="btn-icon delete"
                    onClick={() => handleDelete(template._id)}
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="template-body">
                <p className="template-message">{template.messageTemplate}</p>
              </div>

              <div className="template-footer">
                <span className="char-count">{template.currentLength} chars</span>
                {template.autoSend && (
                  <span className="auto-send-badge">Auto-Send {template.sendDelay}s delay</span>
                )}
                <span className="usage-count">Used {template.usageCount} times</span>
              </div>

              {template.variables && template.variables.length > 0 && (
                <div className="template-variables">
                  <small>Variables: {template.variables.join(', ')}</small>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="sms-modal-overlay" onClick={handleCloseModal}>
          <div className="sms-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Edit Template' : 'New Template'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="template-form">
              <div className="form-group">
                <label htmlFor="name">Template Name</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Redemption Approved"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="type">Message Type</label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  {SMS_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {getVariablesForType().length > 0 && (
                <div className="variables-hint">
                  <small>Available variables:</small>
                  <div className="variable-tags">
                    {getVariablesForType().map(v => (
                      <span
                        key={v}
                        className="variable-tag"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            messageTemplate: formData.messageTemplate + `{{${v}}}`
                          });
                        }}
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="message">Message Template</label>
                <textarea
                  id="message"
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData({ ...formData, messageTemplate: e.target.value })}
                  placeholder="Type your message here. Use {{variable}} for placeholders."
                  rows={5}
                  required
                />
                <div className="message-stats">
                  <span className="char-count">{getCharacterCount()} / 160 chars</span>
                  <span className="segment-count">SMS segments: {getSegmentCount()}</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description (Optional)</label>
                <input
                  id="description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What this template is used for..."
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.autoSend}
                    onChange={(e) => setFormData({ ...formData, autoSend: e.target.checked })}
                  />
                  <span>Auto-send on event</span>
                </label>
              </div>

              {formData.autoSend && (
                <div className="form-group">
                  <label htmlFor="delay">Send Delay (seconds)</label>
                  <input
                    id="delay"
                    type="number"
                    min="0"
                    max="3600"
                    value={formData.sendDelay}
                    onChange={(e) => setFormData({ ...formData, sendDelay: parseInt(e.target.value) })}
                  />
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
