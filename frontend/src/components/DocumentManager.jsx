import { useState, useEffect } from 'react';
import { Plus, FileText, Trash2, Clock } from 'lucide-react';
import DocumentEditor from './DocumentEditor';
import VersionHistory from './VersionHistory';

export default function DocumentManager({ user }) {
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  
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

  const createDocument = async (docType = 'markdown') => {
    try {
      const res = await fetch('/documents/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Document', doc_type: docType, content: '' })
      });
      const newDoc = await res.json();
      setDocuments([newDoc, ...documents]);
      setActiveDoc(newDoc);
      setShowVersions(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteDocument = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    
    try {
      await fetch(`/documents/${id}`, { method: 'DELETE' });
      setDocuments(documents.filter(d => d.id !== id));
      if (activeDoc?.id === id) {
        setActiveDoc(null);
        setShowVersions(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* Documents Sidebar */}
      <div style={{ width: '280px', borderRight: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>Documents</h3>
          <button 
            onClick={() => createDocument('markdown')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <Plus size={14} /> New
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {documents.map(doc => (
            <div 
              key={doc.id}
              onClick={() => { setActiveDoc(doc); setShowVersions(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                margin: '0.25rem 0',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeDoc?.id === doc.id ? 'var(--user-msg-bg)' : 'transparent',
                transition: 'background 0.2s'
              }}
            >
              <FileText size={16} style={{ color: 'var(--text-secondary)', marginRight: '0.75rem', flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  {doc.updated_at ? new Date(doc.updated_at.endsWith('Z') ? doc.updated_at : doc.updated_at + 'Z').toLocaleDateString() : ''} &middot; {doc.doc_type}
                </div>
              </div>
              
              <button 
                onClick={(e) => deleteDocument(doc.id, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}
                title="Delete document"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          
          {documents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              No documents yet. Click "New" to create one.
            </div>
          )}
        </div>
      </div>
      
      {/* Main Editor Area */}
      <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
        {activeDoc ? (
          <>
            <DocumentEditor 
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
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Select a document from the sidebar or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
