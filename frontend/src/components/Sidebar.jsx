import { useState, useEffect } from 'react';
import { MessageSquare, Globe, FileText, Mail, FileEdit, Calendar, GitCompare, Settings, LogOut, Key, Plus, Edit2, Trash2, Check, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, user, toggleTheme, theme, isOpen, setIsOpen, isCollapsed, setIsCollapsed }) {
  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'research', icon: Globe, label: 'Research' },
    { id: 'documents', icon: FileText, label: 'Documents' },
    { id: 'email', icon: Mail, label: 'Email' },
    { id: 'notes', icon: FileEdit, label: 'Notes' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'compare', icon: GitCompare, label: 'Compare' },
    { id: 'api-keys', icon: Key, label: 'API Keys' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const [chatSessions, setChatSessions] = useState([]);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [hoveredSessionId, setHoveredSessionId] = useState(null);

  const handleEditSave = async (id) => {
    try {
      const res = await fetch(`/chat/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle })
      });
      if (res.ok) {
        setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title: editingTitle } : s));
        window.dispatchEvent(new CustomEvent('chatTitleUpdated', { detail: { sessionId: id, title: editingTitle } }));
      }
    } catch (e) {
      console.error('Failed to update title:', e);
    }
    setEditingSessionId(null);
  };

  const handleDelete = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      try {
        const res = await fetch(`/chat/sessions/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setChatSessions(prev => prev.filter(s => s.id !== id));
          window.dispatchEvent(new CustomEvent('loadChatSession', { detail: { sessionId: null } }));
        }
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
    }
  };

  const fetchChatSessions = async () => {
    try {
      const res = await fetch('/chat/sessions');
      if (res.ok) {
        const data = await res.json();
        setChatSessions(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch chat sessions:', e);
    }
  };

  useEffect(() => {
    fetchChatSessions();
    
    const handleTitleUpdate = () => fetchChatSessions();
    window.addEventListener('chatTitleUpdated', handleTitleUpdate);
    return () => window.removeEventListener('chatTitleUpdated', handleTitleUpdate);
  }, []);

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(false)} />
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Sentiq<span style={{ color: 'var(--accent-color)' }}>.AI</span></span>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="theme-toggle" onClick={() => setIsCollapsed(!isCollapsed)} title="Toggle Sidebar">
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme" style={isCollapsed ? { display: 'none' } : {}}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        
        <nav style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '0.5rem' }}>
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button 
                    className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                    onClick={() => {
                      if (item.id === 'chat') {
                        window.dispatchEvent(new CustomEvent('loadChatSession', { detail: { sessionId: null } }));
                      }
                      setActiveView(item.id);
                      setIsOpen(false);
                      setIsCollapsed(false);
                    }}
                    style={item.id === 'chat' ? { display: 'flex', justifyContent: 'space-between', width: '100%' } : {}}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Icon size={18} style={{ flexShrink: 0 }} />
                      <span className="nav-label">{item.label}</span>
                    </div>
                    {item.id === 'chat' && activeView === 'chat' && (
                      <Plus className="nav-extra" size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
                    )}
                  </button>
                  {item.id === 'chat' && activeView === 'chat' && chatSessions.length > 0 && !isCollapsed && (
                    <ul style={{ listStyle: 'none', paddingLeft: '2.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {chatSessions.map(session => (
                        <li 
                          key={session.id}
                          onMouseEnter={() => setHoveredSessionId(session.id)}
                          onMouseLeave={() => setHoveredSessionId(null)}
                        >
                          <div
                            className="nav-item"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', minHeight: 'auto', background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            {editingSessionId === session.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '4px' }}>
                                <input
                                  autoFocus
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEditSave(session.id);
                                    if (e.key === 'Escape') setEditingSessionId(null);
                                  }}
                                  style={{ flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.85rem' }}
                                />
                                <button onClick={() => handleEditSave(session.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex' }}><Check size={14} /></button>
                                <button onClick={() => setEditingSessionId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex' }}><X size={14} /></button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    window.dispatchEvent(new CustomEvent('loadChatSession', { detail: { sessionId: session.id, title: session.title } }));
                                    setIsOpen(false);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'inherit', flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                                >
                                  {session.title || 'New Chat'}
                                </button>
                                {hoveredSessionId === session.id && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingSessionId(session.id);
                                        setEditingTitle(session.title || 'New Chat');
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                                      title="Edit Title"
                                    ><Edit2 size={14} /></button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(session.id, session.title || 'New Chat');
                                      }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)', display: 'flex' }}
                                      title="Delete Chat"
                                    ><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <button 
          className="nav-item" 
          onClick={() => { setActiveView('profile'); setIsOpen(false); }} 
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: activeView === 'profile' ? 'var(--hover-bg)' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}
        >
          {user.profile_pic ? (
            <img 
              src={user.profile_pic} 
              alt="Profile" 
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} 
            />
          ) : (
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {user.username?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="nav-label" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(user.full_name || user.username)?.includes('@') ? (user.full_name || user.username).split('@')[0].toUpperCase() : (user.full_name || user.username)}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Manage Profile
            </span>
          </div>
        </button>
        <button 
          className="nav-item"
          onClick={async () => {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/logout-success';
          }}
          style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} /> <span className="nav-label">Logout</span>
        </button>
      </div>
    </aside>
    </>
  );
}
