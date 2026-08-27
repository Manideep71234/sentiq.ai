import { useState, useEffect } from 'react';
import { Plus, FileText, Trash2, FileSpreadsheet, LayoutGrid, X, Sparkles, Loader2, ArrowLeft, Clock } from 'lucide-react';
import DocumentEditor from './DocumentEditor';
import VersionHistory from './VersionHistory';

function DocumentCreationModal({ isOpen, onClose, onCreateBlank, onCreateAI }) {
  const [activeTab, setActiveTab] = useState('blank');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (activeTab === 'blank') {
      onCreateBlank();
    } else {
      if (!prompt.trim()) return;
      setIsGenerating(true);
      setError('');
      try {
        await onCreateAI(prompt);
      } catch (err) {
        setError(err.message || 'Failed to generate document');
      } finally {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)', animation: 'overlayFadeIn 0.2s ease-out' }}>
      <style>{`
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div style={{ background: '#111827', border: '1px solid var(--panel-border)', borderRadius: '12px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'modalFadeIn 0.2s ease-out' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>New Document</h2>
          <button onClick={onClose} disabled={isGenerating} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div onClick={() => !isGenerating && setActiveTab('blank')} style={{ flex: 1, padding: '1rem', border: `2px solid ${activeTab === 'blank' ? 'var(--accent-color)' : 'var(--panel-border)'}`, borderRadius: '8px', cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', background: activeTab === 'blank' ? 'rgba(59, 130, 246, 0.05)' : 'transparent', transition: 'all 0.2s', opacity: isGenerating ? 0.6 : 1 }}>
              <FileText size={32} color={activeTab === 'blank' ? 'var(--accent-color)' : 'var(--text-secondary)'} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Blank Document</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Start fresh with an empty editor</div>
              </div>
            </div>
            <div onClick={() => !isGenerating && setActiveTab('ai')} style={{ flex: 1, padding: '1rem', border: `2px solid ${activeTab === 'ai' ? 'var(--accent-color)' : 'var(--panel-border)'}`, borderRadius: '8px', cursor: isGenerating ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', background: activeTab === 'ai' ? 'rgba(59, 130, 246, 0.05)' : 'transparent', transition: 'all 0.2s', opacity: isGenerating ? 0.6 : 1 }}>
              <Sparkles size={32} color={activeTab === 'ai' ? '#8b5cf6' : 'var(--text-secondary)'} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Create with AI</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Describe what you want to write</div>
              </div>
            </div>
          </div>
          {activeTab === 'ai' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>What should the document be about?</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Write a professional project proposal for a new CRM system..." disabled={isGenerating} style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--panel-border)', background: 'var(--sidebar-bg)', color: 'var(--text-primary)', fontSize: '0.95rem', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
            </div>
          )}
          {error && <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button onClick={onClose} disabled={isGenerating} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: isGenerating ? 'not-allowed' : 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={isGenerating || (activeTab === 'ai' && !prompt.trim())} style={{ padding: '0.5rem 1rem', background: activeTab === 'ai' ? '#8b5cf6' : 'var(--accent-color)', border: 'none', borderRadius: '6px', color: 'white', fontWeight: 500, cursor: (isGenerating || (activeTab === 'ai' && !prompt.trim())) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isGenerating ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : activeTab === 'ai' ? <><Sparkles size={16} /> Generate & Open</> : 'Create Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/documents/');
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      console.error(e);
    }
  };

  const createBlankDocument = async () => {
    try {
      const res = await fetch('/documents/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Document', doc_type: 'html', content: '' })
      });
      const newDoc = await res.json();
      setDocuments(prev => [newDoc, ...prev]);
      setActiveDoc(newDoc);
      setShowVersions(false);
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };
  
  const createAIDocument = async (promptText) => {
    try {
      const res = await fetch('/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      
      if (!res.ok) {
        let err;
        try {
          err = await res.json();
        } catch {
          err = { detail: 'Failed to generate document. Server may have timed out.' };
        }
        throw new Error(err.detail || 'Failed to generate document');
      }
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let currentDoc = null;
      let accumulatedContent = "";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            
            let data;
            try {
              data = JSON.parse(dataStr);
            } catch(e) {
              console.error("Error parsing stream JSON", dataStr, e);
              continue;
            }
            
            if (data.type === 'doc_id') {
              currentDoc = { id: data.id, title: data.title, doc_type: data.doc_type, content: data.content };
              setDocuments(prev => [currentDoc, ...prev]);
              setActiveDoc(currentDoc);
              setIsModalOpen(false); // Close modal so user can see it generating
            } else if (data.type === 'content') {
              accumulatedContent += data.delta;
              if (currentDoc) {
                const updated = { ...currentDoc, content: accumulatedContent };
                currentDoc = updated;
                setActiveDoc(updated);
              }
            } else if (data.type === 'error') {
              throw new Error(data.error);
            } else if (data.type === 'done') {
              fetchDocuments(); // refresh list in background
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      throw e; // Rethrow so modal can catch it if it's still open
    }
  };

  const deleteDocument = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    
    try {
      await fetch(`/documents/${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
      if (activeDoc?.id === id) {
        setActiveDoc(null);
        setShowVersions(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // If a document is active, show the fullscreen editor
  if (activeDoc) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', background: 'var(--panel-bg)' }}>
          <button 
            onClick={() => { setActiveDoc(null); fetchDocuments(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px' }}
          >
            <ArrowLeft size={16} /> Back to Documents
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
          <DocumentEditor 
            key={activeDoc.id}
            doc={activeDoc} 
            onUpdate={(updatedDoc) => {
              setActiveDoc(updatedDoc);
              setDocuments(documents.map(d => d.id === updatedDoc.id ? updatedDoc : d));
            }}
            onToggleVersions={() => setShowVersions(!showVersions)}
          />
          {showVersions && (
            <VersionHistory 
              doc={activeDoc} 
              onClose={() => setShowVersions(false)}
              onRestore={(restoredDoc) => {
                setActiveDoc(restoredDoc);
                setDocuments(documents.map(d => d.id === restoredDoc.id ? restoredDoc : d));
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // List View
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden', padding: '2rem', background: 'var(--main-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', maxWidth: '1200px', margin: '0 auto 2rem auto', width: '100%' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LayoutGrid size={24} style={{ color: 'var(--accent-color)' }} />
          Documents
        </h1>
        <button 
          onClick={() => setIsModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500, boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}
        >
          <Plus size={18} /> New Document
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {documents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <FileText size={40} color="var(--accent-color)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Create your first document</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', textAlign: 'center' }}>
              Start writing beautifully formatted documents or use AI to instantly generate content for you.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: 500 }}
            >
              <Plus size={18} /> Create Document
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {documents.map(doc => (
              <div 
                key={doc.id}
                onClick={() => { setActiveDoc(doc); setShowVersions(false); }}
                style={{
                  background: 'var(--panel-bg)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  height: '160px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 15px rgba(0,0,0,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
                    {doc.doc_type === 'csv' ? <FileSpreadsheet size={24} color="#10b981" /> : <FileText size={24} color="var(--accent-color)" />}
                  </div>
                  <button 
                    onClick={(e) => deleteDocument(doc.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem', borderRadius: '4px' }}
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {doc.title}
                </h3>
                <div style={{ marginTop: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={14} />
                  {doc.updated_at ? new Date(doc.updated_at.endsWith('Z') ? doc.updated_at : doc.updated_at + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentCreationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreateBlank={createBlankDocument}
        onCreateAI={createAIDocument}
      />
    </div>
  );
}
