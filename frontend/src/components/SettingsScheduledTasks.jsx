import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Inbox } from 'lucide-react';

export default function SettingsScheduledTasks({ user }) {
  const [tasks, setTasks] = useState([]);
  const [results, setResults] = useState([]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '', prompt: '', cron_expression: '0 8 * * *' // default daily at 8am
  });

  useEffect(() => {
    fetchTasks();
    fetchResults();
    
    // Poll for results every 15s since tasks run in background
    const interval = setInterval(fetchResults, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    const res = await fetch('/scheduled-tasks/');
    const data = await res.json();
    setTasks(data);
  };

  const fetchResults = async () => {
    const res = await fetch('/scheduled-tasks/results');
    const data = await res.json();
    setResults(data);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    await fetch('/scheduled-tasks/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    });
    setShowAddForm(false);
    setNewTask({ name: '', prompt: '', cron_expression: '0 8 * * *' });
    fetchTasks();
  };

  const toggleTask = async (task) => {
    await fetch(`/scheduled-tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !task.enabled })
    });
    fetchTasks();
  };

  const deleteTask = async (id) => {
    if (confirm("Are you sure you want to delete this scheduled task and all its results?")) {
      await fetch(`/scheduled-tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
      fetchResults();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'transparent' }}>
      <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', width: '100%', display: 'flex', gap: '2rem', height: '100%' }}>
        
        {/* Left Col: Configured Tasks */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock /> Scheduled Agents</h2>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              <Plus size={16} /> New Agent
            </button>
          </div>

          {showAddForm && (
            <form className="glass-panel" onSubmit={handleAddTask} style={{ padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--panel-border)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Name</label>
                <input className="chat-input" placeholder="e.g. Daily Executive Summary" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} required />
              </div>
              <div>
                <label>Prompt</label>
                <textarea className="chat-input" placeholder="What should the agent do? e.g., 'Summarize my unread emails and check my schedule for today.'" value={newTask.prompt} onChange={e => setNewTask({...newTask, prompt: e.target.value})} required style={{ minHeight: '80px' }} />
              </div>
              <div>
                <label>Cron Expression <small>(minute hour day month day-of-week)</small></label>
                <input className="chat-input" placeholder="0 8 * * *" value={newTask.cron_expression} onChange={e => setNewTask({...newTask, cron_expression: e.target.value})} required style={{ fontFamily: 'monospace' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddForm(false)} style={{ background: 'none', border: '1px solid var(--panel-border)', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                <button type="submit" style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}>Save Task</button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tasks.map(t => (
              <div key={t.id} className="glass-panel" style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)', opacity: t.enabled ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{t.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={t.enabled} onChange={() => toggleTask(t)} />
                      {t.enabled ? 'Active' : 'Paused'}
                    </label>
                    <button onClick={() => deleteTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginBottom: '0.75rem', background: 'var(--user-msg-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>
                  Cron: {t.cron_expression}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {t.prompt}
                </div>
                {t.last_run_at && (
                  <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Last run: {new Date(t.last_run_at + 'Z').toLocaleString()}
                  </div>
                )}
              </div>
            ))}
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>No scheduled agents configured.</div>
            )}
          </div>
        </div>

        {/* Right Col: Task Results Inbox */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--panel-border)', paddingLeft: '2rem', overflowY: 'auto' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}><Inbox /> Results Inbox</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Array.isArray(results) && results.map(r => (
              <div key={r.id} className="glass-panel" style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--accent-color)' }}>{r.task_name}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {r.output}
                </div>
              </div>
            ))}
            {results.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>No task results yet.</div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
