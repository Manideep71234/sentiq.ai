import { useState, useEffect, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Clock, Save, Type, FileSpreadsheet, Code } from 'lucide-react';
import AIFloatingToolbar from './AIFloatingToolbar';
import CSVGridEditor from './CSVGridEditor';

export default function DocumentEditor({ doc, onUpdate, onToggleVersions }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [docType, setDocType] = useState(doc.doc_type);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(doc.updated_at);
  const editorRef = useRef(null);
  
  // Update state when active doc changes
  useEffect(() => {
    setTitle(doc.title);
    setContent(doc.content);
    setDocType(doc.doc_type);
    setLastSaved(doc.updated_at);
    if (editorRef.current && doc.doc_type !== 'csv') {
      editorRef.current.innerHTML = DOMPurify.sanitize(doc.content);
    }
  }, [doc.id]);

  const saveDocument = useCallback(async (newContent = content, newTitle = title, newType = docType, force = false) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          doc_type: newType,
          force_snapshot: force
        })
      });
      const updated = await res.json();
      setLastSaved(updated.updated_at);
      onUpdate(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }, [doc.id, content, title, docType, onUpdate]);

  // Debounced auto-save (2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== doc.content || title !== doc.title || docType !== doc.doc_type) {
        saveDocument(content, title, docType, false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [content, title, docType, doc.content, doc.title, doc.doc_type, saveDocument]);

  const handleContentEditableInput = (e) => {
    setContent(e.target.innerHTML);
  };
  
  const handleCSVChange = (newCsvContent) => {
    setContent(newCsvContent);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {/* Editor Toolbar */}
      <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent' }}>
        <input 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          style={{ fontSize: '1.2rem', fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', flex: 1 }}
          placeholder="Untitled Document"
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            value={docType} 
            onChange={(e) => setDocType(e.target.value)}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--panel-border)', fontSize: '0.85rem', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}
          >
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
            <option value="csv">CSV</option>
          </select>
          
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {isSaving ? 'Saving...' : `Saved ${lastSaved ? (new Date(lastSaved.endsWith('Z') ? lastSaved : lastSaved + 'Z').toLocaleTimeString() !== 'Invalid Date' ? new Date(lastSaved.endsWith('Z') ? lastSaved : lastSaved + 'Z').toLocaleTimeString() : '') : ''}`}
          </span>
          
          <button 
            onClick={() => saveDocument(content, title, docType, true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', background: 'var(--sidebar-hover)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <Save size={14} /> Save Snapshot
          </button>
          
          <button 
            onClick={onToggleVersions}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', background: 'var(--sidebar-hover)', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            <Clock size={14} /> History
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: docType === 'csv' ? '0' : '2rem', position: 'relative' }}>
        {docType === 'csv' ? (
          <CSVGridEditor content={content} onChange={handleCSVChange} />
        ) : (
          <div 
            ref={editorRef}
            contentEditable 
            suppressContentEditableWarning
            onInput={handleContentEditableInput}
            style={{ 
              minHeight: '100%', 
              outline: 'none', 
              fontSize: '1rem', 
              lineHeight: 1.6, 
              color: 'var(--text-primary)',
              maxWidth: '800px',
              margin: '0 auto'
            }}
          />
        )}
        
        {/* We only render the AI toolbar for contenteditable (text) docs */}
        {docType !== 'csv' && (
          <AIFloatingToolbar editorRef={editorRef} docId={doc.id} onContentChange={setContent} />
        )}
      </div>
    </div>
  );
}
