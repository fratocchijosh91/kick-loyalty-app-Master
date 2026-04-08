import React, { useState, useEffect } from 'react';
import { Trophy, Award, Target, TrendingUp, Zap, Star } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';

export default function LeaderboardsPage() {
  const { org, orgId } = useOrganization();
  const [period, setPeriod] = useState('all_time');
  const [leaderboard, setLeaderboard] = useState(null);
  const [userRank, setUserRank] = useState(null);
  const [achievements, setAchievements] = useState(null);
  const [userAchievements, setUserAchievements] = useState(null);
  const [achievementProgress, setAchievementProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('leaderboard');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Get current user from localStorage or token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUser(payload.username || payload.sub);
      } catch (e) {
        console.error('Failed to parse token');
      }
    }
    
    fetchData();
  }, [period, selectedTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch leaderboard
      const leaderboardRes = await fetch(`/api/leaderboards?period=${period}`, { headers });
      const leaderboardData = await leaderboardRes.json();
      setLeaderboard(leaderboardData);
      
      // Fetch achievements
      const achievementsRes = await fetch(`/api/achievements`, { headers });
      const achievementsData = await achievementsRes.json();
      setAchievements(achievementsData);
      
      // If user is logged in, fetch their personal data
      if (currentUser) {
        const rankRes = await fetch(`/api/leaderboards/rank/${currentUser}`, { headers });
        const rankData = await rankRes.json();
        setUserRank(rankData);
        
        const userAchievementsRes = await fetch(`/api/achievements/${currentUser}`, { headers });
        const userAchievementsData = await userAchievementsRes.json();
        setUserAchievements(userAchievementsData);
        
        const progressRes = await fetch(`/api/achievements/${currentUser}/progress`, { headers });
        const progressData = await progressRes.json();
        setAchievementProgress(progressData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin text-green-500">
          <Trophy size={48} />
        </div>
      </div>
    );
  }

  const getPodiumColors = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-100 border-yellow-300';
      case 2:
        return 'bg-gray-100 border-gray-300';
      case 3:
        return 'bg-orange-100 border-orange-300';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getMedalEmoji = (rank) => {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return medals[rank] || '📍';
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Trophy className="text-yellow-500" size={40} />
            Leaderboards & Achievements
          </h1>
          <p className="text-gray-600 mt-2">{org?.name} Community Rankings</p>
        </div>
        <div className="text-right">
          {userRank && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Your Rank</p>
              <p className="text-4xl font-bold text-green-600">#{userRank.rank}</p>
              <p className="text-xs text-gray-600 mt-1">Top {userRank.percentile}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          {['leaderboard', 'achievements'].map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`py-4 px-2 border-b-2 transition ${
                selectedTab === tab
                  ? 'border-green-500 text-green-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'leaderboard' ? '🏆 Leaderboard' : '🎖️ Achievements'}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Tab */}
      {selectedTab === 'leaderboard' && leaderboard && (
        <div className="space-y-6">
          {/* Period Filter */}
          <div className="flex gap-4">
            {['all_time', 'monthly', 'weekly', 'daily'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded transition ${
                  period === p
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'all_time' ? '📅 All Time' :
                 p === 'monthly' ? '📆 Monthly' :
                 p === 'weekly' ? '📊 Weekly' : '📍 Today'}
              </button>
            ))}
          </div>

          {/* Podium (Top 3) */}
          {leaderboard.entries.length > 0 && (
            <div className="bg-gradient-to-b from-yellow-50 to-white border border-yellow-200 rounded-lg p-8">
              <h2 className="text-2xl font-bold text-center mb-8">🏆 Top 3</h2>
              <div className="grid grid-cols-3 gap-4 items-end mb-8">
                {/* 2nd Place */}
                {leaderboard.entries[1] && (
                  <div className={`border-2 rounded-lg p-6 text-center ${getPodiumColors(2)} min-h-64 flex flex-col justify-end`}>
                    <div className="text-4xl font-bold mb-2">🥈</div>
                    <div className="text-2xl font-bold text-gray-900">{leaderboard.entries[1].viewerUsername}</div>
                    <div className="text-sm text-gray-600 mt-2">Rank #2</div>
                    <div className="text-3xl font-bold text-blue-600 mt-4">{leaderboard.entries[1].points.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Points</div>
                  </div>
                )}

                {/* 1st Place */}
                {leaderboard.entries[0] && (
                  <div className={`border-2 rounded-lg p-6 text-center ${getPodiumColors(1)} min-h-72 flex flex-col justify-end transform scale-105`}>
                    <div className="text-5xl font-bold mb-2">🥇</div>
                    <div className="text-3xl font-bold text-yellow-700">{leaderboard.entries[0].viewerUsername}</div>
                    <div className="text-sm text-gray-700 font-semibold mt-2">Rank #1</div>
                    <div className="text-4xl font-bold text-yellow-600 mt-4">{leaderboard.entries[0].points.toLocaleString()}</div>
                    <div className="text-sm text-yellow-700 font-bold">Points</div>
                    <div className="mt-4 text-2xl">⭐⭐⭐</div>
                  </div>
                )}

                {/* 3rd Place */}
                {leaderboard.entries[2] && (
                  <div className={`border-2 rounded-lg p-6 text-center ${getPodiumColors(3)} min-h-64 flex flex-col justify-end`}>
                    <div className="text-4xl font-bold mb-2">🥉</div>
                    <div className="text-2xl font-bold text-gray-900">{leaderboard.entries[2].viewerUsername}</div>
                    <div className="text-sm text-gray-600 mt-2">Rank #3</div>
                    <div className="text-3xl font-bold text-orange-600 mt-4">{leaderboard.entries[2].points.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Points</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full Leaderboard */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Full Leaderboard</h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">#</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Viewer</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Points</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                  {currentUser && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>}
                </tr>
              </thead>
              <tbody>
                {leaderboard.entries.map((entry, idx) => {
                  const isCurrentUser = currentUser && entry.viewerUsername === currentUser.toLowerCase();
                  return (
                    <tr
                      key={idx}
                      className={`border-b border-gray-200 hover:bg-gray-50 transition ${
                        isCurrentUser ? 'bg-green-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <span className={`inline-block w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                          entry.rank === 2 ? 'bg-gray-100 text-gray-700' :
                          entry.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {getMedalEmoji(entry.rank)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{entry.viewerUsername}</td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-green-600">{entry.points.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        {entry.rank <= 3 && <span className="text-sm font-semibold text-yellow-600">🏆 Top 3</span>}
                        {entry.rank > 3 && entry.rank <= 10 && <span className="text-sm font-semibold text-blue-600">🎯 Top 10</span>}
                        {entry.rank > 10 && <span className="text-sm text-gray-600">Climbing...</span>}
                      </td>
                      {currentUser && (
                        <td className="px-6 py-4">
                          {isCurrentUser && <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-semibold">You</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Total Participants</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{leaderboard.totalParticipants}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Top Points</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">
                {leaderboard.entries[0]?.points.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-600 text-sm">Last Updated</p>
              <p className="text-sm text-gray-700 mt-2">
                {new Date(leaderboard.lastUpdated).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Tab */}
      {selectedTab === 'achievements' && achievements && (
        <div className="space-y-8">
          {/* User's Achievements Summary */}
          {userAchievements && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600">Your Achievements</p>
                  <p className="text-4xl font-bold text-purple-600 mt-2">{userAchievements.totalUnlocked}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    {userAchievements.completionRate}% Completed
                  </p>
                </div>
                <div className="text-6xl">🏅</div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-full transition-all duration-500"
                    style={{ width: `${userAchievements.completionRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {userAchievements.totalUnlocked} / {userAchievements.totalAvailable} achievements unlocked
                </p>
              </div>
            </div>
          )}

          {/* Unlocked Achievements */}
          {userAchievements && userAchievements.unlockedAchievements.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">🎖️ Unlocked Achievements</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {userAchievements.unlockedAchievements.map((ach, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-br from-yellow-100 to-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-center hover:shadow-lg transition cursor-pointer"
                    title={ach.name}
                  >
                    <div className="text-4xl mb-2">{ach.icon}</div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{ach.name}</p>
                    {ach.pointReward > 0 && (
                      <p className="text-xs text-yellow-600 mt-2">+{ach.pointReward} pts</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(ach.unlockedAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Achievement Progress */}
          {achievementProgress && achievementProgress.achievements.length > 0 && (
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 In Progress</h3>
              <div className="space-y-4">
                {achievementProgress.achievements.slice(0, 5).map((ach, idx) => (
                  <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{ach.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{ach.name}</p>
                          <p className="text-sm text-gray-600">{ach.progressText}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{Math.round(ach.progress)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all duration-500"
                        style={{ width: `${ach.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Available Achievements */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">🏆 All Achievements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {achievements.achievements.map((ach, idx) => {
                const isUnlocked = userAchievements?.unlockedAchievements.some(u => u.id === ach.id);
                return (
                  <div
                    key={idx}
                    className={`border-2 rounded-lg p-4 text-center transition cursor-pointer ${
                      isUnlocked
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                    title={ach.description}
                  >
                    <div className="text-4xl mb-2 opacity-100">{ach.icon}</div>
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{ach.name}</p>
                    <div className="mt-2 text-xs">
                      <p className="text-gray-600 line-clamp-1">{ach.requirement.type.replace(/_/g, ' ')}</p>
                      {!isUnlocked && (
                        <p className="text-gray-500 mt-1 text-xs">{ach.requirement.value} required</p>
                      )}
                      {isUnlocked && (
                        <p className="text-green-600 font-semibold mt-1">✓ Unlocked</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Achievement Categories */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {achievements.categories.map(cat => {
              const catAchievements = achievements.achievements.filter(a => a.category === cat);
              const catUnlocked = userAchievements?.unlockedAchievements.filter(
                a => catAchievements.some(ca => ca.id === a.id)
              ).length || 0;
              
              return (
                <div key={cat} className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-900 capitalize">{cat}</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">{catUnlocked}/{catAchievements.length}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${(catUnlocked / catAchievements.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
