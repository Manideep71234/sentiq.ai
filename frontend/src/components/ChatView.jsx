import { useState, useEffect, useRef } from 'react';
import { Send, Square } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import ToolLog from './ToolLog';
import ProcessingIndicator, { rollNewProcessingWord } from './ProcessingIndicator';

import Dropdown from './Dropdown';

export default function ChatView({ isResearch = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [ws, setWs] = useState(null);
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('openrouter/auto');
  
  // Realtime streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [toolLogs, setToolLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAnyKey, setHasAnyKey] = useState(null);
  
  const historyRef = useRef(null);

  const providerOptions = [
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'groq', label: 'Groq' },
    { value: 'ollama', label: 'Ollama (Local)' }
  ];

  const [openRouterModels, setOpenRouterModels] = useState([
    { value: 'openrouter/auto', label: 'Auto Best Model (OpenRouter)' }
  ]);

  useEffect(() => {
    async function fetchModels() {
      try {
        const settingsRes = await fetch('/settings/api-keys');
        let hasCustomKey = false;
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          hasCustomKey = settings.has_openrouter;
          setHasAnyKey(settings.has_groq || settings.has_openrouter);
        } else {
          setHasAnyKey(false);
        }

        const res = await fetch('https://openrouter.ai/api/v1/models');
        const data = await res.json();
        
        if (data && data.data) {
          let models = data.data;
          
          if (!hasCustomKey) {
            // Filter models that are completely free (prompt=0 and completion=0)
            models = models.filter(m => m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0");
          }
          
          const modelOptions = models.map(m => ({ 
            value: m.id, 
            label: `${m.name} ${!hasCustomKey ? '(Free)' : ''}` 
          }));
            
          setOpenRouterModels([
            { value: 'openrouter/auto', label: 'Auto Best Model' },
            ...modelOptions
          ]);
        }
      } catch (err) {
        console.error("Failed to fetch models:", err);
      }
    }
    fetchModels();
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

  // Update model when provider changes to ensure valid model is selected
  useEffect(() => {
    const opts = getModelOptions(provider);
    if (opts.length > 0 && !opts.find(o => o.value === model)) {
      setModel(opts[0].value);
    }
  }, [provider, openRouterModels]);

  // Reset conversation when model or provider changes
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    if (ws) {
      ws.close();
      setWs(null);
    }
  }, [provider, model]);

  // ... (keep the rest of the hooks identical)

  useEffect(() => {
    // Reset state when switching views
    setMessages([]);
    setToolLogs([]);
    setStreamingContent('');
    setIsProcessing(false);
    
    if (!isResearch) {
      initChatSession();
    }
    
    return () => {
      if (ws) ws.close();
    };
  }, [isResearch]);
  
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, streamingContent, toolLogs]);

  const initChatSession = async () => {
    try {
      const res = await fetch('/chat/sessions', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const connectWebSocket = (queryOverride = null) => {
    if (ws) ws.close();
    
    const getBaseUrl = () => {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `ws://${window.location.host}`;
      }
      return 'wss://sentiq-ai.onrender.com';
    };
    
    const wsUrl = isResearch 
      ? `${getBaseUrl()}/research/ws`
      : `${getBaseUrl()}/chat/ws/${sessionId}`;
      
    const newWs = new WebSocket(wsUrl);
    
    newWs.onopen = () => {
      if (isResearch && queryOverride) {
        newWs.send(JSON.stringify({
          query: queryOverride,
          provider,
          model
        }));
      }
    };
    
    let currentContent = '';
    let currentToolLogs = [];
    
    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'content') {
        currentContent += (data.delta || data.content || '');
        setStreamingContent(currentContent);
      } else if (data.type === 'tool_status') {
        currentToolLogs.push(data.status);
        setToolLogs([...currentToolLogs]);
      } else if (data.type === 'done') {
        const finalContent = data.content || currentContent;
        setMessages(prev => [...prev, { role: 'assistant', content: finalContent, toolLogs: [...currentToolLogs] }]);
        setStreamingContent('');
        setToolLogs([]);
        currentContent = '';
        currentToolLogs = [];
        setIsProcessing(false);
        if (isResearch) newWs.close();
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `**Error:** ${data.error}`, isError: true }]);
        setIsProcessing(false);
        currentContent = '';
        currentToolLogs = [];
        if (isResearch) newWs.close();
      }
    };
    
    setWs(newWs);
    return newWs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasAnyKey === false) return;
    if (!input.trim() || isProcessing) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsProcessing(true);
    setToolLogs([]);
    setStreamingContent('');
    rollNewProcessingWord(); // Pick a new static word for this chat generation
    
    if (isResearch) {
      connectWebSocket(userMsg);
    } else {
      let activeWs = ws;
      if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
        activeWs = connectWebSocket();
        activeWs.onopen = () => {
          activeWs.send(JSON.stringify({ message: userMsg, provider, model }));
        };
      } else {
        activeWs.send(JSON.stringify({ message: userMsg, provider, model }));
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStop = () => {
    if (ws) {
      ws.close();
      if (streamingContent || toolLogs.length > 0 || true) {
        setMessages(prev => [...prev, { role: 'assistant', content: streamingContent, toolLogs: [...toolLogs], stopped: true }]);
      }
      setStreamingContent('');
      setToolLogs([]);
      setIsProcessing(false);
    }
  };

  const renderContent = (content) => {
    return { __html: DOMPurify.sanitize(marked.parse(content || '')) };
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Model Selector Bar */}
      <div style={{ padding: '0.5rem 2rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '1rem', background: 'transparent' }}>
        <Dropdown 
          value={provider} 
          onChange={setProvider} 
          options={providerOptions} 
        />
        
        <div className="animate-pop-in">
          <Dropdown 
            value={model} 
            onChange={setModel} 
            options={getModelOptions(provider)} 
          />
        </div>
      </div>

      <div className="chat-history" ref={historyRef}>
        {messages.length === 0 && (
          <div className="message system-message" style={{ textAlign: 'center', marginTop: 'auto', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            <div className="message-content">
              {isResearch ? "Enter a topic to generate a comprehensive research report." : "Welcome to Sentiq.AI! Type a message to start chatting."}
            </div>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div style={{ width: '100%' }}>
              {msg.toolLogs && msg.toolLogs.length > 0 && (
                <ToolLog logs={msg.toolLogs} isDone={true} />
              )}
              <div 
                className="message-content" 
                style={msg.isError ? { color: 'red' } : {}}
                dangerouslySetInnerHTML={renderContent(msg.content)} 
              />
              {msg.stopped && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Square size={12} fill="currentColor" opacity={0.6} /> <i>You stopped this response.</i>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Active streaming message */}
        {isProcessing && (
          <div className="message message-assistant">
            <div style={{ width: '100%' }}>
              <ToolLog logs={toolLogs} isDone={false} />
              
              {!streamingContent && toolLogs.length === 0 && (
                <div className="message-content">
                  <ProcessingIndicator />
                </div>
              )}

              {streamingContent && (
                <div 
                  className="message-content" 
                  dangerouslySetInnerHTML={renderContent(streamingContent)} 
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isResearch ? "Ask for deep research on any topic..." : "Send a message..."}
            rows={1}
            disabled={isProcessing}
          />
          <div className="chat-form-footer">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Use Shift + Enter for new line
            </span>
            {isProcessing ? (
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

      {hasAnyKey === false && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="animate-pop-in" style={{
            background: 'var(--panel-bg)', border: '1px solid var(--panel-border)',
            padding: '32px', borderRadius: '16px', maxWidth: '450px', width: '90%',
            textAlign: 'center', boxShadow: 'var(--shadow-subtle)', backdropFilter: 'blur(20px)'
          }}>
            <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>API Key Required</h2>
            <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              To ensure lightning-fast responses and unlock premium AI models, please configure at least one API key to start chatting.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px', textAlign: 'left', background: 'var(--system-msg-bg)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '4px' }}>Quick Links:</div>
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚡</span> Get a Free Groq Key (Fastest)
              </a>
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🧠</span> Get an OpenRouter Key (Premium Models)
              </a>
            </div>

            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('changeView', { detail: 'settings-keys' }))}
              style={{
                width: '100%', padding: '14px', background: 'var(--accent-color)', color: 'white',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
                transition: 'opacity 0.2s'
              }}
              onMouseOver={(e) => e.target.style.opacity = '0.9'}
              onMouseOut={(e) => e.target.style.opacity = '1'}
            >
              Configure API Keys
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
