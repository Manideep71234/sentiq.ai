import { useState, useEffect } from 'react';
import { MessageSquare, Globe, FileText, Mail, FileEdit, Calendar, GitCompare, Settings, LogOut, Key, Plus } from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, user, toggleTheme, theme, isOpen, setIsOpen }) {
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
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <span>Sentiq<span style={{ color: 'var(--accent-color)' }}>.AI</span></span>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
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
                    }}
                    style={item.id === 'chat' ? { display: 'flex', justifyContent: 'space-between', width: '100%' } : {}}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Icon size={18} />
                      {item.label}
                    </div>
                    {item.id === 'chat' && activeView === 'chat' && (
                      <Plus size={16} style={{ opacity: 0.7 }} />
                    )}
                  </button>
                  {item.id === 'chat' && activeView === 'chat' && chatSessions.length > 0 && (
                    <ul style={{ listStyle: 'none', paddingLeft: '2.5rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {chatSessions.map(session => (
                        <li key={session.id}>
                          <button
                            className="nav-item"
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', minHeight: 'auto', background: 'transparent' }}
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('loadChatSession', { detail: { sessionId: session.id, title: session.title } }));
                              setIsOpen(false);
                            }}
                          >
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'left' }}>
                              {session.title || 'New Chat'}
                            </div>
                          </button>
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
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {(user.full_name || user.username)?.includes('@') ? (user.full_name || user.username).split('@')[0].toUpperCase() : (user.full_name || user.username)}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Manage Profile
            </span>
          </div>
        </button>
        <button 
          className="nav-item"
          onClick={() => window.location.href = '/auth/logout'}
          style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
    </>
  );
}
