import { useState, useEffect } from 'react';

export default function ResetPasswordView() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
      setErrorMsg('Invalid or missing reset token.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setErrorMsg(data.detail || 'Failed to reset password');
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
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
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>New Password</label>
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
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
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

          <button 
            type="submit" 
            disabled={isLoading || !!successMsg}
            style={{
              width: '100%', padding: '14px', background: 'var(--accent-color)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: (isLoading || successMsg) ? 'not-allowed' : 'pointer',
              fontWeight: '600', fontSize: '1rem', marginTop: '10px', opacity: (isLoading || successMsg) ? 0.7 : 1
            }}
          >
            {isLoading ? 'Saving...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
