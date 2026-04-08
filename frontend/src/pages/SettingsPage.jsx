import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useOrganization } from '../contexts/OrganizationContext';
import { AlertCircle, Copy, Eye, EyeOff, Trash2, Plus, Settings, Lock } from 'lucide-react';
import TwoFactorSetup from '../components/TwoFactorSetup';
import TrustedDevices from '../components/TrustedDevices';

const SettingsPage = () => {
  const { currentOrg, error, loading } = useOrganization();
  const [formData, setFormData] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [apiKeys, setApiKeys] = useState([]);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      setFormData({
        name: currentOrg.name || '',
        description: currentOrg.description || '',
        contactEmail: currentOrg.contactEmail || ''
      });
      setApiKeys(currentOrg.apiKeys || []);
      setWebhookUrl(currentOrg.webhookUrl || '');
    }
  }, [currentOrg]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess(false);
    setSaving(true);

    try {
      // In una app reale, fareste un PATCH a /api/organizations/:slug
      // Per ora simuleamo il successo
      console.log('Saving organization settings:', formData);
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err) {
      setFormError(err.message || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) {
      setFormError('Inserisci un nome per la chiave');
      return;
    }

    // Genera una chiave fittizia
    const newKey = {
      id: Math.random().toString(36).substr(2, 9),
      name: newKeyName,
      prefix: 'sk_' + Math.random().toString(36).substr(2, 8),
      createdAt: new Date().toISOString(),
      secret: 'sk_' + Math.random().toString(36).substr(2, 32) + Math.random().toString(36).substr(2, 32)
    };

    setApiKeys(prev => [...prev, newKey]);
    setCreatedKey(newKey);
    setNewKeyName('');
    setShowNewKeyForm(false);
  };

  const handleRevokeApiKey = (keyId) => {
    if (confirm('Sei sicuro? Le app che usano questa chiave smetteranno di funzionare.')) {
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
    }
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault();
    setFormError('');
    setWebhookSaving(true);

    try {
      // In una app reale, fareste un PATCH
      console.log('Saving webhook URL:', webhookUrl);
      setFormSuccess(true);
      setTimeout(() => setFormSuccess(false), 3000);
    } catch (err) {
      setFormError(err.message || 'Errore nel salvataggio webhook');
    } finally {
      setWebhookSaving(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (confirm('ATTENZIONE: Questa azione è irreversibile e eliminerà tutti i dati dell\'organizzazione. Digita il nome dell\'organizzazione per confermare.')) {
      // In una app reale, qui fareste DELETE /api/organizations/:slug
      console.log('Deleting organization:', currentOrg.name);
      setDeleteConfirm(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const [showSecrets, setShowSecrets] = useState({});

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text mb-2">Impostazioni</h1>
        <p className="text-text-muted">Gestisci la tua organizzazione e le integrazioni</p>
      </div>

      {/* Error Alert */}
      {(error || formError) && (
        <div className="card mb-8 p-4 bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error || formError}
          </p>
        </div>
      )}

      {/* Success Alert */}
      {formSuccess && (
        <div className="card mb-8 p-4 bg-green-500/10 border border-green-500/20">
          <p className="text-green-300 text-sm">✓ Modifiche salvate con successo</p>
        </div>
      )}

      {/* Organization Settings */}
      <div className="card p-8 mb-8">
        <h2 className="text-2xl font-bold text-text mb-6 flex items-center gap-2">
          <Settings size={24} />
          Impostazioni Organizzazione
        </h2>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-text mb-2">Nome Organizzazione</label>
            <input
              type="text"
              name="name"
              value={formData?.name || ''}
              onChange={handleFormChange}
              className="input-base"
              placeholder="Es. My Kick Community"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">Descrizione</label>
            <textarea
              name="description"
              value={formData?.description || ''}
              onChange={handleFormChange}
              className="input-base resize-none h-24"
              placeholder="Descrivi la tua organizzazione..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">Email di Contatto</label>
            <input
              type="email"
              name="contactEmail"
              value={formData?.contactEmail || ''}
              onChange={handleFormChange}
              className="input-base"
              placeholder="contact@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="button-primary"
          >
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </form>
      </div>

      {/* API Keys */}
      <div className="card p-8 mb-8">
        <h2 className="text-2xl font-bold text-text mb-6">Chiavi API</h2>
        <p className="text-text-muted text-sm mb-6">
          Le chiavi API ti permettono di integrare i tuoi sistemi con Kick Loyalty.
        </p>

        {/* New Key Created Alert */}
        {createdKey && (
          <div className="card mb-6 p-4 bg-brand-600/10 border border-brand-600/20">
            <p className="text-sm text-text mb-3">✓ Nuova chiave API creata!</p>
            <p className="text-xs text-text-muted mb-3">Copia questa chiave segreta. Non potrai vederla di nuovo:</p>
            <div className="flex gap-2 items-center bg-surface-2 p-3 rounded-lg">
              <code className="flex-1 text-xs text-brand-300 break-all font-mono">{createdKey.secret}</code>
              <button
                onClick={() => copyToClipboard(createdKey.secret)}
                className="p-2 hover:bg-surface-3 rounded transition-colors flex-shrink-0"
                title="Copia"
              >
                <Copy size={16} className="text-brand-400" />
              </button>
            </div>
          </div>
        )}

        {/* Generate New Key Form */}
        {showNewKeyForm ? (
          <form onSubmit={handleGenerateApiKey} className="card p-6 mb-6 bg-surface-2 border-2 border-dashed border-border">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-text mb-2">Nome Chiave</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="input-base"
                placeholder="Es. Mobile App"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="button-primary">
                <Plus size={16} className="mr-1" /> Genera Chiave
              </button>
              <button
                type="button"
                onClick={() => setShowNewKeyForm(false)}
                className="button-secondary"
              >
                Annulla
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowNewKeyForm(true)}
            className="button-secondary mb-6"
          >
            <Plus size={16} className="mr-2" /> Genera Nuova Chiave
          </button>
        )}

        {/* API Keys List */}
        {apiKeys.length > 0 ? (
          <div className="space-y-3">
            {apiKeys.map(key => (
              <div key={key.id} className="p-4 bg-surface-2 rounded-lg border border-border flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-text">{key.name}</p>
                  <p className="text-xs text-text-muted mt-1">
                    Creata il {new Date(key.createdAt).toLocaleDateString('it-IT')}
                  </p>
                  <div className="flex gap-2 items-center mt-2 bg-surface p-2 rounded">
                    <code className="text-xs text-text-muted font-mono flex-1">{key.prefix}...{key.prefix.slice(-4)}</code>
                    <button
                      onClick={() => copyToClipboard(key.prefix)}
                      className="p-1 hover:bg-surface-2 rounded transition-colors"
                      title="Copia chiave pubblica"
                    >
                      <Copy size={14} className="text-text-muted" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeApiKey(key.id)}
                  className="p-2 hover:bg-red-500/10 rounded transition-colors text-red-400 hover:text-red-300"
                  title="Revoca chiave"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center py-8">
            Nessuna chiave API. Genera una per iniziare l'integrazione.
          </p>
        )}
      </div>

      {/* Webhooks */}
      <div className="card p-8 mb-8">
        <h2 className="text-2xl font-bold text-text mb-6">Webhook</h2>
        <p className="text-text-muted text-sm mb-6">
          Ricevi notifiche in tempo reale quando accadono eventi importanti (nuovi rewars, punti riscattati, cambi sottoscrizione).
        </p>

        <form onSubmit={handleSaveWebhook} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text mb-2">URL Webhook</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="input-base"
              placeholder="https://your-api.com/webhooks/kick-loyalty"
            />
            <p className="text-xs text-text-muted mt-2">
              Invia un POST ogni volta che accade un evento. Verifichiamo la firma con HMAC-SHA256.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">Numero Tentativi</label>
            <select className="input-base">
              <option>3 tentativi (default)</option>
              <option>5 tentativi</option>
              <option>10 tentativi</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={webhookSaving}
            className="button-primary"
          >
            {webhookSaving ? 'Salvataggio...' : 'Salva Configurazione'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="card p-8 border border-red-500/20 bg-red-500/5">
        <h2 className="text-2xl font-bold text-red-400 mb-6 flex items-center gap-2">
          ⚠️ Area Pericolosa
        </h2>

        <div className="space-y-4">
          <p className="text-text-muted text-sm">
            Le azioni in questa sezione sono irreversibili. Procedi con cautela.
          </p>

          {deleteConfirm ? (
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-red-300 text-sm mb-4">
                Digita il nome dell'organizzazione <strong>{currentOrg?.name}</strong> per confermare l'eliminazione permanente:
              </p>
              <input
                type="text"
                placeholder={currentOrg?.name}
                className="input-base mb-4"
              />
              <div className="flex gap-2">
                <button className="button-primary bg-red-600 hover:bg-red-700">
                  Elimina Permanentemente
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="button-secondary"
                >
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="button-primary bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 size={16} />
              Elimina Organizzazione
            </button>
          )}
        </div>
      </div>

      {/* Documentation */}
      <div className="card p-6 bg-surface-2 border border-border mt-8">
        <h2 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
          <Lock size={20} /> Sicurezza - Autenticazione a Due Fattori
        </h2>
        <TwoFactorSetup />
      </div>

      {/* Trusted Devices */}
      <div className="card p-6 bg-surface-2 border border-border mt-8">
        <h2 className="text-lg font-bold text-text mb-6 flex items-center gap-2">
          <Settings size={20} /> Dispositivi Fidati
        </h2>
        <TrustedDevices />
      </div>

      {/* API Documentation */}
      <div className="card p-6 bg-surface-2 border border-border mt-8 text-center">
        <p className="text-text-muted mb-4">Visita la documentazione per maggiori dettagli sulle integrazioni:</p>
        <a
          href="https://docs.kickloyalty.com/api"
          target="_blank"
          rel="noopener noreferrer"
          className="button-primary inline-flex items-center gap-2"
        >
          📖 Leggi la Documentazione API
        </a>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
