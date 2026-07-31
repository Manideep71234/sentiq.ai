import { useState, useEffect } from 'react';
import { Key, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsAPIKeys() {
  const [groqKey, setGroqKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [hasGroq, setHasGroq] = useState(false);
  const [hasOpenRouter, setHasOpenRouter] = useState(false);

  useEffect(() => {
    fetch('/settings/api-keys')
      .then(res => res.json())
      .then(data => {
        setHasGroq(data.has_groq);
        setHasOpenRouter(data.has_openrouter);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await fetch('/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groq_api_key: groqKey || undefined,
          openrouter_api_key: openRouterKey || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: 'API keys validated and saved successfully!' });
        if (groqKey) setHasGroq(true);
        if (openRouterKey) setHasOpenRouter(true);
        setGroqKey('');
        setOpenRouterKey('');
      } else {
        setStatus({ type: 'error', message: data.detail || 'Validation failed. Please check your keys.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="view-container fade-in">
      <div className="view-header">
        <h2><Key className="icon" style={{ marginRight: '8px' }} /> API Keys</h2>
      </div>
      
      <div className="settings-content" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
          Configure your own API keys to bypass rate limits and access premium models on your own billing. Keys are securely stored and validated instantly. Leave a field blank to keep its existing key.
        </p>

        {status.message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            color: status.type === 'error' ? '#ef4444' : '#22c55e',
            border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
          }}>
            {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {status.message}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="input-group">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              Groq API Key
              {hasGroq && <span style={{ color: '#22c55e', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Configured</span>}
            </label>
            <input 
              type="password" 
              placeholder="gsk_..." 
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
            />
            <small style={{ color: 'var(--text-secondary)' }}>Get your free key from console.groq.com</small>
          </div>

          <div className="input-group">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              OpenRouter API Key
              {hasOpenRouter && <span style={{ color: '#22c55e', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> Configured</span>}
            </label>
            <input 
              type="password" 
              placeholder="sk-or-v1-..." 
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
            />
            <small style={{ color: 'var(--text-secondary)' }}>Get your key from openrouter.ai/keys</small>
          </div>

          <button 
            type="submit" 
            disabled={isSaving || (!groqKey && !openRouterKey)}
            className="btn-primary"
            style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (isSaving || (!groqKey && !openRouterKey)) ? 0.5 : 1 }}
          >
            {isSaving ? (
              <>Validating...</>
            ) : (
              <><Save size={18} /> Validate & Save</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
