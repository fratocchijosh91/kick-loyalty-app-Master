import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext';
import {
  Settings,
  Users,
  Gift,
  BarChart3,
  CreditCard,
  ChevronDown,
  Plus,
  LogOut,
  Trophy,
  Shield,
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const { organizations, currentOrg, switchOrganization, createOrganization } = useOrganization();
  const [showOrgMenu, setShowOrgMenu] = React.useState(false);
  const [creatingOrg, setCreatingOrg] = React.useState(false);
  const [newOrgName, setNewOrgName] = React.useState('');

  if (!currentOrg?.slug) return null;

  const menuItems = [
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard', exact: true },
    { path: `/org/${currentOrg.slug}/rewards`, icon: Gift, label: 'Rewards' },
    { path: `/org/${currentOrg.slug}/redemptions`, icon: Gift, label: 'Redemptions' },
    { path: `/org/${currentOrg.slug}/analytics`, icon: BarChart3, label: 'Analytics' },
    { path: `/org/${currentOrg.slug}/leaderboards`, icon: Trophy, label: 'Leaderboards' },
    { path: `/org/${currentOrg.slug}/audit`, icon: Shield, label: 'Audit Logs' },
    { path: `/org/${currentOrg.slug}/team`, icon: Users, label: 'Team' },
    { path: `/org/${currentOrg.slug}/billing`, icon: CreditCard, label: 'Billing' },
    { path: `/org/${currentOrg.slug}/settings`, icon: Settings, label: 'Settings' },
  ];

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      await createOrganization(newOrgName);
      setNewOrgName('');
      setCreatingOrg(false);
      setShowOrgMenu(false);
    } catch (err) {
      console.error('Errore creazione org:', err);
    }
  };

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 bg-surface-1 border-r border-border h-screen flex flex-col sticky top-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-brand-600 rounded-md flex items-center justify-center text-black font-bold text-sm animate-glow">
            K
          </div>
          <span className="font-bold text-lg text-text">Kick Loyalty</span>
        </Link>

        {/* Organization Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowOrgMenu(!showOrgMenu)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-surface-2 border border-border hover:border-brand-600 transition-smooth text-sm font-medium text-text"
          >
            <span className="truncate text-left">{currentOrg?.name || 'Select Org'}</span>
            <ChevronDown size={16} className={`flex-shrink-0 transition-transform ${showOrgMenu ? 'rotate-180' : ''}`} />
          </button>

          {showOrgMenu && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface-2 border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => {
                    switchOrganization(org.slug);
                    setShowOrgMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-smooth hover:bg-surface-3 ${
                    currentOrg?.slug === org.slug ? 'text-brand-600 bg-surface-3' : 'text-text-muted'
                  }`}
                >
                  {org.name}
                </button>
              ))}

              <div className="border-t border-border">
                {!creatingOrg ? (
                  <button
                    onClick={() => setCreatingOrg(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-brand-600 hover:bg-surface-3 transition-smooth"
                  >
                    <Plus size={14} />
                    New Organization
                  </button>
                ) : (
                  <form onSubmit={handleCreateOrg} className="p-2 space-y-1">
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={e => setNewOrgName(e.target.value)}
                      placeholder="Org name..."
                      className="input-base text-xs w-full"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <button
                        type="submit"
                        className="button-primary text-xs flex-1"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingOrg(false);
                          setNewOrgName('');
                        }}
                        className="button-secondary text-xs flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-smooth text-sm font-medium ${
              isActive(item.path, item.exact)
                ? 'bg-brand-600 text-black'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4 space-y-2">
        <Link
          to="/settings/account"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 transition-smooth text-sm"
        >
          <Settings size={18} />
          <span>Account</span>
        </Link>
        <button
          onClick={() => {
            // TODO: implement logout
            localStorage.clear();
            window.location.href = '/';
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-smooth text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
