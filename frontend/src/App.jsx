import { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';

import DocumentManager from './components/DocumentManager';
import EmailManager from './components/EmailManager';
import NotesTasksManager from './components/NotesTasksManager';
import CalendarManager from './components/CalendarManager';
import SettingsScheduledTasks from './components/SettingsScheduledTasks';
import SettingsAPIKeys from './components/SettingsAPIKeys';
import CompareView from './components/CompareView';
import ProfileView from './components/ProfileView';
import LoginView from './components/LoginView';

function App() {
  if (window.location.pathname === '/login') {
    return <LoginView />;
  }

  const [activeView, setActiveView] = useState('chat');
  const [user, setUser] = useState({ username: 'Loading...' });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showStartup, setShowStartup] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    const handleViewChange = (e) => setActiveView(e.detail);
    window.addEventListener('changeView', handleViewChange);
    return () => window.removeEventListener('changeView', handleViewChange);
  }, []);

  useEffect(() => {
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

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top 
    });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-wrapper" onMouseMove={handleMouseMove}>
      {showStartup && (
        <div className={`startup-overlay ${!showStartup ? 'fade-out' : ''}`}>
          <svg className="handwriting-svg" viewBox="0 0 400 100">
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="handwriting-text">
              Sentiq.AI
            </text>
          </svg>
        </div>
      )}
      
      <div className="app-container fade-in" onMouseMove={handleMouseMove}>
        <div 
          className="mouse-glow" 
          style={{ 
            left: `${mousePos.x}px`, 
            top: `${mousePos.y}px` 
          }} 
        />
        <Sidebar 
          activeView={activeView} 
          setActiveView={setActiveView} 
          user={user} 
          toggleTheme={toggleTheme} 
          theme={theme} 
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={24} />
          </button>
          
          {activeView !== 'documents' && activeView !== 'email' && activeView !== 'notes' && activeView !== 'calendar' && activeView !== 'settings' && activeView !== 'scheduled-tasks' && activeView !== 'api-keys' && activeView !== 'compare' && activeView !== 'profile' && (
            <header className="chat-header">
              <h2>{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</h2>
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
