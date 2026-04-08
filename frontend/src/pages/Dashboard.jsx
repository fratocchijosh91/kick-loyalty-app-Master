import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { useOrganization } from '../contexts/OrganizationContext';
import { BarChart3, Users, Gift, TrendingUp, ArrowUpRight } from 'lucide-react';

const Dashboard = () => {
  const { currentOrg, loadRewards } = useOrganization();
  const [rewards, setRewards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg?.slug) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const rewardsData = await loadRewards(currentOrg.slug);
        setRewards(rewardsData);

        // Calculate stats
        const stats = {
          totalRewards: rewardsData.length,
          redeemedThisMonth: rewardsData.reduce((sum, r) => sum + (r.redeemedCount || 0), 0),
          activeRewards: rewardsData.filter(r => r.active).length,
          teamMembers: currentOrg.teamMembers || 1,
        };
        setStats(stats);
      } catch (err) {
        console.error('Errore caricamento dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentOrg]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-brand-600 animate-pulse mx-auto"></div>
            <p className="text-text-muted">Caricamento dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Rewards */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-muted mb-1">Total Rewards</p>
              <p className="text-3xl font-bold text-text">{stats?.totalRewards || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-brand-600/10">
              <Gift className="text-brand-600" size={24} />
            </div>
          </div>
        </div>

        {/* Redeemed This Month */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-muted mb-1">Redeemed (This Month)</p>
              <p className="text-3xl font-bold text-text">{stats?.redeemedThisMonth || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-500/10">
              <TrendingUp className="text-green-400" size={24} />
            </div>
          </div>
        </div>

        {/* Active Rewards */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-muted mb-1">Active Rewards</p>
              <p className="text-3xl font-bold text-text">{stats?.activeRewards || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10">
              <BarChart3 className="text-blue-400" size={24} />
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-text-muted mb-1">Team Members</p>
              <p className="text-3xl font-bold text-text">{stats?.teamMembers || 1}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Users className="text-purple-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions + Recent Rewards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`/org/${currentOrg?.slug}/rewards?action=create`}
              className="card-interactive p-4 text-center"
            >
              <Gift className="mx-auto mb-2 text-brand-600" size={24} />
              <p className="text-sm font-medium text-text">Create Reward</p>
            </a>
            <a
              href={`/org/${currentOrg?.slug}/team`}
              className="card-interactive p-4 text-center"
            >
              <Users className="mx-auto mb-2 text-brand-600" size={24} />
              <p className="text-sm font-medium text-text">Manage Team</p>
            </a>
            <a
              href={`/org/${currentOrg?.slug}/billing`}
              className="card-interactive p-4 text-center"
            >
              <ArrowUpRight className="mx-auto mb-2 text-brand-600" size={24} />
              <p className="text-sm font-medium text-text">Upgrade Plan</p>
            </a>
            <a
              href={`/org/${currentOrg?.slug}/settings`}
              className="card-interactive p-4 text-center"
            >
              <BarChart3 className="mx-auto mb-2 text-brand-600" size={24} />
              <p className="text-sm font-medium text-text">Settings</p>
            </a>
          </div>
        </div>

        {/* Organization Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-text mb-4">Plane Info</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-muted">Current Plan</p>
              <p className="text-lg font-semibold text-text capitalize flex items-center gap-2">
                {currentOrg?.subscription?.plan || 'free'}
                <span className={`text-xs px-2 py-1 rounded font-mono ${
                  currentOrg?.subscription?.status === 'active' 
                    ? 'badge-success' 
                    : 'badge-warning'
                }`}>
                  {currentOrg?.subscription?.status || 'inactive'}
                </span>
              </p>
            </div>

            {currentOrg?.subscription?.renewalDate && (
              <div>
                <p className="text-xs text-text-muted">Next Renewal</p>
                <p className="text-sm text-text">
                  {new Date(currentOrg.subscription.renewalDate).toLocaleDateString('it-IT', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-border">
              <a
                href={`/org/${currentOrg?.slug}/billing`}
                className="button-primary w-full text-sm"
              >
                Manage Billing
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Rewards */}
      <div className="mt-8 card p-6">
        <h2 className="text-lg font-semibold text-text mb-4">Recent Rewards</h2>
        {rewards.length > 0 ? (
          <div className="space-y-3">
            {rewards.slice(0, 5).map(reward => (
              <div key={reward._id} className="flex items-center justify-between p-3 rounded-md bg-surface-2 hover:bg-surface-3 transition-smooth">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text truncate">{reward.name}</p>
                  <p className="text-xs text-text-muted">{reward.description}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold text-brand-600">{reward.points} pts</p>
                  <p className="text-xs text-text-muted">{reward.redeemedCount || 0} redeemed</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-text-muted py-8">Nessun reward creato. <a href={`/org/${currentOrg?.slug}/rewards`} className="text-brand-600 hover:underline">Crea uno ora!</a></p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
