import { MessageSquare, Globe, FileText, Mail, FileEdit, Calendar, GitCompare, Settings, LogOut, Key } from 'lucide-react';

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
                    onClick={() => { setActiveView(item.id); setIsOpen(false); }}
                  >
                    <Icon size={18} />
                  {item.label}
                </button>
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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: '1.2' }}>
              {user.full_name || user.username}
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
