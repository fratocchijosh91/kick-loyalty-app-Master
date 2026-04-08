import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { Bell, User } from 'lucide-react';

const Navbar = () => {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  if (!user || !currentOrg) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface glass-effect">
      <div className="h-14 px-6 flex items-center justify-between">
        {/* Left: Breadcrumb or Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-text">{currentOrg?.name || 'Dashboard'}</h1>
          <span className="text-xs px-2 py-1 rounded badge-info">
            {currentOrg?.subscription?.plan?.toUpperCase() || 'FREE'}
          </span>
        </div>

        {/* Right: Notifications + User Menu */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 text-text-muted hover:text-text hover:bg-surface-2 rounded-md transition-smooth">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-600 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-2 transition-smooth"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 flex items-center justify-center text-black text-xs font-bold overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <span className="text-sm font-medium text-text hidden sm:inline max-w-xs truncate">
                {user?.displayName || user?.username}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-surface-2 border border-border rounded-md shadow-lg z-50">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium text-text">{user?.displayName || user?.username}</p>
                  <p className="text-xs text-text-muted">@{user?.username}</p>
                </div>
                <a
                  href="/settings/account"
                  className="block px-4 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-3 transition-smooth"
                >
                  Account Settings
                </a>
                <button
                  onClick={() => {
                    localStorage.clear();
                    window.location.href = '/';
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-smooth"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
