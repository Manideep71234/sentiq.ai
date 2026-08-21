import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MouseTracker from './components/MouseTracker';
import ChatView from './components/ChatView';
import AdminPanel from './components/AdminPanel';

import DocumentManager from './components/DocumentManager';
import EmailManager from './components/EmailManager';
import NotesTasksManager from './components/NotesTasksManager';
import CalendarManager from './components/CalendarManager';
import SettingsScheduledTasks from './components/SettingsScheduledTasks';
import SettingsAPIKeys from './components/SettingsAPIKeys';
import CompareView from './components/CompareView';
import ProfileView from './components/ProfileView';
import LoginView from './components/LoginView';
import ResetPasswordView from './components/ResetPasswordView';
import StudioView from './components/StudioView';
import CommandPalette from './components/CommandPalette';

function LogoutView() {
  return (
    <div className="app-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="app-container fade-in" style={{ maxWidth: '500px', height: 'auto', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <svg className="handwriting-svg" viewBox="0 0 400 100" style={{ width: '200px', height: 'auto', marginBottom: '10px' }}>
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="handwriting-text">
            Sentiq.AI
          </text>
        </svg>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Thanks for using our AI!</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          You have been successfully logged out of your session. We hope to see you again soon.
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          style={{
            marginTop: '10px', width: '100%', padding: '14px', background: 'var(--accent-color)', color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
            transition: 'opacity 0.2s'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.9'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}

function App() {
  const [activeView, setActiveView] = useState('chat');
  const [user, setUser] = useState({ username: 'Loading...' });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [showStartup, setShowStartup] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatTitle, setChatTitle] = useState('Chat');

  useEffect(() => {
    // Hide startup animation after 2.5s
    const timer = setTimeout(() => setShowStartup(false), 2500);
    return () => clearTimeout(timer);
  }, []);




  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleViewChange = (e) => {
      setActiveView(e.detail);
      if (e.detail === 'chat') {
        setChatTitle('New Chat'); // or keep it 'Chat', we'll update it when session loads
      }
    };

    const handleTitleUpdate = (e) => {
      if (activeView === 'chat') {
        setChatTitle(e.detail.title || 'Chat');
      }
    };

    window.addEventListener('changeView', handleViewChange);
    window.addEventListener('chatTitleUpdated', handleTitleUpdate);
    return () => {
      window.removeEventListener('changeView', handleViewChange);
      window.removeEventListener('chatTitleUpdated', handleTitleUpdate);
    };
  }, [activeView]);

  useEffect(() => {
    if (window.location.pathname === '/login' || window.location.pathname === '/logout-success' || window.location.pathname === '/reset-password') {
      return;
    }

    fetch('/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.username) {
          setUser(data);
          window.wsToken = data.ws_token;
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  if (window.location.pathname === '/login') {
    return <LoginView />;
  }

  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordView />;
  }

  if (window.location.pathname === '/logout-success') {
    return <LogoutView />;
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-wrapper">
      {showStartup && (
        <div className={`startup-overlay ${!showStartup ? 'fade-out' : ''}`}>
          <svg className="handwriting-svg" viewBox="0 0 400 100">
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="handwriting-text">
              Sentiq.AI
            </text>
          </svg>
        </div>
      )}

      <MouseTracker />
      <div className="app-container fade-in">
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          user={user}
          toggleTheme={toggleTheme}
          theme={theme}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
        />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <button
            className="mobile-menu-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={24} />
          </button>

          {activeView !== 'documents' && activeView !== 'email' && activeView !== 'notes' && activeView !== 'calendar' && activeView !== 'settings' && activeView !== 'scheduled-tasks' && activeView !== 'api-keys' && activeView !== 'compare' && activeView !== 'profile' && activeView !== 'admin' && (
            <header className="chat-header">
              <h2 key={chatTitle} className="animate-fade-in">
                {activeView === 'chat' ? chatTitle : activeView.charAt(0).toUpperCase() + activeView.slice(1)}
              </h2>
            </header>
          )}

          <div className="view-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: activeView === 'chat' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <ChatView activeView={activeView} setActiveView={setActiveView} />
            </div>
            <div style={{ display: activeView === 'research' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <ChatView isResearch={true} activeView={activeView} setActiveView={setActiveView} />
            </div>
            <div style={{ display: activeView === 'documents' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <DocumentManager user={user} />
            </div>
            <div style={{ display: activeView === 'email' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <EmailManager user={user} />
            </div>
            <div style={{ display: activeView === 'notes' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <NotesTasksManager user={user} />
            </div>
            <div style={{ display: activeView === 'calendar' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <CalendarManager user={user} />
            </div>
            <div style={{ display: activeView === 'settings' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <SettingsScheduledTasks user={user} />
            </div>
            <div style={{ display: activeView === 'api-keys' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <SettingsAPIKeys />
            </div>
            <div style={{ display: activeView === 'profile' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <ProfileView user={user} setUser={setUser} />
            </div>
            <div style={{ display: activeView === 'compare' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <CompareView />
            </div>
            <div style={{ display: activeView === 'admin' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <AdminPanel user={user} />
            </div>
            <div style={{ display: activeView === 'studio' ? 'flex' : 'none', flex: 1, height: '100%', flexDirection: 'column', overflow: 'hidden' }}>
              <StudioView />
            </div>
          </div>
        </main>
      </div>
      <CommandPalette activeView={activeView} setActiveView={setActiveView} />
    </div>
  );
}

export default App;
