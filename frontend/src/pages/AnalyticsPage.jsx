import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw, Calendar } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { apiUrl } from '../lib/apiUrl';

export default function AnalyticsPage() {
  const { org, orgId } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [health, setHealth] = useState(null);
  const [dateRange, setDateRange] = useState({ start: getDaysAgo(30), end: new Date().toISOString().split('T')[0] });
  const [granularity, setGranularity] = useState('day');
  const [activeTab, setActiveTab] = useState('overview');

  function getDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch overview
      const overviewRes = await fetch(apiUrl('analytics/overview'), { headers });
      const overviewData = await overviewRes.json();
      setOverview(overviewData);
      
      // Fetch engagement
      const engagementRes = await fetch(
        apiUrl(`analytics/engagement?granularity=${granularity}&days=30`),
        { headers }
      );
      const engagementData = await engagementRes.json();
      setEngagement(engagementData);
      
      // Fetch rewards
      const rewardsRes = await fetch(
        apiUrl(`analytics/rewards?startDate=${dateRange.start}&endDate=${dateRange.end}`),
        { headers }
      );
      const rewardsData = await rewardsRes.json();
      setRewards(rewardsData);
      
      // Fetch health
      const healthRes = await fetch(apiUrl('analytics/health'), { headers });
      const healthData = await healthRes.json();
      setHealth(healthData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, granularity]);

  const handleExport = async (type) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        apiUrl(`analytics/export?format=csv&type=${type}`),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin text-green-500">
          <RefreshCw size={48} />
        </div>
      </div>
    );
  }

  const COLORS = ['#53FC18', '#1e40af', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4'];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-2">{org?.name} Performance Dashboard</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchAnalytics()}
            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100"
          >
            <RefreshCw size={18} /> Refresh
          </button>
          <button
            onClick={() => handleExport('overview')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          {['overview', 'engagement', 'rewards', 'health'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === tab
                  ? 'border-green-500 text-green-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Total Rewards</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {overview.metrics.totalRewards}
              </p>
              <p className="text-gray-500 text-xs mt-2">
                +{overview.metrics.activeRewards} active
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Viewers with Points</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {overview.metrics.viewersWithPoints}
              </p>
              <p className="text-gray-500 text-xs mt-2">Engaged users</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Monthly Revenue</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">
                €{overview.metrics.mrr.toFixed(2)}
              </p>
              <p className="text-gray-500 text-xs mt-2">
                {overview.currentPlan} plan
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Churn Rate</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">
                {overview.metrics.churnRate.toFixed(1)}%
              </p>
              <p className="text-gray-500 text-xs mt-2">Last 30 days</p>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Points Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Distributed', value: overview.metrics.pointsDistributed },
                    { name: 'Redeemed', value: overview.metrics.pointsRedeemed }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0, 1].map((index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={value => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === 'engagement' && engagement && (
        <div className="space-y-6">
          {/* Date Range & Granularity */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 flex gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-600" />
              <label className="text-sm text-gray-700">Granularity:</label>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>

          {/* Engagement Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API Calls & Engagement</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={engagement.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="apiCalls"
                  stroke="#53FC18"
                  dot={false}
                  name="API Calls"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="uniqueViewers"
                  stroke="#1e40af"
                  dot={false}
                  name="Unique Viewers"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Total API Calls</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {engagement.totals.totalApiCalls.toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Avg Viewers/Day</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {engagement.totals.avgUniqueViewersPerPeriod}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Points Distributed</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">
                {engagement.totals.totalPointsDistributed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rewards Tab */}
      {activeTab === 'rewards' && rewards && (
        <div className="space-y-6">
          {/* Rewards Table */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reward Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Point Value</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Earned</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Redeemed</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Redemption Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Total Points</th>
                </tr>
              </thead>
              <tbody>
                {rewards.rewards.map((reward, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{reward.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{reward.pointValue}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{reward.earnedCount}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{reward.redeemedCount}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-3 py-1 rounded text-white text-xs font-semibold ${
                        reward.redemptionRate > 50 ? 'bg-green-500' :
                        reward.redemptionRate > 25 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}>
                        {reward.redemptionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{reward.totalPointsEarned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rewards Performance Chart */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Redemption Rates</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rewards.rewards.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="redemptionRate" fill="#53FC18" name="Redemption Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <button
            onClick={() => handleExport('rewards')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
          >
            <Download size={18} /> Export Rewards Data
          </button>
        </div>
      )}

      {/* Health Tab */}
      {activeTab === 'health' && health && (
        <div className="space-y-6">
          {/* Health Score Card */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-lg">Organization Health Score</p>
                <p className="text-6xl font-bold text-green-600 mt-4">{health.healthScore}</p>
                <p className="text-gray-600 mt-4">
                  {health.healthScore >= 80 ? '🟢 Excellent' :
                   health.healthScore >= 60 ? '🟡 Good' :
                   health.healthScore >= 40 ? '🟠 Fair' : '🔴 Needs Attention'}
                </p>
              </div>
              <div className="text-right space-y-4">
                {Object.entries(health.factors).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-sm text-gray-600 capitalize">{key}</p>
                    <p className="text-lg font-semibold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
            {health.recommendations.length > 0 ? (
              <ul className="space-y-3">
                {health.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-green-500 font-bold text-lg">→</span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-green-600 font-semibold">Everything looks great! Keep up the momentum.</p>
            )}
          </div>
        </div>
      )}

      {/* Data retention notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p>
          <strong>Note:</strong> Analytics data is automatically tracked and retained for 90 days. 
          For long-term storage, export your data regularly.
        </p>
      </div>
    </div>
  );
}
