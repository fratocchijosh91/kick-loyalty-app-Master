import React, { useState } from 'react';
import SMSSettingsPanel from '../components/sms/SMSSettingsPanel';
import SMSTemplateEditor from '../components/sms/SMSTemplateEditor';
import SMSNotificationList from '../components/sms/SMSNotificationList';
import SMSStatsPanel from '../components/sms/SMSStatsPanel';
import '../components/sms/sms.css';

const SMSPage = () => {
  const [activeTab, setActiveTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: '📱 Le Mie Impostazioni', icon: '⚙️' },
    { id: 'history', label: '📨 Storico SMS', icon: '📜' },
    { id: 'templates', label: '📝 Template (Admin)', icon: '✏️' },
    { id: 'stats', label: '📊 Statistiche (Admin)', icon: '📈' }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Tab Navigation */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        sticky: 'top',
        zIndex: 10,
        top: 0
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1.5rem',
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 1.5rem',
                border: 'none',
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                borderBottom: activeTab === tab.id ? '3px solid #6366f1' : '3px solid transparent',
                color: activeTab === tab.id ? '#6366f1' : '#6b7280',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: activeTab === tab.id ? 600 : 500,
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.color = '#1f2937';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.color = '#6b7280';
                }
              }}
            >
              <span style={{ marginRight: '0.5rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: '2rem 1rem' }}>
        {activeTab === 'settings' && <SMSSettingsPanel />}
        {activeTab === 'history' && <SMSNotificationList />}
        {activeTab === 'templates' && <SMSTemplateEditor />}
        {activeTab === 'stats' && <SMSStatsPanel />}
      </div>

      {/* Footer Info */}
      <div style={{
        backgroundColor: 'white',
        borderTop: '1px solid #e5e7eb',
        padding: '2rem',
        marginTop: '2rem',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <p style={{ margin: '0.5rem 0' }}>
          📱 <strong>Gestore SMS Notifications</strong> - Gestisci le tue preferenze di notifica via SMS
        </p>
        <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
          Per assistenza: <a href="mailto:support@kickloyalty.com" style={{ color: '#6366f1', textDecoration: 'none' }}>support@kickloyalty.com</a>
        </p>
      </div>
    </div>
  );
};

export default SMSPage;
