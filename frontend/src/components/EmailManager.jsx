import { useState, useEffect } from 'react';
import { Mail, Settings, RefreshCw, Wand2, Send, Tag, ChevronDown } from 'lucide-react';

export default function EmailManager({ user }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Connection form state
  const [form, setForm] = useState({
    imap_host: 'imap.gmail.com', imap_port: 993,
    smtp_host: 'smtp.gmail.com', smtp_port: 587,
    username: '', password: ''
  });

  useEffect(() => {
    checkAccount();
  }, []);

  const checkAccount = async () => {
    try {
      const res = await fetch('/email/account');
      const data = await res.json();
      if (data) {
        setAccount(data);
        fetchInbox();
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
      await fetch('/email/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      // Clear password immediately for security
      setForm(prev => ({...prev, password: ''}));
      await checkAccount();
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await fetch('/email/inbox');
      const data = await res.json();
      setThreads(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (thread) => {
    setIsProcessing(true);
    try {
      const content = thread.messages.map(m => `From: ${m.sender}\n${m.content}`).join("\n\n");
      const res = await fetch(`/email/thread/${thread.thread_id}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_content: content })
      });
      const data = await res.json();
      const newThreads = threads.map(t => t.thread_id === thread.thread_id ? { ...t, summary: data.summary } : t);
      setThreads(newThreads);
      if (activeThread && activeThread.thread_id === thread.thread_id) {
        setActiveThread({ ...activeThread, summary: data.summary });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateTriage = async (thread) => {
    setIsProcessing(true);
    try {
      const content = thread.messages.map(m => `From: ${m.sender}\n${m.content}`).join("\n\n");
      const res = await fetch(`/email/thread/${thread.thread_id}/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_content: content })
      });
      const data = await res.json();
      const newThreads = threads.map(t => t.thread_id === thread.thread_id ? { ...t, triage_tag: data.triage_tag } : t);
      setThreads(newThreads);
      if (activeThread && activeThread.thread_id === thread.thread_id) {
        setActiveThread({ ...activeThread, triage_tag: data.triage_tag });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateDraft = async (instruction) => {
    if (!activeThread) return;
    setIsProcessing(true);
    try {
      const content = activeThread.messages.map(m => `From: ${m.sender}\n${m.content}`).join("\n\n");
      const res = await fetch(`/email/thread/${activeThread.thread_id}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_content: content, instruction })
      });
      const data = await res.json();
      setDraft(data.draft);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendEmail = async () => {
    if (!draft || !activeThread) return;
    setIsProcessing(true);
    try {
      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      await fetch('/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_addr: lastMsg.sender,
          subject: `Re: ${activeThread.subject}`,
          body: draft,
          in_reply_to: lastMsg.message_id
        })
      });
      alert('Email sent successfully!');
      setDraft('');
    } catch (e) {
      console.error(e);
      alert('Failed to send email.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !account) {
    return <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '10px' }}><RefreshCw className="spin" size={18}/> Loading configuration...</div>;
  }

  if (!account) {
    return (
      <div style={{ padding: '3rem 2rem', maxWidth: '480px', margin: '0 auto', width: '100%' }}>
        <div className="glass-panel">
            <h2 style={{ marginBottom: '0.5rem' }}>Connect Email</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Securely connect your email account to chat with your inbox.</p>
            
            <a 
              href="/email/auth/google/login"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', cursor: 'pointer', padding: '1rem', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 500, transition: 'background 0.2s, box-shadow 0.2s', textDecoration: 'none', marginBottom: '1.5rem', boxShadow: 'var(--shadow-subtle)' }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--panel-bg)'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </a>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
                {showAdvanced ? 'Hide Advanced Settings' : 'Connect manually via IMAP/SMTP'}
              </button>
            </div>

            {showAdvanced && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  {[
                    { name: 'Outlook', imap: 'outlook.office365.com', smtp: 'smtp-mail.outlook.com' },
                    { name: 'iCloud', imap: 'imap.mail.me.com', smtp: 'smtp.mail.me.com' },
                    { name: 'Yahoo', imap: 'imap.mail.yahoo.com', smtp: 'smtp.mail.yahoo.com' }
                  ].map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      className="preset-btn"
                      onClick={() => setForm(f => ({ ...f, imap_host: preset.imap, smtp_host: preset.smtp }))}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                
                <form onSubmit={connectAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>IMAP Host</label>
                        <input className="chat-input" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--panel-border)', borderRadius: '8px', background: 'transparent', color: 'var(--text-primary)' }} value={form.imap_host} onChange={e => setForm({...form, imap_host: e.target.value})} required />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>SMTP Host</label>
                        <input className="chat-input" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--panel-border)', borderRadius: '8px', background: 'transparent', color: 'var(--text-primary)' }} value={form.smtp_host} onChange={e => setForm({...form, smtp_host: e.target.value})} required />
                      </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Email Address</label>
                    <input type="email" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--panel-border)', borderRadius: '8px', outline: 'none', transition: 'border-color 0.2s', background: 'transparent', color: 'var(--text-primary)' }} value={form.username} onChange={e => setForm({...form, username: e.target.value})} onFocus={e => e.target.style.borderColor = 'var(--accent-color)'} onBlur={e => e.target.style.borderColor = 'var(--panel-border)'} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>App Password</label>
                    <input type="password" style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--panel-border)', borderRadius: '8px', outline: 'none', transition: 'border-color 0.2s', background: 'transparent', color: 'var(--text-primary)' }} value={form.password} onChange={e => setForm({...form, password: e.target.value})} onFocus={e => e.target.style.borderColor = 'var(--accent-color)'} onBlur={e => e.target.style.borderColor = 'var(--panel-border)'} required />
                  </div>
                  
                  <button type="submit" disabled={loading} className="glass-btn">
                    {loading ? 'Connecting securely...' : 'Connect Account'}
                  </button>
                </form>
              </>
            )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }} className="animate-pop-in">
      {/* Inbox Sidebar */}
      <div style={{ width: '340px', borderRight: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Inbox</h3>
          <button 
            onClick={fetchInbox}
            disabled={loading}
            style={{ background: 'var(--sidebar-hover)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {threads.map(t => (
            <div 
              key={t.thread_id}
              onClick={() => { setActiveThread(t); setDraft(''); }}
              style={{
                padding: '1rem',
                margin: '0.25rem 0',
                borderRadius: '12px',
                cursor: 'pointer',
                background: activeThread?.thread_id === t.thread_id ? 'var(--user-msg-bg)' : 'transparent',
                boxShadow: activeThread?.thread_id === t.thread_id ? 'var(--shadow-subtle)' : 'none',
                border: activeThread?.thread_id === t.thread_id ? '1px solid var(--accent-color)' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={e => {
                  if (activeThread?.thread_id !== t.thread_id) e.currentTarget.style.background = 'var(--sidebar-hover)';
              }}
              onMouseOut={e => {
                  if (activeThread?.thread_id !== t.thread_id) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                  {t.sender.split('@')[0]}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                  {t.date ? new Date(t.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) : ''}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.subject}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4 }}>
                {t.snippet}
              </div>
              {t.triage_tag && (
                <div style={{ marginTop: '0.75rem' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '12px',
                    fontWeight: 500,
                    background: t.triage_tag.includes('Reply') ? 'rgba(239, 68, 68, 0.2)' : t.triage_tag.includes('FYI') ? 'rgba(59, 130, 246, 0.2)' : 'var(--sidebar-hover)',
                    color: t.triage_tag.includes('Reply') ? '#ef4444' : t.triage_tag.includes('FYI') ? '#3b82f6' : 'var(--text-secondary)'
                  }}>
                    {t.triage_tag}
                  </span>
                </div>
              )}
            </div>
          ))}
          {threads.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <Mail size={32} style={{ opacity: 0.3, margin: '0 auto 1rem auto', display: 'block' }}/>
              Inbox is empty.
            </div>
          )}
        </div>
      </div>
      
      {/* Thread View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'transparent' }}>
        {activeThread ? (
          <>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--panel-border)', background: 'transparent' }}>
              <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', lineHeight: 1.3 }}>{activeThread.subject}</h2>
              
              {/* AI Features Bar */}
              <div style={{ display: 'flex', gap: '1.5rem', background: 'var(--panel-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Wand2 size={14} /> AI SUMMARY
                  </div>
                  {activeThread.summary ? (
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>{activeThread.summary}</div>
                  ) : (
                    <button onClick={() => generateSummary(activeThread)} disabled={isProcessing} className="preset-btn">Generate Summary</button>
                  )}
                </div>
                <div style={{ width: '180px', borderLeft: '1px solid var(--panel-border)', paddingLeft: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-color)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Tag size={14} /> TRIAGE
                  </div>
                  {activeThread.triage_tag ? (
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{activeThread.triage_tag}</div>
                  ) : (
                    <button onClick={() => generateTriage(activeThread)} disabled={isProcessing} className="preset-btn">Auto-Triage</button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
              {activeThread.messages.map((m, i) => (
                <div key={i} style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: i < activeThread.messages.length - 1 ? '1px solid var(--panel-border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {m.sender.charAt(0).toUpperCase()}
                        </div>
                        <strong style={{ fontSize: '0.95rem' }}>{m.sender}</strong>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {m.date ? new Date(m.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                    </span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)', marginLeft: '46px' }}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Compose Area */}
            <div style={{ padding: '1.5rem 2rem', background: 'var(--panel-bg)', borderTop: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <button onClick={() => generateDraft("Write a polite, agreeable reply.")} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--sidebar-hover)', border: 'none', borderRadius: '20px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s', color: 'var(--text-primary)' }} onMouseOver={e=>e.currentTarget.style.background='#e2e0db'} onMouseOut={e=>e.currentTarget.style.background='var(--sidebar-hover)'}><Wand2 size={14}/> Draft Polite Reply</button>
                <button onClick={() => generateDraft("Write a short, professional declining reply.")} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--sidebar-hover)', border: 'none', borderRadius: '20px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'background 0.2s', color: 'var(--text-primary)' }} onMouseOver={e=>e.currentTarget.style.background='#e2e0db'} onMouseOut={e=>e.currentTarget.style.background='var(--sidebar-hover)'}><Wand2 size={14}/> Draft Decline</button>
              </div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s' }} onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-color)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                  <textarea 
                    style={{ minHeight: '120px', width: '100%', border: 'none', resize: 'vertical', padding: '1rem', outline: 'none', fontSize: '0.95rem', fontFamily: 'inherit' }}
                    placeholder="Write a reply..."
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1rem', background: 'var(--sidebar-hover)', borderTop: '1px solid var(--panel-border)' }}>
                    <button 
                      onClick={sendEmail}
                      disabled={!draft || isProcessing}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontWeight: 500, cursor: draft ? 'pointer' : 'not-allowed', opacity: draft ? 1 : 0.5, transition: 'all 0.2s' }}
                    >
                      <Send size={16} /> Send
                    </button>
                  </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <Mail size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '1.1rem' }}>Select a thread to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
