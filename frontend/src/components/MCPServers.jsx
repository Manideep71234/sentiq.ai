import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Play, AlertTriangle, Check, X, Server } from 'lucide-react';

export default function MCPServers() {
  const [servers, setServers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', type: 'local', command: '', args: '', env_vars: '', enabled: true
  });
  
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const res = await fetch('/admin/mcp-servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    let argsArray = [];
    if (formData.type === 'local') {
      argsArray = formData.args.split('\n').map(a => a.trim()).filter(a => a);
    }
    
    const envObj = {};
    formData.env_vars.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        envObj[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });

    // Enforce URL check for remote
    if (formData.type === 'remote' && !formData.command.startsWith('http')) {
      alert("Remote server URLs must start with http:// or https://");
      return;
    }

    const payload = {
      name: formData.name,
      command: formData.command,
      args: argsArray,
      env_vars: envObj,
      enabled: formData.enabled
    };

    const url = editingId ? `/admin/mcp-servers/${editingId}` : '/admin/mcp-servers';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      let data;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch(e) {
        data = { detail: `Server returned invalid JSON. HTTP ${res.status}: ${text.slice(0, 100)}` };
      }

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
        setTestResult(null);
        fetchServers();
      } else {
        alert(data.detail || 'Failed to save MCP server');
      }
    } catch(e) {
      alert(`Network error: ${e.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this MCP server?')) {
      await fetch(`/admin/mcp-servers/${id}`, { method: 'DELETE' });
      fetchServers();
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    // Enforce URL check for remote
    if (formData.type === 'remote' && !formData.command.startsWith('http')) {
      setTestResult({ success: false, error: "Remote server URLs must start with http:// or https://" });
      setIsTesting(false);
      return;
    }

    let argsArray = [];
    if (formData.type === 'local') {
      argsArray = formData.args.split('\n').map(a => a.trim()).filter(a => a);
    }
    const envObj = {};
    formData.env_vars.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        envObj[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });

    try {
      const res = await fetch('/admin/mcp-servers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          command: formData.command,
          args: argsArray,
          env_vars: envObj
        })
      });
      
      let data;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch(e) {
        data = { detail: `Server returned invalid JSON. HTTP ${res.status}: ${text.slice(0, 100)}` };
      }
      
      if (res.ok) {
        setTestResult({ success: true, tools: data.tools });
      } else {
        setTestResult({ success: false, error: data.detail || 'Connection failed' });
      }
    } catch (e) {
      setTestResult({ success: false, error: e.message });
    }
    setIsTesting(false);
  };

  const editServer = (server) => {
    const isRemote = server.command.startsWith('http://') || server.command.startsWith('https://');
    setFormData({
      name: server.name,
      type: isRemote ? 'remote' : 'local',
      command: server.command,
      args: server.args.join('\n'),
      env_vars: Object.entries(server.env_vars).map(([k, v]) => `${k}=${v}`).join('\n'),
      enabled: server.enabled
    });
    setEditingId(server.id);
    setShowForm(true);
    setTestResult(null);
  };

  return (
    <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Server size={24} /> MCP Servers
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
            Manage external Model Context Protocol integrations
          </p>
        </div>
        {!showForm && (
          <button 
            className="btn-primary" 
            onClick={() => {
              setFormData({ name: '', type: 'local', command: '', args: '', env_vars: '', enabled: true });
              setEditingId(null);
              setShowForm(true);
              setTestResult(null);
            }}
          >
            <Plus size={16} /> Add Server
          </button>
        )}
      </div>

      {showForm ? (
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(255, 69, 58, 0.1)', color: '#ff453a', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Security Warning:</strong> MCP servers run as real processes on this server with system access. Only add servers you explicitly trust.
            </div>
          </div>
          
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Server Name (Identifier)</label>
                <input type="text" className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. workspace-fs" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Server Type</label>
                <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="local">Local (Command)</option>
                  <option value="remote">Remote (HTTP/SSE URL)</option>
                </select>
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                {formData.type === 'local' ? 'Command (e.g. npx, python, docker)' : 'Server URL (must start with http:// or https://)'}
              </label>
              <input type="text" className="input-field" required value={formData.command} onChange={e => setFormData({...formData, command: e.target.value})} placeholder={formData.type === 'local' ? 'npx' : 'https://jntuhresults.dhethi.com/mcp'} />
            </div>
            
            {formData.type === 'local' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Arguments (One per line)</label>
                <textarea className="input-field" rows={3} value={formData.args} onChange={e => setFormData({...formData, args: e.target.value})} placeholder="-y&#10;@modelcontextprotocol/server-sqlite&#10;/path/to/db.sqlite" />
              </div>
            )}
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                {formData.type === 'local' ? 'Environment Variables' : 'HTTP Headers'} (KEY=VALUE, one per line, encrypted at rest)
              </label>
              <textarea className="input-field" rows={3} value={formData.env_vars} onChange={e => setFormData({...formData, env_vars: e.target.value})} placeholder={formData.type === 'local' ? 'API_KEY=your_secret_key' : 'Authorization=Bearer your_token'} />
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.enabled} onChange={e => setFormData({...formData, enabled: e.target.checked})} />
                Enable this server
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Save Server</button>
              
              <div style={{ flex: 1 }}></div>
              <button type="button" className="btn-secondary" onClick={handleTest} disabled={isTesting || !formData.command}>
                {isTesting ? 'Testing...' : <><Play size={16} /> Test Connection</>}
              </button>
            </div>
          </form>
          
          {testResult && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: testResult.success ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 69, 58, 0.1)', border: `1px solid ${testResult.success ? '#30d158' : '#ff453a'}`, borderRadius: '8px' }}>
              {testResult.success ? (
                <>
                  <div style={{ color: '#30d158', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}><Check size={18} /> Connection Successful</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Discovered {testResult.tools.length} tool(s):</div>
                  <ul style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                    {testResult.tools.map((t, i) => <li key={i}><strong>{t.name}</strong>: {t.description}</li>)}
                  </ul>
                </>
              ) : (
                <div style={{ color: '#ff453a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><X size={18} /> Connection Failed: {testResult.error}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {servers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No MCP servers configured. Add one to expand the AI's capabilities!
            </div>
          ) : (
            servers.map(server => {
              const isRemote = server.command.startsWith('http://') || server.command.startsWith('https://');
              return (
                <div key={server.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {server.name}
                      {!server.enabled && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--panel-border)', borderRadius: '10px' }}>Disabled</span>}
                      {isRemote ? 
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '10px' }}>Remote</span> : 
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--panel-border)', borderRadius: '10px' }}>Local</span>
                      }
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {server.command} {isRemote ? '' : server.args.join(' ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="icon-button" onClick={() => editServer(server)}><Edit2 size={16} /></button>
                    <button className="icon-button" onClick={() => handleDelete(server.id)} style={{ color: '#ff453a' }}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
