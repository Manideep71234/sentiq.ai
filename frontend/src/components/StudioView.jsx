import { useState } from 'react';
import { Volume2, Image as ImageIcon, Download, Play, Loader2 } from 'lucide-react';

export default function StudioView() {
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState('en-US-AriaNeural');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [ttsError, setTtsError] = useState('');

  const [imgPrompt, setImgPrompt] = useState('');
  const [imgAspectRatio, setImgAspectRatio] = useState('1024x1024');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  
  const voices = [
    { value: 'en-US-AriaNeural', label: 'Aria (Female, US)' },
    { value: 'en-US-GuyNeural', label: 'Guy (Male, US)' },
    { value: 'en-GB-SoniaNeural', label: 'Sonia (Female, UK)' },
    { value: 'en-GB-RyanNeural', label: 'Ryan (Male, UK)' },
    { value: 'fr-FR-DeniseNeural', label: 'Denise (Female, FR)' },
    { value: 'fr-FR-HenriNeural', label: 'Henri (Male, FR)' }
  ];

  const aspectRatios = [
    { value: '1024x1024', label: 'Square (1:1)' },
    { value: '1920x1080', label: 'Landscape (16:9)' },
    { value: '1080x1920', label: 'Portrait (9:16)' }
  ];

  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setTtsLoading(true);
    setTtsError('');
    setAudioUrl('');
    try {
      const res = await fetch('/studio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice })
      });
      const data = await res.json();
      if (res.ok) {
        setAudioUrl(data.url + "?t=" + Date.now()); // Prevent caching
      } else {
        setTtsError(data.detail || 'Failed to generate audio');
      }
    } catch (err) {
      setTtsError('Network error occurred.');
    } finally {
      setTtsLoading(false);
    }
  };

  const handleGenerateImage = () => {
    if (!imgPrompt.trim()) return;
    setImgLoading(true);
    
    const [width, height] = imgAspectRatio.split('x');
    const seed = Math.floor(Math.random() * 100000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
    
    // Preload image to show loader until it's ready
    const img = new Image();
    img.onload = () => {
      setImgUrl(url);
      setImgLoading(false);
    };
    img.onerror = () => {
      setImgLoading(false);
      alert('Failed to load image. Please try again.');
    };
    img.src = url;
  };

  const downloadImage = async () => {
    if (!imgUrl) return;
    try {
      const res = await fetch(imgUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `sentiq_image_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  return (
    <div className="view-container fade-in" style={{ overflowY: 'auto' }}>
      <div className="view-header">
        <h2>Studio</h2>
      </div>
      
      <div className="settings-content" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Text-to-Speech Panel */}
        <div style={{ flex: '1 1 400px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-subtle)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
            <Volume2 size={24} style={{ color: 'var(--accent-color)' }} /> Text-to-Speech
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Convert text into natural-sounding speech using Edge-TTS.
          </p>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Voice</label>
            <select 
              value={ttsVoice} 
              onChange={e => setTtsVoice(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', outline: 'none' }}
            >
              {voices.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          
          <div style={{ marginBottom: '16px', flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Text</label>
            <textarea 
              value={ttsText}
              onChange={e => setTtsText(e.target.value)}
              placeholder="Enter text to speak..."
              style={{ width: '100%', height: '150px', padding: '12px', borderRadius: '8px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
            />
          </div>

          {ttsError && <div style={{ color: '#ef4444', marginBottom: '16px', fontSize: '0.9rem' }}>{ttsError}</div>}

          <button 
            onClick={handleGenerateTTS} 
            disabled={ttsLoading || !ttsText.trim()}
            style={{ width: '100%', padding: '14px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: (ttsLoading || !ttsText.trim()) ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (ttsLoading || !ttsText.trim()) ? 0.7 : 1 }}
          >
            {ttsLoading ? <Loader2 size={18} className="spin" /> : <Play size={18} />} 
            {ttsLoading ? 'Generating...' : 'Generate Audio'}
          </button>
          
          {audioUrl && (
            <div style={{ marginTop: '24px', padding: '16px', background: 'var(--system-msg-bg)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <audio controls src={audioUrl} style={{ width: '100%' }} autoPlay />
            </div>
          )}
        </div>

        {/* Image Generation Panel */}
        <div style={{ flex: '1 1 400px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-subtle)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
            <ImageIcon size={24} style={{ color: 'var(--accent-color)' }} /> Image Generation
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem' }}>
            Generate high-quality images from text using Pollinations.ai.
          </p>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Aspect Ratio</label>
            <select 
              value={imgAspectRatio} 
              onChange={e => setImgAspectRatio(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', outline: 'none' }}
            >
              {aspectRatios.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Prompt</label>
            <textarea 
              value={imgPrompt}
              onChange={e => setImgPrompt(e.target.value)}
              placeholder="Describe the image you want to see..."
              style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', background: 'var(--system-msg-bg)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
            />
          </div>

          <button 
            onClick={handleGenerateImage} 
            disabled={imgLoading || !imgPrompt.trim()}
            style={{ width: '100%', padding: '14px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: (imgLoading || !imgPrompt.trim()) ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: (imgLoading || !imgPrompt.trim()) ? 0.7 : 1 }}
          >
            {imgLoading ? <Loader2 size={18} className="spin" /> : <ImageIcon size={18} />} 
            {imgLoading ? 'Generating...' : 'Generate Image'}
          </button>
          
          {imgLoading && !imgUrl && (
            <div style={{ marginTop: '24px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--system-msg-bg)', borderRadius: '8px', border: '1px dashed var(--panel-border)' }}>
              <Loader2 size={32} className="spin" style={{ color: 'var(--accent-color)' }} />
            </div>
          )}
          
          {imgUrl && !imgLoading && (
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--panel-border)', background: 'var(--system-msg-bg)' }}>
                <img src={imgUrl} alt="Generated" style={{ width: '100%', display: 'block' }} />
              </div>
              <button 
                onClick={downloadImage}
                style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              >
                <Download size={18} /> Download Image
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
