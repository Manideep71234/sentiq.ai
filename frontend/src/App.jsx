import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';

import DocumentManager from './components/DocumentManager';
import EmailManager from './components/EmailManager';
import NotesTasksManager from './components/NotesTasksManager';
import CalendarManager from './components/CalendarManager';
import SettingsScheduledTasks from './components/SettingsScheduledTasks';
import CompareView from './components/CompareView';

function App() {
  const [activeView, setActiveView] = useState('chat');
  const [user, setUser] = useState({ username: 'Loading...' });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    fetch('/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.username) {
          setUser(data);
        } else {
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="app-wrapper" onMouseMove={handleMouseMove}>
      <div 
        className="mouse-glow" 
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }} 
      />
      <div className="app-container fade-in">
        <Sidebar 
          activeView={activeView} 
          setActiveView={setActiveView} 
          user={user} 
          toggleTheme={toggleTheme} 
          theme={theme} 
        />
        
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
          {activeView !== 'documents' && activeView !== 'email' && activeView !== 'notes' && activeView !== 'calendar' && activeView !== 'settings' && (
            <header className="chat-header">
              <h2>{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</h2>
            </header>
          )}
          
          <div key={activeView} className="view-transition" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeView === 'chat' && <ChatView />}
            {activeView === 'research' && <ChatView isResearch={true} />}
            {activeView === 'documents' && <DocumentManager user={user} />}
            {activeView === 'email' && <EmailManager user={user} />}
            {activeView === 'notes' && <NotesTasksManager user={user} />}
            {activeView === 'calendar' && <CalendarManager user={user} />}
            {activeView === 'settings' && <SettingsScheduledTasks user={user} />}
            {activeView === 'compare' && <CompareView />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
