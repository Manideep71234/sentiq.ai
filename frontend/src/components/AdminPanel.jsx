import { useState, useEffect } from 'react';
import { Activity, Users, FileClock, CheckCircle, XCircle, Trash2, ShieldOff, Shield } from 'lucide-react';

export default function AdminPanel({ user }) {
  const [activeTab, setActiveTab] = useState('status');
  const [status, setStatus] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab, logPage]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'status') {
        const res = await fetch('/admin/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        setStatus(await res.json());
      } else if (activeTab === 'users') {
        const res = await fetch('/admin/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        setUsersList(await res.json());
      } else if (activeTab === 'logs') {
        const res = await fetch(`/admin/audit-logs?skip=${logPage * 50}&limit=50`);
        if (!res.ok) throw new Error('Failed to fetch logs');
        const data = await res.json();
        setAuditLogs(data.logs);
        setAuditTotal(data.total);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      const res = await fetch(`/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      if (res.ok) {
        setUsersList(usersList.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update user');
      }
    } catch (e) {
      alert('Error updating user status');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (window.confirm(`CRITICAL WARNING: Are you absolutely sure you want to PERMANENTLY DELETE user "${username}" and ALL their associated data (chats, emails, documents, etc.)? This cannot be undone.`)) {
      try {
        const res = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
          setUsersList(usersList.filter(u => u.id !== userId));
        } else {
          const err = await res.json();
          alert(err.detail || 'Failed to delete user');
        }
      } catch (e) {
        alert('Error deleting user');
      }
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="view-container flex items-center justify-center h-full text-red-500">
        <h2>403 Forbidden - Admin Access Required</h2>
      </div>
    );
  }

  return (
    <div className="view-container h-full flex flex-col p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-400" /> Admin Control Panel
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-700 mb-6">
        <button
          className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'status' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('status')}
        >
          <Activity className="w-4 h-4" /> System Status
        </button>
        <button
          className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'users' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('users')}
        >
          <Users className="w-4 h-4" /> User Management
        </button>
        <button
          className={`pb-2 px-1 flex items-center gap-2 ${activeTab === 'logs' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
          onClick={() => setActiveTab('logs')}
        >
          <FileClock className="w-4 h-4" /> Audit Logs
        </button>
      </div>

      {error && <div className="p-3 bg-red-900/30 text-red-400 rounded-lg mb-4 text-sm">{error}</div>}

      <div className="flex-1 overflow-auto">
        {/* Status Tab */}
        {activeTab === 'status' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1f2937] p-4 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center text-center">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Uptime</h3>
              <div className="text-2xl font-mono text-gray-200">
                {status ? (status.uptime_seconds / 3600).toFixed(1) + ' hrs' : '...'}
              </div>
            </div>
            
            <div className="bg-[#1f2937] p-4 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center text-center">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Database Health</h3>
              <div className={`text-2xl font-bold flex items-center gap-2 ${status?.db_ok ? 'text-green-400' : 'text-red-400'}`}>
                {status?.db_ok ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                {status?.db_ok ? 'Online' : 'Offline'}
              </div>
            </div>

            <div className="bg-[#1f2937] p-4 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center text-center">
              <h3 className="text-gray-400 text-sm font-medium mb-2">Groq API Reachable</h3>
              <div className={`text-2xl font-bold flex items-center gap-2 ${status?.groq_ok ? 'text-green-400' : 'text-red-400'}`}>
                {status?.groq_ok ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                {status?.groq_ok ? 'Online' : 'Offline'}
              </div>
            </div>

            <div className="bg-[#1f2937] p-4 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center text-center">
              <h3 className="text-gray-400 text-sm font-medium mb-2">OpenRouter API</h3>
              <div className={`text-2xl font-bold flex items-center gap-2 ${status?.openrouter_ok ? 'text-green-400' : 'text-red-400'}`}>
                {status?.openrouter_ok ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                {status?.openrouter_ok ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-[#1f2937] rounded-lg border border-gray-700/50 overflow-hidden">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-[#111827] text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {usersList.map(u => (
                  <tr key={u.id} className="hover:bg-gray-750/30">
                    <td className="px-4 py-3 font-mono">{u.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200">{u.username}</div>
                      <div className="text-xs text-gray-500">{u.email || u.auth_provider}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_admin ? <span className="text-indigo-400 font-medium">Admin</span> : 'User'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                          disabled={u.id === user.id}
                          className={`p-1.5 rounded-lg transition-colors ${u.id === user.id ? 'opacity-50 cursor-not-allowed text-gray-500' : (u.is_active ? 'hover:bg-amber-500/10 text-amber-400' : 'hover:bg-green-500/10 text-green-400')}`}
                          title={u.is_active ? 'Disable Account' : 'Enable Account'}
                        >
                          <ShieldOff className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          disabled={u.id === user.id}
                          className={`p-1.5 rounded-lg transition-colors ${u.id === user.id ? 'opacity-50 cursor-not-allowed text-gray-500' : 'hover:bg-red-500/10 text-red-400'}`}
                          title="Permanently Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usersList.length === 0 && !loading && (
                  <tr><td colSpan="6" className="text-center py-6 text-gray-500">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-[#1f2937] rounded-lg border border-gray-700/50 overflow-hidden flex flex-col h-full">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-[#111827] text-gray-400 text-xs uppercase sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-750/30">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-200">
                        {log.event_type}
                      </td>
                      <td className="px-4 py-3">
                        {log.username} <span className="text-gray-500 text-xs">({log.user_id || '-'})</span>
                      </td>
                      <td className="px-4 py-3">
                        <pre className="text-xs text-gray-400 bg-black/20 p-2 rounded overflow-x-auto max-w-sm">
                          {log.metadata_json || '{}'}
                        </pre>
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && !loading && (
                    <tr><td colSpan="4" className="text-center py-6 text-gray-500">No logs found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-[#111827] p-3 border-t border-gray-700/50 flex justify-between items-center text-sm text-gray-400">
              <div>
                Showing {logPage * 50 + 1} to {Math.min((logPage + 1) * 50, auditTotal)} of {auditTotal}
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={logPage === 0} 
                  onClick={() => setLogPage(p => p - 1)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button 
                  disabled={(logPage + 1) * 50 >= auditTotal} 
                  onClick={() => setLogPage(p => p + 1)}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        
        {loading && <div className="text-center p-8 text-gray-500 animate-pulse">Loading...</div>}
      </div>
    </div>
  );
}
