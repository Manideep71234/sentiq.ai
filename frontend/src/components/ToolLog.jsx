import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

export default function ToolLog({ logs, isDone }) {
  const [expanded, setExpanded] = useState(false);
  
  if (!logs || logs.length === 0) return null;
  
  return (
    <div className="tool-log-container">
      <div 
        className="tool-log-header"
        onClick={() => setExpanded(!expanded)}
      >
        {!isDone ? (
          <Loader2 size={16} className="spinner" style={{ color: 'var(--accent-color)' }} />
        ) : (
          <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
            <span style={{ color: 'green' }}>✓</span>
          </div>
        )}
        <span>
          {isDone ? `Finished ${logs.length} background task(s)` : `Agent is working (${logs.length} steps)...`}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>
      
      {expanded && (
        <div className="tool-log-content">
          {logs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: '4px' }}>
              <span style={{ color: '#aaa', marginRight: '8px' }}>[{idx + 1}]</span>
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
