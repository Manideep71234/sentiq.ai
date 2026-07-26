import { useState, useEffect } from 'react';
import { Plus, CheckCircle, Circle, Trash2 } from 'lucide-react';

export default function NotesTasksManager({ user }) {
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' or 'tasks'
  
  // Notes State
  const [notes, setNotes] = useState([]);
  const [activeNote, setActiveNote] = useState(null);
  
  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    fetchNotes();
    fetchTasks();
  }, []);

  const fetchNotes = async () => {
    const res = await fetch('/notes/');
    const data = await res.json();
    setNotes(data);
  };

  const createNote = async () => {
    const res = await fetch('/notes/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Note', body: '' })
    });
    const data = await res.json();
    setNotes([data, ...notes]);
    setActiveNote(data);
  };

  const updateNote = async (id, title, body) => {
    await fetch(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body })
    });
    fetchNotes();
  };

  const deleteNote = async (id) => {
    await fetch(`/notes/${id}`, { method: 'DELETE' });
    if (activeNote && activeNote.id === id) setActiveNote(null);
    fetchNotes();
  };

  const fetchTasks = async () => {
    const res = await fetch('/tasks/');
    const data = await res.json();
    setTasks(data);
  };

  const createTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await fetch('/tasks/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle })
    });
    setNewTaskTitle('');
    fetchTasks();
  };

  const toggleTask = async (task) => {
    await fetch(`/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done })
    });
    fetchTasks();
  };

  const deleteTask = async (id) => {
    await fetch(`/tasks/${id}`, { method: 'DELETE' });
    fetchTasks();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'transparent' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'center', background: 'transparent' }}>
        <div className="glass-panel" style={{ display: 'flex', padding: '0.25rem', borderRadius: '12px', gap: '0.25rem' }}>
          <button 
            onClick={() => setActiveTab('notes')}
            style={{ 
              background: activeTab === 'notes' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'notes' ? 'white' : 'var(--text-secondary)',
              border: 'none', 
              borderRadius: '8px',
              padding: '0.5rem 2rem',
              cursor: 'pointer', 
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Notes
          </button>
          <button 
            onClick={() => setActiveTab('tasks')}
            style={{ 
              background: activeTab === 'tasks' ? 'var(--accent-color)' : 'transparent',
              color: activeTab === 'tasks' ? 'white' : 'var(--text-secondary)',
              border: 'none', 
              borderRadius: '8px',
              padding: '0.5rem 2rem',
              cursor: 'pointer', 
              fontWeight: 500,
              transition: 'all 0.2s'
            }}
          >
            Tasks
          </button>
        </div>
      </div>

      {activeTab === 'notes' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '250px', borderRight: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--panel-border)' }}>
              <button onClick={createNote} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                <Plus size={16} /> New Note
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notes.map(n => (
                <div 
                  key={n.id}
                  onClick={() => setActiveNote(n)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--panel-border)',
                    cursor: 'pointer',
                    background: activeNote?.id === n.id ? 'var(--user-msg-bg)' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteNote(n.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '2rem' }}>
            {activeNote ? (
              <>
                <input 
                  value={activeNote.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setActiveNote({...activeNote, title: newTitle});
                  }}
                  onBlur={(e) => updateNote(activeNote.id, e.target.value, activeNote.body)}
                  style={{ fontSize: '2rem', fontWeight: 'bold', border: 'none', outline: 'none', marginBottom: '1rem', width: '100%', background: 'transparent', color: 'var(--text-primary)' }}
                  placeholder="Note Title"
                />
                <textarea 
                  value={activeNote.body}
                  onChange={(e) => {
                    const newBody = e.target.value;
                    setActiveNote({...activeNote, body: newBody});
                  }}
                  onBlur={(e) => updateNote(activeNote.id, activeNote.title, e.target.value)}
                  style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '1rem', fontFamily: 'inherit', lineHeight: 1.5, background: 'transparent', color: 'var(--text-primary)' }}
                  placeholder="Start typing your note here..."
                />
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                Select a note or create a new one.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
          <h2>Tasks</h2>
          <form onSubmit={createTask} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            <input 
              type="text" 
              className="chat-input" 
              placeholder="What needs to be done?" 
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', padding: '0 1rem', cursor: 'pointer' }}>Add</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tasks.map(t => (
              <div key={t.id} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)', opacity: t.done ? 0.6 : 1 }}>
                <button 
                  onClick={() => toggleTask(t)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.done ? 'var(--accent-color)' : 'var(--text-secondary)' }}
                >
                  {t.done ? <CheckCircle size={20} /> : <Circle size={20} />}
                </button>
                <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span>
                <button onClick={() => deleteTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
