import React, { useState, useEffect } from 'react';
import './sms.css';
import { apiUrl } from '../../lib/apiUrl';

const SMSNotificationList = () => {
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    dateRange: 'all'
  });

  useEffect(() => {
    fetchNotifications();
  }, [page, pageSize, filters]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page,
        limit: pageSize,
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status })
      });

      const response = await fetch(apiUrl(`sms/notifications?${queryParams}`));
      if (!response.ok) throw new Error('Failed to fetch notifications');

      const data = await response.json();
      setNotifications(data.data || []);
      setTotalCount(data.total || 0);
      setError('');
    } catch (err) {
      setError(err.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setPage(1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#f59e0b',
      'sent': '#3b82f6',
      'delivered': '#10b981',
      'failed': '#ef4444',
      'bounced': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'In Attesa',
      'sent': 'Inviato',
      'delivered': 'Consegnato',
      'failed': 'Fallito',
      'bounced': 'Rimbalzato'
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type) => {
    const labels = {
      'redemption_approved': 'Riscatto Approvato',
      'redemption_rejected': 'Riscatto Rifiutato',
      'achievement_unlocked': 'Achievement Sbloccato',
      'reward_available': 'Ricompensa Disponibile',
      'low_points_warning': 'Avviso Punti Bassi',
      'points_earned': 'Punti Guadagnati',
      'system_notification': 'Notifica Sistema',
      'fulfillment_update': 'Aggiornamento Evasione',
      'special_offer': 'Offerta Speciale'
    };
    return labels[type] || type;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (loading && page === 1) {
    return <div className="sms-settings-loading">Caricamento notifiche SMS...</div>;
  }

  return (
    <div className="sms-settings-container">
      <div className="sms-settings-header">
        <h2>📨 Storico SMS</h2>
        <p>Visualizza tutti i messaggi SMS inviati</p>
      </div>

      {error && (
        <div className="sms-alert error-alert">
          ⚠️ {error}
        </div>
      )}

      {/* Filters Card */}
      <div className="sms-card">
        <div className="card-header">
          <h3>Filtri</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>Tipo</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="">Tutti i tipi</option>
              <option value="redemption_approved">Riscatto Approvato</option>
              <option value="redemption_rejected">Riscatto Rifiutato</option>
              <option value="achievement_unlocked">Achievement Sbloccato</option>
              <option value="reward_available">Ricompensa Disponibile</option>
              <option value="low_points_warning">Avviso Punti Bassi</option>
              <option value="points_earned">Punti Guadagnati</option>
              <option value="system_notification">Notifica Sistema</option>
              <option value="fulfillment_update">Aggiornamento Evasione</option>
              <option value="special_offer">Offerta Speciale</option>
            </select>
          </div>

          <div className="form-group">
            <label>Stato</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">Tutti gli stati</option>
              <option value="pending">In Attesa</option>
              <option value="sent">Inviato</option>
              <option value="delivered">Consegnato</option>
              <option value="failed">Fallito</option>
              <option value="bounced">Rimbalzato</option>
            </select>
          </div>

          <div className="form-group">
            <label>Dimensione Pagina</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={5}>5 per pagina</option>
              <option value={10}>10 per pagina</option>
              <option value={25}>25 per pagina</option>
              <option value={50}>50 per pagina</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="sms-card">
        <div className="card-header">
          <h3>Messaggi ({totalCount} totali)</h3>
        </div>

        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
            📭 Nessun messaggio SMS trovato
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Data</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Messaggio</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Stato</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: '#374151', fontWeight: 600 }}>Segmenti</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif) => (
                  <tr
                    key={notif._id}
                    style={{
                      borderBottom: '1px solid #e5e7eb',
                      hover: { backgroundColor: '#f9fafb' }
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1rem', color: '#6b7280' }}>
                      {formatDate(notif.createdAt)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: '#f0f4ff',
                        color: '#6366f1',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}>
                        {getTypeLabel(notif.type)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#374151', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div title={notif.message}>{notif.message.substring(0, 50)}...</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        display: 'inline-block',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: getStatusColor(notif.status),
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}>
                        {getStatusLabel(notif.status)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#6b7280' }}>
                      {notif.segmentCount || 1}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              Pagina {page} di {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  color: page === 1 ? '#d1d5db' : '#374151',
                  backgroundColor: page === 1 ? '#f9fafb' : 'white'
                }}
              >
                ← Precedente
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  color: page === totalPages ? '#d1d5db' : '#374151',
                  backgroundColor: page === totalPages ? '#f9fafb' : 'white'
                }}
              >
                Successivo →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="sms-card info-card">
        <h4>💡 Informazioni Stato</h4>
        <ul>
          <li><strong>In Attesa:</strong> SMS accodata per l'invio</li>
          <li><strong>Inviato:</strong> SMS inviato al provider SMS</li>
          <li><strong>Consegnato:</strong> SMS consegnato al telefono</li>
          <li><strong>Fallito:</strong> Errore durante l'invio o consegna</li>
          <li><strong>Rimbalzato:</strong> Numero di telefono non valido</li>
        </ul>
      </div>
    </div>
  );
};

export default SMSNotificationList;
