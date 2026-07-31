import { useState, useEffect, useRef } from 'react';
import { User, LogOut, Camera, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ProfileView({ user, setUser }) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [profilePic, setProfilePic] = useState(user?.profile_pic || '');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setProfilePic(user.profile_pic || '');
    }
  }, [user]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Image must be less than 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      // Create an image to resize it (optional but recommended for base64)
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

  const handleSave = async (e) => {
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

      if (res.ok) {
        setStatus({ type: 'success', message: 'Profile updated successfully!' });
        setUser({ ...user, full_name: fullName, profile_pic: profilePic });
      } else {
        const data = await res.json();
        setStatus({ type: 'error', message: data.detail || 'Failed to update profile' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error occurred.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    }
    window.location.href = '/login';
  };

  return (
    <div className="view-container fade-in">
      <div className="view-header">
        <h2><User className="icon" style={{ marginRight: '8px' }} /> Profile settings</h2>
      </div>
      
      <div className="settings-content" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
        <div style={{ 
          background: 'var(--panel-bg)', 
          border: '1px solid var(--panel-border)', 
          borderRadius: '16px', 
          padding: '32px',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          
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

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Profile Picture Upload */}
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
                <div 
                  className="pfp-overlay"
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)',
                    color: 'white', fontSize: '12px', textAlign: 'center', padding: '4px 0', opacity: profilePic ? 0 : 1,
                    transition: 'opacity 0.2s'
                  }}
                >
                  Change
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '600' }}>{user?.username}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click to update photo</div>
              </div>
            </div>

            <div className="input-group">
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                Full Name
              </label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ 
                  width: '100%', padding: '12px', background: 'var(--system-msg-bg)', 
                  border: '1px solid var(--panel-border)', borderRadius: '8px', 
                  color: 'var(--text-primary)', outline: 'none' 
                }}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSaving}
              style={{ 
                marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', 
                opacity: isSaving ? 0.5 : 1,
                background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', padding: '12px',
                cursor: isSaving ? 'default' : 'pointer', fontWeight: '600'
              }}
            >
              {isSaving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
            </button>
          </form>

          <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--panel-border)' }}>
            <button 
              onClick={handleLogout}
              style={{ 
                width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', 
                background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: '8px', padding: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)' }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
            >
              <LogOut size={18} /> Logout
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
