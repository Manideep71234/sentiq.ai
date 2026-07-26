import { MessageSquare, Globe, FileText, Mail, FileEdit, Calendar, GitCompare, Settings, LogOut } from 'lucide-react';

export default function Sidebar({ activeView, setActiveView, user, toggleTheme, theme }) {
  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'research', icon: Globe, label: 'Research' },
    { id: 'documents', icon: FileText, label: 'Documents' },
    { id: 'email', icon: Mail, label: 'Email' },
    { id: 'notes', icon: FileEdit, label: 'Notes' },
    { id: 'calendar', icon: Calendar, label: 'Calendar' },
    { id: 'compare', icon: GitCompare, label: 'Compare' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const handleLogout = async () => {
    try {
      const response = await fetch('/auth/logout', { method: 'POST' });
      if (response.ok) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>Sentiq<span style={{ color: 'var(--accent-color)' }}>.AI</span></span>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
      
      <nav style={{ flex: 1 }}>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button 
                  className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => setActiveView(item.id)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0 0.5rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user.username}</span>
        </div>
        <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--text-secondary)' }}>
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
