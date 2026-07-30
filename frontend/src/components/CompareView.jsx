import { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import Dropdown from './Dropdown';
import ProcessingIndicator from './ProcessingIndicator';

export default function CompareView() {
  const [input, setInput] = useState('');
  
  const [leftProvider, setLeftProvider] = useState('openrouter');
  const [leftModel, setLeftModel] = useState('openrouter/auto');
  const [leftState, setLeftState] = useState({ content: '', isProcessing: false, error: null });

  const [rightProvider, setRightProvider] = useState('openrouter');
  const [rightModel, setRightModel] = useState('openrouter/auto');
  const [rightState, setRightState] = useState({ content: '', isProcessing: false, error: null });

  const wsRefs = useRef({ left: null, right: null });

  const providerOptions = [
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'groq', label: 'Groq' },
    { value: 'ollama', label: 'Ollama (Local)' }
  ];

  const [openRouterModels, setOpenRouterModels] = useState([
    { value: 'openrouter/auto', label: 'Auto Best Model (OpenRouter)' }
  ]);

  useEffect(() => {
    fetch('https://openrouter.ai/api/v1/models')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const freeModels = data.data
            .filter(m => m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0")
            .map(m => ({ value: m.id, label: `${m.name} (Free)` }));
            
          setOpenRouterModels([
            { value: 'openrouter/auto', label: 'Auto Best Model' },
            ...freeModels
          ]);
        }
      })
      .catch(err => console.error("Failed to fetch OpenRouter models:", err));
  }, []);

  const getModelOptions = (prov) => {
    if (prov === 'ollama') {
      return [
        { value: 'llama3', label: 'llama3 (Ollama)' },
        { value: 'mistral', label: 'mistral (Ollama)' }
      ];
    } else if (prov === 'groq') {
      return [
        { value: 'llama3-8b-8192', label: 'Llama 3 8B (Groq)' },
        { value: 'llama3-70b-8192', label: 'Llama 3 70B (Groq)' }
      ];
    } else {
      return openRouterModels;
    }
  };

  useEffect(() => {
    const opts = getModelOptions(leftProvider);
    if (opts.length > 0 && !opts.find(o => o.value === leftModel)) {
      setLeftModel(opts[0].value);
    }
  }, [leftProvider, openRouterModels]);

  useEffect(() => {
    const opts = getModelOptions(rightProvider);
    if (opts.length > 0 && !opts.find(o => o.value === rightModel)) {
      setRightModel(opts[0].value);
    }
  }, [rightProvider, openRouterModels]);

  const renderContent = (content) => {
    return { __html: DOMPurify.sanitize(marked.parse(content || '')) };
  };

  const runModel = async (provider, model, setter, side) => {
    setter({ content: '', isProcessing: true, error: null });
    
    try {
      const sessionRes = await fetch('/chat/sessions', { method: 'POST' });
      if (!sessionRes.ok) throw new Error("Session failed");
      const sessionData = await sessionRes.json();
      const sessionId = sessionData.id;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/chat/ws/${sessionId}`);
      wsRefs.current[side] = ws;
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ message: input, provider, model }));
      };

      let currentContent = '';
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'content') {
          currentContent += (data.delta || data.content || '');
          setter(prev => ({ ...prev, content: currentContent }));
        } else if (data.type === 'done') {
          setter(prev => ({ ...prev, isProcessing: false }));
          ws.close();
        } else if (data.error) {
          setter(prev => ({ ...prev, isProcessing: false, error: data.error }));
          ws.close();
        }
      };

      ws.onerror = () => {
        setter(prev => ({ ...prev, isProcessing: false, error: 'WebSocket connection failed' }));
      };
    } catch (err) {
      setter({ content: '', isProcessing: false, error: err.message });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || leftState.isProcessing || rightState.isProcessing) return;
    
    runModel(leftProvider, leftModel, setLeftState, 'left');
    runModel(rightProvider, rightModel, setRightState, 'right');
  };

  const handleStop = () => {
    if (wsRefs.current.left) {
      wsRefs.current.left.close();
      setLeftState(prev => ({ ...prev, isProcessing: false }));
    }
    if (wsRefs.current.right) {
      wsRefs.current.right.close();
      setRightState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '1rem', gap: '1rem', background: 'transparent' }}>
        
        {/* LEFT PANE */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '0.5rem', background: 'transparent' }}>
            <div className="animate-dropdown" style={{display: 'flex', gap: '0.5rem'}}>
                <Dropdown value={leftProvider} onChange={setLeftProvider} options={providerOptions} />
                <Dropdown value={leftModel} onChange={setLeftModel} options={getModelOptions(leftProvider)} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="markdown-body">
            {leftState.isProcessing && !leftState.content && <ProcessingIndicator />}
            {leftState.error && <p style={{color: 'red'}}>Error: {leftState.error}</p>}
            {!leftState.isProcessing && !leftState.content && !leftState.error && <p style={{color: '#999', textAlign: 'center', marginTop: '2rem'}}>Select models and enter a prompt below.</p>}
            <div dangerouslySetInnerHTML={renderContent(leftState.content)} />
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '0.5rem', background: 'transparent' }}>
            <div className="animate-dropdown" style={{display: 'flex', gap: '0.5rem'}}>
                <Dropdown value={rightProvider} onChange={setRightProvider} options={providerOptions} />
                <Dropdown value={rightModel} onChange={setRightModel} options={getModelOptions(rightProvider)} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }} className="markdown-body">
            {rightState.isProcessing && !rightState.content && <ProcessingIndicator />}
            {rightState.error && <p style={{color: 'red'}}>Error: {rightState.error}</p>}
            {!rightState.isProcessing && !rightState.content && !rightState.error && <p style={{color: '#999', textAlign: 'center', marginTop: '2rem'}}>Select models and enter a prompt below.</p>}
            <div dangerouslySetInnerHTML={renderContent(rightState.content)} />
          </div>
        </div>

      </div>

      {/* INPUT AREA */}
      <div className="chat-input-container" style={{ background: 'transparent', paddingBottom: '2rem' }}>
        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a prompt to compare how both models handle it..."
            rows={2}
            disabled={leftState.isProcessing || rightState.isProcessing}
          />
          
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', flexWrap: 'wrap' }}>
            {["Explain quantum computing in one sentence", "Write a haiku about a robot", "Write a Python script to reverse a string"].map((prompt, idx) => (
              <button 
                key={idx} 
                type="button" 
                onClick={() => setInput(prompt)}
                disabled={leftState.isProcessing || rightState.isProcessing}
                className="preset-btn"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="chat-form-footer">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Use Shift + Enter for new line
            </span>
            {leftState.isProcessing || rightState.isProcessing ? (
              <button type="button" className="send-btn stop-btn" onClick={handleStop} title="Stop Generation" style={{ backgroundColor: 'var(--error-color)' }}>
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" className="send-btn" disabled={!input.trim()}>
                <Send size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
