import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import * as Diff from 'diff';

export default function VersionHistory({ doc, onClose, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  
  useEffect(() => {
    fetchVersions();
  }, [doc.id]);

  const fetchVersions = async () => {
    try {
      const res = await fetch(`/documents/${doc.id}/versions`);
      const data = await res.json();
      setVersions(data);
      if (data.length > 0) setSelectedVersion(data[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    try {
      const res = await fetch(`/documents/${doc.id}/versions/${selectedVersion.id}/restore`, {
        method: 'POST'
      });
      const restoredDoc = await res.json();
      onRestore(restoredDoc);
    } catch (e) {
      console.error(e);
    }
  };

  const renderDiff = () => {
    if (!selectedVersion) return null;
    
    // We diff the selected version against the CURRENT document content
    const diff = Diff.diffLines(selectedVersion.content, doc.content);
    
    return (
      <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.5 }}>
        {diff.map((part, i) => {
          let bgColor = 'transparent';
          let prefix = '  ';
          if (part.added) {
            bgColor = 'rgba(74, 222, 128, 0.2)'; // semi-transparent green
            prefix = '+ ';
          } else if (part.removed) {
            bgColor = 'rgba(248, 113, 113, 0.2)'; // semi-transparent red
            prefix = '- ';
          }
          
          return (
            <div key={i} style={{ backgroundColor: bgColor, padding: '0 0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', userSelect: 'none' }}>{prefix}</span>
              {part.value}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="glass-panel" style={{ width: '350px', borderLeft: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 10, padding: 0 }}>
      
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Version History</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Timeline list */}
        <div style={{ width: '120px', borderRight: '1px solid var(--panel-border)', overflowY: 'auto' }}>
          {versions.map((v, idx) => (
            <div 
              key={v.id}
              onClick={() => setSelectedVersion(v)}
              style={{
                padding: '0.75rem 0.5rem',
                borderBottom: '1px solid var(--panel-border)',
                background: selectedVersion?.id === v.id ? 'var(--user-msg-bg)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: 'var(--text-primary)'
              }}
            >
              <div style={{ fontWeight: 500 }}>{idx === 0 ? 'Latest' : `Version ${versions.length - idx}`}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{v.created_at ? new Date(v.created_at.endsWith('Z') ? v.created_at : v.created_at + 'Z').toLocaleTimeString() : ''}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{v.created_at ? new Date(v.created_at.endsWith('Z') ? v.created_at : v.created_at + 'Z').toLocaleDateString() : ''}</div>
            </div>
          ))}
          {versions.length === 0 && (
            <div style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
              No snapshots yet.
            </div>
          )}
        </div>

        {/* Diff preview */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '0.5rem', background: 'transparent', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Diff (Current vs Selected)</span>
            <button 
              onClick={handleRestore}
              disabled={!selectedVersion || selectedVersion.id === versions[0]?.id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', opacity: (!selectedVersion || selectedVersion.id === versions[0]?.id) ? 0.5 : 1 }}
            >
              <RotateCcw size={12} /> Restore
            </button>
          </div>
          <div style={{ padding: '0.5rem', flex: 1, overflowY: 'auto', background: 'transparent' }}>
            {renderDiff()}
          </div>
        </div>
      </div>
    </div>
  );
}
