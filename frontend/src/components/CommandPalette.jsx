import { useState, useEffect, useRef } from 'react';
import { Search, MessageSquare, FileText, FileEdit, X } from 'lucide-react';

export default function CommandPalette({ activeView, setActiveView }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item) => {
    setIsOpen(false);
    if (item.type === 'chat') {
      setActiveView('chat');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('loadChatSession', { detail: { sessionId: item.id, title: item.title } }));
      }, 100);
    } else if (item.type === 'document') {
      setActiveView('documents');
    } else if (item.type === 'note') {
      setActiveView('notes');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', justifyContent: 'center', paddingTop: '10vh'
    }} onClick={() => setIsOpen(false)}>
      <div 
        style={{
          width: '600px', maxWidth: '90%', background: 'var(--panel-bg)',
          borderRadius: '12px', border: '1px solid var(--panel-border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column',
          maxHeight: '80vh', overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--panel-border)' }}>
          <Search size={20} color="var(--text-secondary)" style={{ marginRight: '12px' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search chats, documents, notes..."
            style={{
              flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
              fontSize: '1.1rem', outline: 'none'
            }}
          />
          {isLoading && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Searching...</span>}
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.length === 0 && query.trim() && !isLoading && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No results found for "{query}"
            </div>
          )}
          {results.length > 0 && (
            <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0 }}>
              {results.map((item, idx) => (
                <li key={`${item.type}-${item.id}-${idx}`} style={{ margin: 0, padding: 0 }}>
                  <button
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', padding: '12px 16px',
                      background: selectedIndex === idx ? 'var(--sidebar-hover)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s'
                    }}
                  >
                    <div style={{ marginRight: '12px', color: 'var(--accent-color)', marginTop: '2px' }}>
                      {item.type === 'chat' && <MessageSquare size={18} />}
                      {item.type === 'document' && <FileText size={18} />}
                      {item.type === 'note' && <FileEdit size={18} />}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '4px' }}>
                        {item.title}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.snippet}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--panel-border)', background: 'var(--system-msg-bg)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
          <span>Navigate: <kbd style={{background:'var(--panel-bg)', padding:'2px 4px', borderRadius:'4px', border:'1px solid var(--panel-border)'}}>↑</kbd> <kbd style={{background:'var(--panel-bg)', padding:'2px 4px', borderRadius:'4px', border:'1px solid var(--panel-border)'}}>↓</kbd></span>
          <span>Select: <kbd style={{background:'var(--panel-bg)', padding:'2px 4px', borderRadius:'4px', border:'1px solid var(--panel-border)'}}>Enter</kbd></span>
        </div>
      </div>
    </div>
  );
}
