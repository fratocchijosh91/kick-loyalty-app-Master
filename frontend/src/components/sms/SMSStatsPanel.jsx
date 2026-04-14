import React, { useState, useEffect } from 'react';
import './sms.css';
import { apiUrl } from '../../lib/apiUrl';

const SMSStatsPanel = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('7days');

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`sms/stats?range=${dateRange}`));
      if (!response.ok) throw new Error('Failed to fetch statistics');

      const data = await response.json();
      setStats(data.stats || {});
      setError('');
    } catch (err) {
      setError(err.message);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBreakdown = (stats) => {
    if (!stats) return [];
    return [
      { label: 'In Attesa', value: stats.byStatus?.pending || 0, color: '#f59e0b' },
      { label: 'Inviati', value: stats.byStatus?.sent || 0, color: '#3b82f6' },
      { label: 'Consegnati', value: stats.byStatus?.delivered || 0, color: '#10b981' },
      { label: 'Falliti', value: stats.byStatus?.failed || 0, color: '#ef4444' },
      { label: 'Rimbalzati', value: stats.byStatus?.bounced || 0, color: '#8b5cf6' }
    ];
  };

  const getTypeBreakdown = (stats) => {
    if (!stats?.byType) return [];
    return Object.entries(stats.byType).map(([type, count]) => ({
      type,
      count,
      label: getTypeLabel(type)
    }));
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

  if (loading) {
    return <div className="sms-settings-loading">Caricamento statistiche...</div>;
  }

  const statusBreakdown = getStatusBreakdown(stats);
  const typeBreakdown = getTypeBreakdown(stats);
  const totalSms = statusBreakdown.reduce((sum, item) => sum + item.value, 0);
  const totalCost = stats.totalCost || 0;
  const avgSegments = stats.avgSegments || 0;

  return (
    <div className="sms-settings-container">
      <div className="sms-settings-header">
        <h2>📊 Statistiche SMS</h2>
        <p>Monitora l'utilizzo dei messaggi SMS</p>
      </div>

      {error && (
        <div className="sms-alert error-alert">
          ⚠️ {error}
        </div>
      )}

      {/* Date Range Selector */}
      <div className="sms-card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label>Periodo di Analisi</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
            {[
              { value: '7days', label: 'Ultimi 7 giorni' },
              { value: '30days', label: 'Ultimi 30 giorni' },
              { value: '90days', label: 'Ultimi 90 giorni' },
              { value: 'all', label: 'Tutti i tempi' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                style={{
                  padding: '0.75rem',
                  border: dateRange === option.value ? '2px solid #6366f1' : '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  backgroundColor: dateRange === option.value ? '#f0f4ff' : 'white',
                  color: dateRange === option.value ? '#6366f1' : '#374151',
                  cursor: 'pointer',
                  fontWeight: dateRange === option.value ? 600 : 500,
                  transition: 'all 0.2s'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="sms-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#6366f1', marginBottom: '0.5rem' }}>
            {totalSms}
          </div>
          <div style={{ color: '#6b7280', fontWeight: 500 }}>
            SMS Totali
          </div>
        </div>

        <div className="sms-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
            {stats.byStatus?.delivered || 0}
          </div>
          <div style={{ color: '#6b7280', fontWeight: 500 }}>
            Consegnati
          </div>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            {totalSms > 0 ? Math.round((stats.byStatus?.delivered || 0) / totalSms * 100) : 0}% di successo
          </div>
        </div>

        <div className="sms-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.5rem' }}>
            €{totalCost.toFixed(2)}
          </div>
          <div style={{ color: '#6b7280', fontWeight: 500 }}>
            Costo Totale
          </div>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            ~€{totalSms > 0 ? (totalCost / totalSms).toFixed(4) : 0} per SMS
          </div>
        </div>

        <div className="sms-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '0.5rem' }}>
            {avgSegments.toFixed(1)}
          </div>
          <div style={{ color: '#6b7280', fontWeight: 500 }}>
            Segmenti Medi
          </div>
          <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            per messaggio
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="sms-card">
        <div className="card-header">
          <h3>Distribuzione per Stato</h3>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '1.5rem'
        }}>
          {statusBreakdown.map(item => (
            <div key={item.label}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                fontSize: '0.9rem'
              }}>
                <span style={{ color: '#374151', fontWeight: 500 }}>{item.label}</span>
                <span style={{ color: '#6b7280', fontWeight: 600 }}>{item.value}</span>
              </div>
              <div style={{
                width: '100%',
                height: '24px',
                backgroundColor: '#e5e7eb',
                borderRadius: '0.5rem',
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    height: '100%',
                    width: totalSms > 0 ? `${(item.value / totalSms) * 100}%` : '0%',
                    backgroundColor: item.color,
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: '#9ca3af',
                marginTop: '0.3rem'
              }}>
                {totalSms > 0 ? Math.round((item.value / totalSms) * 100) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="sms-card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h3>Distribuzione per Tipo</h3>
        </div>

        {typeBreakdown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
            📭 Nessun dato disponibile
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {typeBreakdown.map(item => (
              <div key={item.type} style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ color: '#1f2937', fontWeight: 600 }}>
                    {item.label}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    backgroundColor: '#f0f4ff',
                    color: '#6366f1',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}>
                    {item.count}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '0.5rem',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{
                      height: '100%',
                      width: totalSms > 0 ? `${(item.count / totalSms) * 100}%` : '0%',
                      backgroundColor: '#6366f1',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="sms-card info-card" style={{ marginTop: '2rem' }}>
        <h4>💡 Metriche Spiegate</h4>
        <ul>
          <li><strong>SMS Totali:</strong> Numero complessivo di messaggi SMS inviati nel periodo</li>
          <li><strong>Consegnati:</strong> SMS che hanno raggiunto con successo il telefono del destinatario</li>
          <li><strong>Costo Totale:</strong> Importo totale pagato al provider SMS per gli SMS inviati</li>
          <li><strong>Segmenti Medi:</strong> Media di segmenti SMS per messaggio (160 char = 1 segmento)</li>
          <li><strong>Tasso di Successo:</strong> Percentuale di SMS consegnati rispetto al totale</li>
        </ul>
      </div>
    </div>
  );
};

export default SMSStatsPanel;
