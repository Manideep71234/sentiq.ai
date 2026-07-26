import { useState, useEffect } from 'react';
import { Calendar, Plus, Clock } from 'lucide-react';

export default function CalendarManager({ user }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [form, setForm] = useState({
    caldav_url: '', username: '', password: ''
  });

  const [newEvent, setNewEvent] = useState({
    summary: '', description: '', start: '', end: ''
  });

  useEffect(() => {
    checkAccount();
  }, []);

  const checkAccount = async () => {
    try {
      const res = await fetch('/calendar/account');
      const data = await res.json();
      if (data) {
        setAccount(data);
        fetchEvents();
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const connectAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/calendar/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      await checkAccount();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/calendar/events');
      const data = await res.json();
      setEvents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      // Input datetime-local gives "YYYY-MM-DDTHH:mm", convert to UTC string
      const startObj = new Date(newEvent.start);
      const endObj = new Date(newEvent.end);
      
      await fetch('/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: newEvent.summary,
          description: newEvent.description,
          start: startObj.toISOString(),
          end: endObj.toISOString()
        })
      });
      setShowAddForm(false);
      setNewEvent({ summary: '', description: '', start: '', end: '' });
      fetchEvents();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && !account) {
    return <div style={{ padding: '2rem' }}>Loading calendar configuration...</div>;
  }

  if (!account) {
    return (
      <div style={{ padding: '2rem', maxWidth: '500px', margin: '2rem auto', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Connect Calendar</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Connect to Nextcloud, Apple iCloud, Google, or any CalDAV server.</p>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          {[
            { name: 'iCloud', url: 'https://caldav.icloud.com/' },
            { name: 'Fastmail', url: 'https://caldav.fastmail.com/' },
            { name: 'Google', url: 'https://apidata.googleusercontent.com/caldav/v2/' },
            { name: 'Nextcloud', url: 'https://your-server.com/remote.php/dav/' }
          ].map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setForm(f => ({ ...f, caldav_url: preset.url }))}
              style={{ background: 'var(--panel-border)', border: 'none', borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <form className="glass-panel" onSubmit={connectAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', padding: '2rem', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>CalDAV URL</label>
            <input className="chat-input" style={{ width: '100%', boxSizing: 'border-box' }} value={form.caldav_url} onChange={e => setForm({...form, caldav_url: e.target.value})} placeholder="https://caldav.example.com/..." required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Username</label>
            <input className="chat-input" style={{ width: '100%', boxSizing: 'border-box' }} value={form.username} onChange={e => setForm({...form, username: e.target.value})} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>App Password</label>
            <input type="password" className="chat-input" style={{ width: '100%', boxSizing: 'border-box' }} value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          </div>
          <button type="submit" className="glass-btn" style={{ marginTop: '1rem', width: '100%' }}>Connect Account</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Calendar</h2>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          <Plus size={16} /> New Event
        </button>
      </div>

      {showAddForm && (
        <form className="glass-panel" onSubmit={handleAddEvent} style={{ padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--panel-border)', marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Add New Event</h3>
          <div>
            <label>Summary (Title)</label>
            <input className="chat-input" value={newEvent.summary} onChange={e => setNewEvent({...newEvent, summary: e.target.value})} required />
          </div>
          <div>
            <label>Description</label>
            <textarea className="chat-input" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} style={{ minHeight: '60px' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label>Start</label>
              <input type="datetime-local" className="chat-input" value={newEvent.start} onChange={e => setNewEvent({...newEvent, start: e.target.value})} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>End</label>
              <input type="datetime-local" className="chat-input" value={newEvent.end} onChange={e => setNewEvent({...newEvent, end: e.target.value})} required />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ background: 'none', border: '1px solid var(--panel-border)', borderRadius: '4px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
            <button type="submit" className="glass-btn">Save Event</button>
          </div>
        </form>
      )}

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Refreshing events...</div>}
      
      {!loading && events.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>No events found in the +/- 30 day window.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {events.map((e, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--panel-border)', borderLeft: '4px solid var(--accent-color)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{e.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: e.description ? '0.75rem' : '0' }}>
              <Clock size={14} />
              {new Date(e.start).toLocaleString()} - {e.end ? new Date(e.end).toLocaleString() : 'N/A'}
            </div>
            {e.description && (
              <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                {e.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
