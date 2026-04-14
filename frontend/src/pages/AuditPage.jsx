import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import DashboardLayout from '../components/Layout/DashboardLayout';
import { 
  Download, 
  Search, 
  Calendar, 
  Filter, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { apiUrl } from '../lib/apiUrl';

/**
 * AuditPage Component
 * View and manage audit logs for compliance and security monitoring
 * Features:
 * - View all account actions with filtering
 * - Timeline visualization
 * - Statistics and trends
 * - Export functionality
 */
export default function AuditPage() {
  const { slug } = useParams();
  const { currentOrg } = useOrganization();

  // State
  const [activeTab, setActiveTab] = useState('logs'); // logs | timeline | stats
  const [logs, setLogs] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    resourceType: '',
    search: '',
    startDate: '',
    endDate: '',
    success: ''
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  // Fetch logs
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'timeline') {
      fetchTimeline();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, filters, page]);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        ...filters,
        page,
        limit: 25
      });

      const res = await fetch(apiUrl(`audit/logs?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setLogs(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('audit/timeline?daysBack=30'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setTimeline(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(apiUrl('audit/stats?daysBack=30'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        ...filters,
        format
      });

      const response = await fetch(apiUrl(`audit/export?${params}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export.${format === 'json' ? 'json' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to export logs');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const actionColor = (action) => {
    if (action.includes('create')) return 'text-green-500';
    if (action.includes('delete')) return 'text-red-500';
    if (action.includes('update')) return 'text-blue-500';
    if (action.includes('permission') || action.includes('role')) return 'text-purple-500';
    if (action.includes('login') || action.includes('logout')) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const getActionIcon = (action) => {
    if (action.includes('delete')) return '🗑️';
    if (action.includes('create')) return '➕';
    if (action.includes('update')) return '✏️';
    if (action.includes('permission') || action.includes('role')) return '🔐';
    if (action.includes('login') || action.includes('logout')) return '🔓';
    return '📋';
  };

  return (
    <DashboardLayout currentTab="audit">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-text">Audit Logs</h1>
            <p className="text-text-muted mt-2">
              Compliance & security monitoring - track all organization actions
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border">
          {[
            { id: 'logs', label: '📋 Logs', icon: 'logs' },
            { id: 'timeline', label: '📈 Timeline', icon: 'timeline' },
            { id: 'stats', label: '📊 Statistics', icon: 'stats' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'text-brand-600 border-brand-600'
                  : 'text-text-muted border-transparent hover:text-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="card bg-red-500/10 border border-red-200 text-red-600 p-4 flex items-center gap-3">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="card p-6 space-y-4">
              <h3 className="font-bold text-text flex items-center gap-2">
                <Filter size={18} /> Filters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Search..."
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  className="input-base"
                />

                <select
                  name="action"
                  value={filters.action}
                  onChange={handleFilterChange}
                  className="input-base"
                >
                  <option value="">All Actions</option>
                  <option value="create">Create</option>
                  <option value="update">Update</option>
                  <option value="delete">Delete</option>
                  <option value="login">Login</option>
                  <option value="permission_change">Permission Change</option>
                </select>

                <select
                  name="resourceType"
                  value={filters.resourceType}
                  onChange={handleFilterChange}
                  className="input-base"
                >
                  <option value="">All Resources</option>
                  <option value="reward">Reward</option>
                  <option value="user">User</option>
                  <option value="team_member">Team Member</option>
                  <option value="organization">Organization</option>
                  <option value="api_key">API Key</option>
                </select>

                <select
                  name="success"
                  value={filters.success}
                  onChange={handleFilterChange}
                  className="input-base"
                >
                  <option value="">All Status</option>
                  <option value="true">Success</option>
                  <option value="false">Failed</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className="input-base"
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className="input-base"
                  placeholder="End Date"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleExport('csv')}
                  className="button-secondary flex items-center gap-2"
                >
                  <Download size={16} /> Export CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="button-secondary flex items-center gap-2"
                >
                  <Download size={16} /> Export JSON
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="card p-6 overflow-x-auto">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
                  <p className="text-text-muted">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  No audit logs found matching your criteria
                </div>
              ) : (
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-bold text-text-muted">Timestamp</th>
                        <th className="text-left py-3 px-4 font-bold text-text-muted">User</th>
                        <th className="text-left py-3 px-4 font-bold text-text-muted">Action</th>
                        <th className="text-left py-3 px-4 font-bold text-text-muted">Resource</th>
                        <th className="text-left py-3 px-4 font-bold text-text-muted">Details</th>
                        <th className="text-left py-3 px-4 font-bold text-text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log._id} className="border-b border-border hover:bg-surface-2">
                          <td className="py-3 px-4 text-text-muted text-xs">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-text">
                            {log.userId?.username || log.username || 'System'}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`${actionColor(log.action)} font-semibold`}>
                              {getActionIcon(log.action)} {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-text-muted">
                            {log.resourceType}
                            {log.resourceName && ` - ${log.resourceName}`}
                          </td>
                          <td className="py-3 px-4 text-text-muted max-w-xs truncate">
                            {log.details}
                          </td>
                          <td className="py-3 px-4">
                            {log.success ? (
                              <span className="flex items-center gap-1 text-green-500">
                                <CheckCircle size={16} /> Success
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500">
                                <AlertCircle size={16} /> Failed
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {pagination && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                      <p className="text-sm text-text-muted">
                        Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="button-secondary disabled:opacity-50"
                        >
                          ← Previous
                        </button>
                        <button
                          onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                          disabled={!pagination.hasMore}
                          className="button-secondary disabled:opacity-50"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="card p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
                <p className="text-text-muted">Loading timeline...</p>
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                No activity in the past 30 days
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="font-bold text-text text-lg">Activity Timeline (30 days)</h3>

                <div className="space-y-4">
                  {timeline.map((day, idx) => (
                    <div
                      key={idx}
                      className="flex gap-4 pb-4 border-b border-border last:border-b-0"
                    >
                      <div className="flex-shrink-0">
                        <Calendar size={20} className="text-brand-600 mt-1" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-text">{day._id}</p>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div>
                            <p className="text-xs text-text-muted">Total Events</p>
                            <p className="text-2xl font-bold text-text">{day.total}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-muted">Successful</p>
                            <p className="text-2xl font-bold text-green-500">{day.successful}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-muted">Failed</p>
                            <p className="text-2xl font-bold text-red-500">{day.failed}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
                <p className="text-text-muted">Calculating statistics...</p>
              </div>
            ) : stats ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card p-6">
                    <p className="text-text-muted text-sm font-bold mb-2">Total Events</p>
                    <p className="text-4xl font-bold text-brand-600">{stats.summary.totalEvents}</p>
                    <p className="text-xs text-text-muted mt-2">Last 30 days</p>
                  </div>

                  <div className="card p-6">
                    <p className="text-text-muted text-sm font-bold mb-2">Successful</p>
                    <p className="text-4xl font-bold text-green-500">{stats.summary.successfulEvents}</p>
                    <p className="text-xs text-text-muted mt-2">Events completed</p>
                  </div>

                  <div className="card p-6">
                    <p className="text-text-muted text-sm font-bold mb-2">Failed</p>
                    <p className="text-4xl font-bold text-red-500">{stats.summary.failedEvents}</p>
                    <p className="text-xs text-text-muted mt-2">Events errored</p>
                  </div>

                  <div className="card p-6">
                    <p className="text-text-muted text-sm font-bold mb-2">Success Rate</p>
                    <p className="text-4xl font-bold text-blue-500">{stats.summary.successRate}</p>
                    <p className="text-xs text-text-muted mt-2">Overall rate</p>
                  </div>
                </div>

                {/* Top Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card p-6">
                    <h3 className="font-bold text-text mb-4 flex items-center gap-2">
                      <TrendingUp size={18} /> Top Actions
                    </h3>
                    <div className="space-y-3">
                      {stats.actionDistribution.slice(0, 10).map((action, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-text text-sm">{action._id}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-surface-2 rounded h-2">
                              <div
                                className="bg-brand-600 h-2 rounded"
                                style={{
                                  width: `${(action.count / stats.summary.totalEvents) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="text-text-muted text-xs font-bold w-8 text-right">
                              {action.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="font-bold text-text mb-4 flex items-center gap-2">
                      <Clock size={18} /> Most Active Users
                    </h3>
                    <div className="space-y-3">
                      {stats.topUsers.map((user, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-text text-sm">{user._id}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-surface-2 rounded h-2">
                              <div
                                className="bg-brand-600 h-2 rounded"
                                style={{
                                  width: `${(user.count / (stats.topUsers[0]?.count || 1)) * 100}%`
                                }}
                              ></div>
                            </div>
                            <span className="text-text-muted text-xs font-bold w-8 text-right">
                              {user.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Failed Operations */}
                {stats.failedOperations.length > 0 && (
                  <div className="card p-6 bg-red-500/5 border border-red-200/20">
                    <h3 className="font-bold text-red-600 mb-4 flex items-center gap-2">
                      <AlertCircle size={18} /> Recent Failed Operations
                    </h3>
                    <div className="space-y-3">
                      {stats.failedOperations.map((op, idx) => (
                        <div key={idx} className="p-3 bg-red-500/10 rounded border border-red-200/20">
                          <p className="text-sm text-text">
                            <strong>{op.action}</strong> on {op.resourceType}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            {op.error || 'No error message'}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            by {op.username} on {new Date(op.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
