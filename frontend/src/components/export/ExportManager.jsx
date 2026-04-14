/**
 * Phase 3 - Export Manager Component
 * Centralized interface for CSV/PDF exports and scheduled reports
 */

import React, { useState, useEffect } from 'react';
import { Download, FileText, Calendar, Mail, Clock, Filter, Check, AlertCircle } from 'lucide-react';
import './export.css';
import { apiUrl } from '../../lib/apiUrl';

const ExportManager = ({ organizationId, userRole }) => {
  const [formats, setFormats] = useState({});
  const [types, setTypes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState({});
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    type: 'analytics',
    format: 'csv',
    frequency: 'weekly',
    recipients: ['']
  });

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    organizationId: organizationId || ''
  });

  useEffect(() => {
    fetchFormats();
    fetchHistory();
  }, []);

  const fetchFormats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('exports/formats'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setFormats(data.formats);
        setTypes(data.types);
      }
    } catch (error) {
      console.error('Error fetching formats:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('exports/history'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.exports);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleExport = async (type, format) => {
    const key = `${type}-${format}`;
    setLoading({ ...loading, [key]: true });

    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.status) queryParams.append('status', filters.status);
      if (organizationId) queryParams.append('organizationId', organizationId);

      const endpoint =
        format === 'pdf'
          ? apiUrl(`exports/pdf/${type}?${queryParams}`)
          : apiUrl(`exports/csv/${type}?${queryParams}`);

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh history
      fetchHistory();
    } catch (error) {
      console.error('Export error:', error);
      alert('Errore durante l\'export. Riprova.');
    } finally {
      setLoading({ ...loading, [key]: false });
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('exports/scheduled'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...scheduleForm,
          filters: { organizationId }
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Export programmato creato con successo!');
        setShowScheduleModal(false);
        fetchHistory();
      } else {
        alert(data.error || 'Errore nella creazione');
      }
    } catch (error) {
      console.error('Schedule error:', error);
      alert('Errore durante la creazione dell\'export programmato');
    }
  };

  const addRecipient = () => {
    setScheduleForm({
      ...scheduleForm,
      recipients: [...scheduleForm.recipients, '']
    });
  };

  const removeRecipient = (index) => {
    setScheduleForm({
      ...scheduleForm,
      recipients: scheduleForm.recipients.filter((_, i) => i !== index)
    });
  };

  const updateRecipient = (index, value) => {
    const newRecipients = [...scheduleForm.recipients];
    newRecipients[index] = value;
    setScheduleForm({ ...scheduleForm, recipients: newRecipients });
  };

  const getAvailableFormats = (typeId) => {
    return Object.entries(formats).filter(([_, format]) => 
      format.availableFor.includes(typeId)
    );
  };

  const isAdmin = userRole === 'admin' || userRole === 'owner';

  return (
    <div className="export-manager">
      <div className="export-header">
        <h2><Download size={24} /> Data Export</h2>
        <p>Esporta dati in CSV o PDF per analisi e report</p>
      </div>

      {/* Filters */}
      <div className="export-filters">
        <h3><Filter size={18} /> Filtri</h3>
        <div className="filter-grid">
          <div className="filter-field">
            <label>Data Inizio</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="filter-field">
            <label>Data Fine</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="filter-field">
            <label>Stato</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Tutti</option>
              <option value="pending">In Attesa</option>
              <option value="approved">Approvato</option>
              <option value="completed">Completato</option>
              <option value="cancelled">Annullato</option>
            </select>
          </div>
        </div>
      </div>

      {/* Export Types Grid */}
      <div className="export-types">
        <h3>Tipi di Export</h3>
        <div className="export-grid">
          {types.map((type) => (
            <div key={type.id} className="export-card">
              <div className="export-info">
                <h4>{type.name}</h4>
                <p>{type.description}</p>
              </div>
              <div className="export-actions">
                {getAvailableFormats(type.id).map(([formatKey, format]) => (
                  <button
                    key={formatKey}
                    className="export-btn"
                    onClick={() => handleExport(type.id, formatKey)}
                    disabled={loading[`${type.id}-${formatKey}`]}
                  >
                    {loading[`${type.id}-${formatKey}`] ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      <>
                        <Download size={16} />
                        {format.name}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Exports (Admin only) */}
      {isAdmin && (
        <div className="scheduled-section">
          <div className="section-header">
            <h3><Calendar size={18} /> Export Programmati</h3>
            <button
              className="schedule-btn"
              onClick={() => setShowScheduleModal(true)}
            >
              <Clock size={16} /> Nuovo Export Programmato
            </button>
          </div>

          {history.filter(h => h.isScheduled).length === 0 ? (
            <p className="no-data">Nessun export programmato</p>
          ) : (
            <div className="scheduled-list">
              {history.filter(h => h.isScheduled).map((item) => (
                <div key={item.id} className="scheduled-item">
                  <div className="scheduled-info">
                    <h4>{item.name}</h4>
                    <span className="badge">{item.frequency}</span>
                  </div>
                  <div className="scheduled-meta">
                    <span>{item.type} • {item.format.toUpperCase()}</span>
                    <span className={item.active ? 'status-active' : 'status-inactive'}>
                      {item.active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export History */}
      <div className="history-section">
        <h3><FileText size={18} /> Storico Export</h3>
        {history.filter(h => !h.isScheduled).length === 0 ? (
          <p className="no-data">Nessun export recente</p>
        ) : (
          <div className="history-list">
            {history.filter(h => !h.isScheduled).slice(0, 10).map((item, index) => (
              <div key={index} className="history-item">
                <div className="history-icon">
                  {item.format === 'pdf' ? <FileText size={16} /> : <Download size={16} />}
                </div>
                <div className="history-info">
                  <span className="history-type">{item.type}</span>
                  <span className="history-date">
                    {new Date(item.createdAt).toLocaleString('it-IT')}
                  </span>
                </div>
                <span className={`history-format format-${item.format}`}>
                  {item.format.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3><Clock size={20} /> Crea Export Programmato</h3>
            <form onSubmit={handleScheduleSubmit}>
              <div className="form-group">
                <label>Nome Export</label>
                <input
                  type="text"
                  value={scheduleForm.name}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                  placeholder="Es. Report Settimanale Analytics"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={scheduleForm.type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                  >
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Formato</label>
                  <select
                    value={scheduleForm.format}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, format: e.target.value })}
                  >
                    {getAvailableFormats(scheduleForm.type).map(([key, format]) => (
                      <option key={key} value={key}>{format.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Frequenza</label>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                >
                  <option value="daily">Giornaliero</option>
                  <option value="weekly">Settimanale</option>
                  <option value="monthly">Mensile</option>
                </select>
              </div>

              <div className="form-group">
                <label>Destinatari Email</label>
                {scheduleForm.recipients.map((recipient, index) => (
                  <div key={index} className="recipient-row">
                    <input
                      type="email"
                      value={recipient}
                      onChange={(e) => updateRecipient(index, e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                    {scheduleForm.recipients.length > 1 && (
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeRecipient(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-btn" onClick={addRecipient}>
                  + Aggiungi destinatario
                </button>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Annulla
                </button>
                <button type="submit" className="btn-primary">
                  <Check size={16} /> Crea Programmazione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Quick Export Button Component
 * Reusable button for one-click exports
 */
export const ExportButton = ({ 
  type = 'analytics', 
  format = 'csv', 
  label = 'Export',
  filters = {},
  className = ''
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const endpoint =
        format === 'pdf'
          ? apiUrl(`exports/pdf/${type}?${queryParams}`)
          : apiUrl(`exports/csv/${type}?${queryParams}`);

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Errore durante l\'export');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      className={`export-quick-btn ${className}`}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <span className="loading-spinner"></span>
      ) : (
        <>
          <Download size={16} />
          {label}
        </>
      )}
    </button>
  );
};

export default ExportManager;
