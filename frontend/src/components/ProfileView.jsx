import { useState, useEffect, useRef } from 'react';
import { User as UserIcon, Lock, Mail, Key, Image as ImageIcon, CheckCircle2, AlertCircle, TrendingUp, KeyRound, LogOut, Camera, Save, Trash2 } from 'lucide-react';

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
    <div className="view-container fade-in">
      <div className="settings-content" style={{ margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '850px', width: '100%' }}>
        
        {/* Modern Profile Header Card */}
        <div style={{
          background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-subtle)',
          position: 'relative'
        }}>
          {/* Cover Banner (gradient) */}
          <div style={{
            height: '160px',
            background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
            position: 'relative'
          }}>
          </div>
          
          {/* Avatar & Info */}
          <div style={{ padding: '0 32px 32px 32px', position: 'relative', marginTop: '-60px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              {/* Profile Image Wrapper */}
              <div 
                style={{ 
                  width: '120px', height: '120px', borderRadius: '50%', 
                  background: 'var(--panel-bg)', padding: '4px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  position: 'relative', cursor: 'pointer',
                  zIndex: 2
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
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--system-msg-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {profilePic ? (
                    <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Camera size={32} style={{ color: 'var(--text-secondary)' }} />
                  )}
                  <div className="pfp-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: profilePic ? 0 : 1, transition: 'opacity 0.2s' }}>
                     <Camera size={24} color="white" />
                  </div>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
              
              {/* Name and Username */}
              <h2 style={{ margin: '16px 0 4px 0', fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {fullName || user?.username || 'User'}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '15px' }}>
                {email || 'No email provided'}
              </p>
            </div>
            
            {/* Stats / Usage integration horizontally */}
            {usage && (
              <div style={{ 
                display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '32px', 
                paddingTop: '24px', borderTop: '1px solid var(--panel-border)' 
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {usage.total_tokens.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                    Total Tokens
                  </div>
                </div>
                
                {/* Divider */}
                <div style={{ width: '1px', background: 'var(--panel-border)' }}></div>
                
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    ${usage.total_cost.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                    Estimated Cost
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flex container for the forms layout (2 columns on large screens) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          
          {/* General Info Card */}
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-subtle)' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserIcon size={18} className="text-indigo-400" /> Personal Information
            </h3>
            
            {status.message && (
              <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', background: status.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: status.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${status.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}` }}>
                {status.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                {status.message}
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Full Name</label>
                <input type="text" placeholder="Enter your name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }} />
              </div>

              <div className="input-group">
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Username</label>
                <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }} />
              </div>

              <div className="input-group">
                <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Email Address</label>
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', transition: 'border-color 0.2s' }} />
              </div>

              <button type="submit" disabled={isSaving} style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.7 : 1, background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '12px', padding: '14px', cursor: isSaving ? 'default' : 'pointer', fontWeight: '600', transition: 'all 0.2s', boxShadow: isSaving ? 'none' : '0 4px 12px rgba(99,102,241,0.2)' }}>
                {isSaving ? 'Saving...' : <><Save size={18} /> Update Profile</>}
              </button>
            </form>
          </div>

          {/* Security Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-subtle)', flex: 1 }}>
              <h3 style={{ marginBottom: '24px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} className="text-indigo-400" /> Security
              </h3>
              
              {passwordStatus.message && (
                <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', background: passwordStatus.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: passwordStatus.type === 'error' ? '#ef4444' : '#22c55e', border: `1px solid ${passwordStatus.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}` }}>
                  {passwordStatus.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                  {passwordStatus.message}
                </div>
              )}

              <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Current Password</label>
                  <input type="password" required placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>New Password</label>
                  <input type="password" required placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
                <div className="input-group">
                  <label style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Confirm Password</label>
                  <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>

                <button type="submit" disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword} style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (isSavingPassword || !currentPassword || !newPassword || !confirmPassword) ? 0.5 : 1, background: 'var(--panel-border)', color: 'var(--text-primary)', border: 'none', borderRadius: '12px', padding: '14px', cursor: (isSavingPassword || !currentPassword || !newPassword || !confirmPassword) ? 'default' : 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>
                  {isSavingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Data & Danger Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          
          <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> Data Export
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5, flex: 1 }}>
              Download a complete archive of your chat history, documents, and settings.
            </p>
            <button 
              onClick={() => window.location.href='/settings/export-data'}
              style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--system-msg-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '14px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--panel-border)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--system-msg-bg)' }}
            >
              Export Archive
            </button>
          </div>
          
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '24px', padding: '32px', boxShadow: 'var(--shadow-subtle)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> Danger Zone
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5, flex: 1 }}>
              Logout of your current session or permanently delete your account and data.
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                onClick={handleLogout}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'var(--panel-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '12px', padding: '14px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--system-msg-bg)' }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--panel-bg)' }}
              >
                <LogOut size={16} /> Logout
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', borderRadius: '12px', padding: '14px', cursor: isDeleting ? 'default' : 'pointer', fontWeight: '600', transition: 'all 0.2s', opacity: isDeleting ? 0.5 : 1 }}
                onMouseOver={(e) => { if(!isDeleting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
                onMouseOut={(e) => { if(!isDeleting) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
              >
                <Trash2 size={16} /> {isDeleting ? '...' : 'Delete'}
              </button>
            </div>
          </div>
          
        </div>

        {/* Extra spacing at bottom */}
        <div style={{ height: '32px' }}></div>
      </div>
    </div>
  );
}
