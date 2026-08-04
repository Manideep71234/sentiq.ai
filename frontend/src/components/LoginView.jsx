import { useState, useEffect } from 'react';

export default function LoginView() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Load SimpleWebAuthn dynamically
  useEffect(() => {
    if (!window.SimpleWebAuthnBrowser) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js';
      document.head.appendChild(script);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        const data = await res.json();
        setErrorMsg(data.detail || 'Login failed');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password) {
      setErrorMsg('Please fill in both fields to sign up.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
      } else {
        setErrorMsg(data.detail || 'Registration failed');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const passkeyLogin = async () => {
    setErrorMsg('');
    try {
      if (!window.SimpleWebAuthnBrowser) throw new Error("WebAuthn not loaded");
      const { startAuthentication } = window.SimpleWebAuthnBrowser;
      const res = await fetch('/auth/webauthn/login/options');
      if (!res.ok) throw new Error('Failed to get login options');
      const options = await res.json();
      
      const asseResp = await startAuthentication(options);
      
      const verifyRes = await fetch('/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: options.challenge_id,
          data: asseResp
        }),
      });
      
      if (verifyRes.ok) {
        window.location.href = '/';
      } else {
        const err = await verifyRes.json();
        setErrorMsg(`Passkey login failed: ${err.detail}`);
      }
    } catch (error) {
      if (error.name !== 'NotAllowedError') {
        setErrorMsg('Passkey authentication failed or was cancelled.');
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-gradient)',
      color: 'var(--text-primary)',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <div className="glass-panel" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '40px 30px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          Sentiq<span style={{ color: 'var(--accent-color)' }}>.AI</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>
          Sign in to your intelligent workspace.
        </p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email address</label>
            <input 
              type="text" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)',
                color: 'var(--text-primary)', outline: 'none'
              }}
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)',
                color: 'var(--text-primary)', outline: 'none'
              }}
              required 
            />
          </div>

          {errorMsg && <div style={{ color: '#dc2626', background: 'rgba(220,38,38,0.1)', padding: '10px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>{errorMsg}</div>}
          {successMsg && <div style={{ color: '#059669', background: 'rgba(5,150,105,0.1)', padding: '10px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>{successMsg}</div>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button type="submit" disabled={isLoading} className="glass-btn" style={{ flex: 1, padding: '12px' }}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            <button type="button" disabled={isLoading} onClick={handleRegister} className="glass-btn" style={{ flex: 1, padding: '12px', background: 'var(--sidebar-hover)' }}>
              Sign Up
            </button>
          </div>
        </form>

        <div style={{ margin: '25px 0', borderBottom: '1px solid var(--panel-border)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: 'var(--panel-bg)', padding: '0 10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OR</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => window.location.href='/auth/google/login'} className="glass-btn" style={{ background: 'var(--system-msg-bg)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ fill: 'currentColor' }}>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <button onClick={passkeyLogin} className="glass-btn" style={{ background: 'var(--system-msg-bg)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 7c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V9zm3 8c-1.103 0-2-.897-2-2s.897-2 2-2 2 .897 2 2-.897 2-2 2z" fill="currentColor"/></svg>
            Continue with Passkey
          </button>
        </div>
      </div>
    </div>
  );
}
