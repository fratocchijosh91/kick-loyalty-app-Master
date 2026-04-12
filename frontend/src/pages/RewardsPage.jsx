import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useOrganization } from '../contexts/OrganizationContext';
import axios from 'axios';
import { Plus, Edit2, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react';

const API_URL = 'https://kick-loyalty-app-master.onrender.com/api';

const RewardsPage = () => {
  const { currentOrg } = useOrganization();
  const [rewards, setRewards] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', points: '', type: 'custom' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await axios.get(`${API_URL}/rewards`);
      setRewards(response.data);
    } catch (err) {
      console.error('Errore caricamento rewards:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitLoading(true);

    try {
      if (!formData.name.trim() || !formData.points) {
        setSubmitError('Nome e punti sono obbligatori');
        setSubmitLoading(false);
        return;
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        points: parseInt(formData.points),
        type: formData.type,
        active: true
      };

      if (editingId) {
        // Update
        const token = localStorage.getItem('kickloyalty_token');
        const response = await axios.put(`${API_URL}/rewards/${editingId}`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setRewards(rewards.map(r => r._id === editingId ? response.data : r));
      } else {
        // Create
        const token = localStorage.getItem('kickloyalty_token');
        const response = await axios.post(`${API_URL}/rewards`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        setRewards([response.data, ...rewards]);
      }

      resetForm();
      setShowModal(false);
    } catch (err) {
      setSubmitError(err.message || 'Errore nell\'operazione');
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', points: '', type: 'custom' });
    setEditingId(null);
  };

  const handleEdit = (reward) => {
    setFormData({
      name: reward.name,
      description: reward.description || '',
      points: reward.points.toString(),
      type: reward.type || 'custom'
    });
    setEditingId(reward._id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Sei sicuro di voler eliminare questo reward?')) return;
    
    try {
      // TODO: implementare delete API
      setRewards(rewards.filter(r => r._id !== id));
    } catch (err) {
      console.error('Errore eliminazione:', err);
    }
  };

  const handleToggle = async (reward) => {
    try {
      const updated = { ...reward, active: !reward.active };
      // TODO: implementare update API
      setRewards(rewards.map(r => r._id === reward._id ? updated : r));
    } catch (err) {
      console.error('Errore toggle:', err);
    }
  };

  const quotaInfo = currentOrg?.quotas;
  const rewardCount = rewards.filter(r => r.active).length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Gestione Rewards</h1>
          <p className="text-text-muted">Crea e gestisci i premi che i tuoi spettatori possono riscattare</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="button-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Nuovo Reward
        </button>
      </div>

      {/* Quota Info */}
      {quotaInfo && (
        <div className="card mb-8 p-4 bg-surface-2 border border-brand-600/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Reward Attivi</p>
              <p className="text-2xl font-bold text-text">
                {rewardCount}/{quotaInfo.maxRewards}
              </p>
            </div>
            <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 transition-all duration-300"
                style={{ width: `${(rewardCount / quotaInfo.maxRewards) * 100}%` }}
              />
            </div>
            {rewardCount >= quotaInfo.maxRewards && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertCircle size={16} />
                Quota raggiunta
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="card mb-8 p-4 bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Rewards Grid */}
      {rewards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map(reward => (
            <div
              key={reward._id}
              className={`card p-6 transition-all ${
                !reward.active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-text">{reward.name}</h3>
                  <p className="text-xs text-text-muted mt-1">{reward.description}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    reward.active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {reward.active ? 'Attivo' : 'Inattivo'}
                </span>
              </div>

              <div className="flex items-center justify-between mb-6 p-3 bg-surface-2 rounded-md">
                <span className="text-sm text-text-muted">Punti Richiesti</span>
                <span className="font-mono font-bold text-brand-600">
                  {reward.points.toLocaleString()}
                </span>
              </div>

              <div className="mb-4 flex items-center justify-between text-xs text-text-muted">
                <span>Riscatti: {reward.redeemedCount || 0}</span>
                <span>Tipo: {reward.type || 'custom'}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleToggle(reward)}
                  className="flex-1 button-secondary flex items-center justify-center gap-1 text-sm"
                  title={reward.active ? 'Disattiva' : 'Attiva'}
                >
                  {reward.active ? (
                    <>
                      <EyeOff size={14} /> Disattiva
                    </>
                  ) : (
                    <>
                      <Eye size={14} /> Attiva
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleEdit(reward)}
                  className="button-secondary px-3"
                  title="Modifica"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(reward._id)}
                  className="button-secondary px-3 text-red-400 hover:text-red-300"
                  title="Elimina"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🎁</div>
          <h3 className="text-lg font-semibold text-text mb-2">Nessun reward creato</h3>
          <p className="text-text-muted mb-6">Inizia creando il tuo primo reward che i tuoi spettatori potranno riscattare</p>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="button-primary"
          >
            <Plus size={18} className="inline mr-2" />
            Crea il Primo Reward
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card max-w-md w-full mx-4 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-text mb-6">
              {editingId ? '✏️ Modifica Reward' : '➕ Nuovo Reward'}
            </h2>

            {submitError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-300 text-sm">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-muted block mb-2">
                  Nome Reward *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es. 🎯 Shoutout in Live"
                  className="input-base w-full"
                  disabled={submitLoading}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted block mb-2">
                  Descrizione
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Cosa ottiene lo spettatore?"
                  className="input-base w-full h-24 resize-none"
                  disabled={submitLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-muted block mb-2">
                    Punti Richiesti *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.points}
                    onChange={e => setFormData({ ...formData, points: e.target.value })}
                    placeholder="500"
                    className="input-base w-full"
                    disabled={submitLoading}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-text-muted block mb-2">
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    className="input-base w-full"
                    disabled={submitLoading}
                  >
                    <option value="custom">Custom</option>
                    <option value="shoutout">Shoutout</option>
                    <option value="emote">Emote</option>
                    <option value="bonus">Bonus</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                    setSubmitError('');
                  }}
                  className="button-secondary flex-1"
                  disabled={submitLoading}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="button-primary flex-1"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Salvataggio...' : editingId ? 'Salva' : 'Crea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RewardsPage;
