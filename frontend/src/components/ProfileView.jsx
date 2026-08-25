import { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Lock, Mail, Key, Image as ImageIcon, CheckCircle2, AlertCircle, TrendingUp, KeyRound } from 'lucide-react';

export default function ProfileView({ user, setUser, setActiveView }) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePic, setProfilePic] = useState(user?.profile_pic || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [status, setStatus] = useState({ type: '', message: '' });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [usage, setUsage] = useState(null);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/auth/usage').then(res => res.json()).then(data => setUsage(data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setUsername(user.username || '');
      setEmail(user.email || '');
      setProfilePic(user.profile_pic || '');
    }
  }, [user]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Image must be less than 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setProfilePic(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setStatus({ type: '', message: '' });

    try {
      const res = await fetch('/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          profile_pic: profilePic
        })
      });

      let ok = true;
      if (!res.ok) {
        ok = false;
        const data = await res.json();
        setStatus({ type: 'error', message: data.detail || 'Failed to update profile' });
      }

      // Also update account details if changed
      if (username !== user.username || email !== user.email) {
        const accRes = await fetch('/auth/me/account', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username,
            email: email
          })
        });
        
        if (!accRes.ok) {
          ok = false;
          const accData = await accRes.json();
          setStatus({ type: 'error', message: accData.detail || 'Failed to update account details' });
        }
      }

      if (ok) {
        setStatus({ type: 'success', message: 'Profile updated successfully!' });
        setUser({ ...user, full_name: fullName, username: username, email: email, profile_pic: profilePic });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', message: '' });
    
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    
    setIsSavingPassword(true);
    try {
      const res = await fetch('/auth/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      
      if (res.ok) {
        setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setPasswordStatus({ type: 'error', message: data.detail || 'Failed to update password' });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', message: 'Network error occurred.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you SURE you want to delete your account? This action is permanent and cannot be undone.")) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch('/auth/me', {
        method: 'DELETE',
      });
      if (res.ok) {
        window.location.href = '/login';
      } else {
        const data = await res.json();
        setStatus({ type: 'error', message: data.detail || 'Failed to delete account' });
        setIsDeleting(false);
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error occurred.' });
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (err) {}
    window.location.href = '/login';
  };

  return (
    <div className="view-container fade-in" style={{ overflowY: 'auto' }}>
      <div className="view-header">
        <h2><UserIcon className="icon" style={{ marginRight: '8px' }} /> Profile Settings</h2>
      </div>
      
      <div className="settings-content" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Profile Info Section */}
        {usage && (
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} className="text-indigo-400" /> Usage & Cost Estimate
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div style={{ background: 'var(--system-msg-bg)', padding: '16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Tokens</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{usage.total_tokens.toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--system-msg-bg)', padding: '16px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimated Cost</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>${usage.total_cost.toFixed(4)}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ 
          background: 'var(--panel-bg)', 
          border: '1px solid var(--panel-border)', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>General Info</h3>
          {status.message && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', marginBottom: '24px',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              color: status.type === 'error' ? '#ef4444' : '#22c55e',
              border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
            }}>
              {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              {status.message}
            </div>
          )}

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div 
                style={{ 
                  width: '120px', height: '120px', borderRadius: '50%', 
                  background: 'var(--system-msg-bg)', border: '2px dashed var(--panel-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative', cursor: 'pointer'
                }}
                onClick={() => fileInputRef.current?.click()}
                onMouseOver={(e) => {
                  const overlay = e.currentTarget.querySelector('.pfp-overlay');
                  if(overlay) overlay.style.opacity = '1';
                }}
                onMouseOut={(e) => {
                  const overlay = e.currentTarget.querySelector('.pfp-overlay');
                  if(overlay) overlay.style.opacity = profilePic ? '0' : '1';
                }}
              >
                {profilePic ? (
                  <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Camera size={32} style={{ color: 'var(--text-secondary)' }} />
                )}
                <div className="pfp-overlay" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '12px', textAlign: 'center', padding: '4px 0', opacity: profilePic ? 0 : 1, transition: 'opacity 0.2s' }}>
                  Change
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '600' }}>{user?.username}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click to update photo</div>
              </div>
            </div>

            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Full Name</label>
              <input type="text" placeholder="Enter your name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Username</label>
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Email</label>
              <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            <button type="submit" disabled={isSaving} style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.5 : 1, background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', cursor: isSaving ? 'default' : 'pointer', fontWeight: '600' }}>
              {isSaving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-subtle)' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}><Key size={18} style={{ display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '8px' }} />Change Password</h3>
          
          {passwordStatus.message && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', background: passwordStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: passwordStatus.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${passwordStatus.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}` }}>
              {passwordStatus.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              {passwordStatus.message}
            </div>
          )}

          <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Current Password</label>
              <input type="password" required placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>New Password</label>
              <input type="password" required placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Confirm Password</label>
              <input type="password" required placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '12px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }} />
            </div>

            <button type="submit" disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword} style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (isSavingPassword || !currentPassword || !newPassword || !confirmPassword) ? 0.5 : 1, background: 'var(--panel-border)', color: 'var(--text-primary)', border: 'none', borderRadius: '8px', padding: '12px', cursor: (isSavingPassword || !currentPassword || !newPassword || !confirmPassword) ? 'default' : 'pointer', fontWeight: '600' }}>
              {isSavingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Data Management Section */}
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-subtle)' }}>
          <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Data Management</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>Download a complete copy of your data including chats, documents, and notes.</p>
          
          <button 
            onClick={() => window.location.href='/settings/export-data'}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--system-msg-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--panel-border)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--system-msg-bg)' }}
          >
            <Save size={18} /> Export My Data
          </button>
        </div>

        {/* Danger Zone */}
        <div style={{ background: 'var(--panel-bg)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '32px', boxShadow: 'var(--shadow-subtle)' }}>
          <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>Danger Zone</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>Once you delete your account, there is no going back. Please be certain.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              onClick={handleLogout}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--system-msg-bg)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <LogOut size={18} /> Logout
            </button>
            
            <button 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px', cursor: isDeleting ? 'default' : 'pointer', fontWeight: '600', transition: 'all 0.2s', opacity: isDeleting ? 0.5 : 1 }}
              onMouseOver={(e) => { if(!isDeleting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
              onMouseOut={(e) => { if(!isDeleting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
            >
              <Trash2 size={18} /> {isDeleting ? 'Deleting Account...' : 'Delete Account'}
            </button>
          </div>
        </div>
        
        {/* API Keys Shortcut */}
        <div style={{ 
          background: 'var(--panel-bg)', 
          border: '1px solid var(--panel-border)', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Integrations</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
            Configure your API keys to unlock dynamic models from Groq, OpenRouter, and Google Gemini.
          </p>
          <button 
            type="button"
            onClick={() => setActiveView('api-keys')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', background: 'var(--bg-accent-muted)', color: 'var(--accent-color)', 
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: 'background 0.2s' 
            }}>
            <KeyRound size={18} />
            Manage API Keys
          </button>
        </div>

        {/* Extra spacing at bottom */}
        <div style={{ height: '32px' }}></div>
      </div>
    </div>
  );
}
