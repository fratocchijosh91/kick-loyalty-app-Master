import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useOrganization } from '../contexts/OrganizationContext';
import { Plus, Trash2, Mail, Shield, AlertCircle } from 'lucide-react';

const TeamPage = () => {
  const { currentOrg, loadTeamMembers, inviteTeamMember, removeTeamMember, updateTeamMember, loading, error } = useOrganization();
  const [members, setMembers] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'viewer' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [editingMember, setEditingMember] = useState(null);

  useEffect(() => {
    if (!currentOrg?.slug) return;
    loadData();
  }, [currentOrg]);

  const loadData = async () => {
    try {
      const data = await loadTeamMembers(currentOrg.slug);
      setMembers(data);
    } catch (err) {
      console.error('Errore caricamento team:', err);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);

    try {
      if (!inviteData.email.trim()) {
        setInviteError('Email obbligatoria');
        setInviteLoading(false);
        return;
      }

      await inviteTeamMember(currentOrg.slug, inviteData.email, inviteData.role);
      
      // Reload members
      const data = await loadTeamMembers(currentOrg.slug);
      setMembers(data);

      setInviteData({ email: '', role: 'viewer' });
      setShowInviteModal(false);
    } catch (err) {
      setInviteError(err.message || 'Errore nell\'invito');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (memberId) => {
    if (!confirm('Sei sicuro di voler rimuovere questo membro?')) return;

    try {
      await removeTeamMember(currentOrg.slug, memberId);
      setMembers(members.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('Errore rimozione:', err);
    }
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await updateTeamMember(currentOrg.slug, memberId, newRole);
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setEditingMember(null);
    } catch (err) {
      console.error('Errore aggiornamento:', err);
    }
  };

  const quotaInfo = currentOrg?.quotas;
  const teamCount = members.length;

  const roleLabels = {
    owner: { label: 'Owner', color: 'bg-purple-500/20 text-purple-400', icon: '👑' },
    admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400', icon: '⚙️' },
    editor: { label: 'Editor', color: 'bg-blue-500/20 text-blue-400', icon: '✏️' },
    viewer: { label: 'Viewer', color: 'bg-gray-500/20 text-gray-400', icon: '👁️' }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text mb-2">Team Management</h1>
          <p className="text-text-muted">Gestisci i membri del tuo team e i loro permessi</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="button-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Invita Membro
        </button>
      </div>

      {/* Quota Info */}
      {quotaInfo && (
        <div className="card mb-8 p-4 bg-surface-2 border border-brand-600/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-muted">Team Members</p>
              <p className="text-2xl font-bold text-text">
                {teamCount}/{quotaInfo.maxTeamMembers}
              </p>
            </div>
            <div className="w-24 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 transition-all duration-300"
                style={{ width: `${(teamCount / quotaInfo.maxTeamMembers) * 100}%` }}
              />
            </div>
            {teamCount >= quotaInfo.maxTeamMembers && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <AlertCircle size={16} />
                Limite raggiunto
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members List */}
      {members.length > 0 ? (
        <div className="space-y-3">
          {members.map(member => {
            const roleInfo = roleLabels[member.role] || roleLabels.viewer;
            return (
              <div
                key={member.id}
                className="card p-4 flex items-center justify-between hover:border-brand-600 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-black text-sm font-bold flex-shrink-0">
                    {member.user?.avatar ? (
                      <img
                        src={member.user.avatar}
                        alt={member.user.username}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      (member.user?.username?.[0] || 'U').toUpperCase()
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text truncate">
                      {member.user?.displayName || member.user?.username}
                    </h3>
                    <p className="text-xs text-text-muted truncate">
                      @{member.user?.username}
                    </p>
                  </div>

                  {/* Role */}
                  {editingMember === member.id ? (
                    <select
                      value={member.role}
                      onChange={e => handleRoleChange(member.id, e.target.value)}
                      className="input-base text-sm"
                      disabled={member.role === 'owner'}
                    >
                      {Object.entries(roleLabels).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${roleInfo.color} cursor-pointer hover:opacity-80`}
                      onClick={() => member.role !== 'owner' && setEditingMember(member.id)}
                      title={member.role === 'owner' ? 'Non puoi modificare il ruolo owner' : 'Clicca per modificare'}
                    >
                      {roleInfo.icon} {roleInfo.label}
                    </span>
                  )}

                  {/* Joined Date */}
                  <div className="hidden sm:block text-xs text-text-muted whitespace-nowrap">
                    {new Date(member.joinedAt).toLocaleDateString('it-IT')}
                  </div>
                </div>

                {/* Actions */}
                {member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="ml-4 button-secondary text-red-400 hover:text-red-300 px-3"
                    title="Rimuovi"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-text mb-2">Solo te nel team</h3>
          <p className="text-text-muted mb-6">Invita altri membri per collaborare alla gestione dei rewards</p>
          <button
            onClick={() => setShowInviteModal(true)}
            className="button-primary"
          >
            <Plus size={18} className="inline mr-2" />
            Invita il Primo Membro
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card max-w-md w-full mx-4 p-6 rounded-lg">
            <h2 className="text-2xl font-bold text-text mb-2">👥 Invita Membro</h2>
            <p className="text-text-muted text-sm mb-6">Aggiungi un nuovo membro al tuo team</p>

            {inviteError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-300 text-sm">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-muted block mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder="team@example.com"
                  className="input-base w-full"
                  disabled={inviteLoading}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-muted block mb-2">
                  Ruolo
                </label>
                <select
                  value={inviteData.role}
                  onChange={e => setInviteData({ ...inviteData, role: e.target.value })}
                  className="input-base w-full"
                  disabled={inviteLoading}
                >
                  {Object.entries(roleLabels).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-muted mt-2">
                  • <strong>Viewer:</strong> Visualizza solo analytics
                  <br />
                  • <strong>Editor:</strong> Gestisci rewards
                  <br />
                  • <strong>Admin:</strong> Gestisci tutto tranne billing
                  <br />
                  • <strong>Owner:</strong> Accesso completo
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="button-secondary flex-1"
                  disabled={inviteLoading}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="button-primary flex-1 flex items-center justify-center gap-2"
                  disabled={inviteLoading}
                >
                  <Mail size={16} />
                  {inviteLoading ? 'Invio...' : 'Invita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default TeamPage;
