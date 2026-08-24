import { useState, useEffect, useRef } from 'react';
import { Send, Square, Paperclip, X, Loader2, Mic, MicOff } from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import ToolLog from './ToolLog';
import ProcessingIndicator, { rollNewProcessingWord } from './ProcessingIndicator';

import Dropdown from './Dropdown';

export default function ChatView({ isResearch = false, activeView, setActiveView }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [ws, setWs] = useState(null);
  const [provider, setProvider] = useState('openrouter');
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [model, setModel] = useState('openrouter/auto');
  const recognitionRef = useRef(null);

  // Realtime streaming state
  const [streamingContent, setStreamingContent] = useState('');
  const [toolLogs, setToolLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasAnyKey, setHasAnyKey] = useState(null);
  const [toolbar, setToolbar] = useState({ show: false, x: 0, y: 0, text: '' });

  const historyRef = useRef(null);
  const lastUserMessageRef = useRef('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isProcessing && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 10);
    }
  }, [isProcessing]);

  useEffect(() => {
    if (input === '' && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input]);

  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = (code, language) => {
      const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      return `
        <div class="code-wrapper">
          <div class="code-header">
            <span class="code-language">${language || 'text'}</span>
            <button class="copy-btn" data-code="${escapedCode}">Copy</button>
          </div>
          <pre><code class="language-${language || 'text'}">${escapedCode}</code></pre>
        </div>
      `;
    };
    marked.setOptions({ renderer });
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      
      if (text && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const elem = container.nodeType === 3 ? container.parentNode : container;
        
        if (elem && elem.closest && elem.closest('.message-assistant')) {
          const rect = range.getBoundingClientRect();
          setToolbar({
            show: true,
            text,
            x: rect.left + rect.width / 2,
            y: rect.top - 45
          });
          return;
        }
      }
      
      if (!text) {
        setToolbar({ show: false, x: 0, y: 0, text: '' });
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleGlobalClick = (e) => {
    if (e.target.classList.contains('copy-btn')) {
      const code = e.target.getAttribute('data-code');
      const decodedCode = code.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
      navigator.clipboard.writeText(decodedCode).then(() => {
        e.target.innerText = 'Copied!';
        setTimeout(() => { if(e.target) e.target.innerText = 'Copy'; }, 2000);
      });
    }
  };

  const providerOptions = [
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'groq', label: 'Groq' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'ollama', label: 'Ollama (Local)' },
    { value: 'lmstudio', label: 'LM Studio (Local)' }
  ];

  const [openRouterModels, setOpenRouterModels] = useState([
    { value: 'openrouter/auto', label: 'Auto Best Model (OpenRouter)' }
  ]);

  const fetchModels = async () => {
    try {
      const settingsRes = await fetch(`/settings/api-keys?t=${Date.now()}`);
      let hasCustomKey = false;
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        hasCustomKey = settings.has_openrouter;
        setHasAnyKey(settings.has_groq || settings.has_openrouter || settings.has_gemini);
      } else {
        setHasAnyKey(false);
      }

      const res = await fetch('https://openrouter.ai/api/v1/models');
      const data = await res.json();

      if (data && data.data) {
        let models = data.data;
        if (!hasCustomKey) {
          models = models.filter(m => m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0");
        }
        const modelOptions = models.map(m => ({
          value: m.id,
          label: `${m.name} ${!hasCustomKey ? '(Free)' : ''}`
        }));
        setOpenRouterModels([{ value: 'openrouter/auto', label: 'Auto Best Model' }, ...modelOptions]);
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
    }
  };

  useEffect(() => {
    if (activeView === 'chat' || activeView === 'research') {
      fetchModels();
    }
  }, [activeView]);

  const getModelOptions = (prov) => {
    if (prov === 'ollama') {
      return [
        { value: 'llama3', label: 'llama3 (Ollama)' },
        { value: 'mistral', label: 'mistral (Ollama)' }
      ];
    } else if (prov === 'groq') {
      return [
        { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Groq)' },
        { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' }
      ];
    } else if (prov === 'gemini') {
      return [
        { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' }
      ];
    } else if (prov === 'lmstudio') {
      return [
        { value: 'local-model', label: 'Local Model (LM Studio)' }
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
      setSessionId(null);
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
        window.dispatchEvent(new CustomEvent('chatTitleUpdated', { detail: { sessionId: data.id, title: 'New Chat' } }));
        return data.id;
      }
      console.error("Failed to create chat session. Status:", res.status);
      return null;
    } catch (e) {
      console.error("Network error creating chat session:", e);
      return null;
    }
  };

  const loadChatSession = async (id) => {
    try {
      const res = await fetch(`/chat/sessions/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages = data.map(m => ({
          role: m.role,
          content: m.content,
          toolLogs: [] // we don't persist tool logs in this basic model, but we could
        }));
        setMessages(loadedMessages);
        setSessionId(id);
        
        // Let App.jsx know we loaded this session to update the title
        // We'd need to fetch the session title, but since Sidebar has it, maybe we don't need it or we can fetch the session object.
        // Actually the backend `/chat/sessions` returns all sessions.
      }
    } catch (e) {
      console.error("Failed to load chat session:", e);
    }
  };

  useEffect(() => {
    if (isResearch) return; // Research view shouldn't handle chat sessions

    const handleLoadSession = (e) => {
      if (e.detail.sessionId === null) {
        setMessages([]);
        setSessionId(null);
        if (ws) {
          ws.close();
          setWs(null);
        }
      } else {
        loadChatSession(e.detail.sessionId);
        window.dispatchEvent(new CustomEvent('chatTitleUpdated', { detail: { sessionId: e.detail.sessionId, title: e.detail.title } }));
      }
    };
    window.addEventListener('loadChatSession', handleLoadSession);
    return () => window.removeEventListener('loadChatSession', handleLoadSession);
  }, []);

  const connectWebSocket = (queryOverride = null, activeSessionId = null) => {
    if (ws) ws.close();

    const getBaseUrl = () => {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `ws://${window.location.host}`;
      }
      return 'wss://sentiqai-production.up.railway.app';
    };

    const targetSessionId = activeSessionId || sessionId;
    const wsUrl = isResearch
      ? `${getBaseUrl()}/research/ws?token=${window.wsToken || ''}`
      : `${getBaseUrl()}/chat/ws/${targetSessionId}?token=${window.wsToken || ''}`;

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
      } else if (data.type === 'title_update') {
        window.dispatchEvent(new CustomEvent('chatTitleUpdated', { detail: { sessionId: targetSessionId, title: data.title } }));
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
        setInput(lastUserMessageRef.current);
        setIsProcessing(false);
        currentContent = '';
        currentToolLogs = [];
        if (isResearch) newWs.close();
      }
    };

    newWs.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Connection Error:** Failed to connect to the server. Please check your internet connection and try again.`,
        isError: true
      }]);
      setInput(lastUserMessageRef.current);
      setIsProcessing(false);
      setStreamingContent('');
    };

    newWs.onclose = (event) => {
      if (isProcessing && !event.wasClean) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `**Connection Closed Abruptly.** The server may have restarted or crashed.`,
          isError: true
        }]);
        setIsProcessing(false);
        setStreamingContent('');
      }
    };

    setWs(newWs);
    return newWs;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/chat/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setAttachments(prev => [...prev, data]);
      } else {
        alert(data.detail || 'Failed to upload attachment');
      }
    } catch (err) {
      alert('Network error during upload');
    } finally {
      setIsUploading(false);
      e.target.value = null; // Reset input
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    if (isProcessing) return;

    let userMsg = input.trim();
    
    if (attachments.length > 0) {
      attachments.forEach(att => {
        if (att.type === 'pdf') {
          userMsg += `\n\n[Attached File: ${att.filename}]\n${att.content}`;
        } else if (att.type === 'image') {
          userMsg += `\n\n[Image: ${att.url}]`;
        }
      });
      setAttachments([]);
    }

    lastUserMessageRef.current = userMsg;
    // Scroll down eagerly
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsProcessing(true);
    setToolLogs([]);
    setStreamingContent('');
    rollNewProcessingWord(); // Pick a new static word for this chat generation

    let targetSessionId = sessionId;
    if (!isResearch && !targetSessionId) {
      targetSessionId = await initChatSession();
      if (!targetSessionId) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `**Error:** Failed to initialize chat session. Please ensure you are logged in and try again.`, 
          isError: true 
        }]);
        setIsProcessing(false);
        return;
      }
    }

    if (isResearch) {
      connectWebSocket(userMsg);
    } else {
      let activeWs = ws;
      if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
        activeWs = connectWebSocket(null, targetSessionId);
        activeWs.onopen = () => {
          activeWs.send(JSON.stringify({ message: userMsg, provider, model }));
        };
      } else {
        activeWs.send(JSON.stringify({ message: userMsg, provider, model }));
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey)) {
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
    if (!content) return { __html: '' };
    // Replace [Image: /data/uploads/xyz.jpg] with markdown image syntax
    const withImages = content.replace(/\[Image:\s*(\/data\/uploads\/[^\]]+)\]/g, '![Attachment]($1)');
    // Strip [Attached File: filename] blocks for display or format them nicely
    const withFiles = withImages.replace(/\[Attached File:\s*([^\]]+)\]/g, '> 📎 **Attached Document:** $1\n');
    return { __html: DOMPurify.sanitize(marked.parse(withFiles)) };
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }} onClick={handleGlobalClick}>
      
      {toolbar.show && (
        <div className="selection-toolbar" style={{ left: toolbar.x, top: toolbar.y }}>
          <button onClick={() => { 
            setInput(`Explain this part:\n\n> ${toolbar.text}\n\n`); 
            setToolbar(prev => ({...prev, show: false})); 
            if (inputRef.current) inputRef.current.focus(); 
          }}>Explain</button>
          
          <button onClick={() => { 
            setInput(`I have a question about this part:\n\n> ${toolbar.text}\n\n`); 
            setToolbar(prev => ({...prev, show: false})); 
            if (inputRef.current) inputRef.current.focus(); 
          }}>Ask</button>
          
          <button onClick={() => { 
            navigator.clipboard.writeText(toolbar.text); 
            setToolbar(prev => ({...prev, show: false})); 
          }}>Copy</button>
        </div>
      )}

      {/* Model Selector Bar */}
      <div className="model-selector-bar" style={{ padding: '0.5rem 2rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', gap: '1rem', background: 'transparent', alignItems: 'center' }}>
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

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.ceil(input.length / 4)}</span> tokens
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
        {attachments.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', padding: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--panel-border)' }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--panel-bg)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--panel-border)' }}>
                {att.type === 'image' ? <img src={att.url} alt="attachment" style={{ height: '24px', width: '24px', objectFit: 'cover', borderRadius: '2px' }} /> : <Paperclip size={12} />}
                <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                <button onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <form className="chat-form" onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              const maxH = window.innerHeight * 0.4;
              e.target.style.height = Math.min(e.target.scrollHeight, maxH) + 'px';
              e.target.style.overflowY = e.target.scrollHeight > maxH ? 'auto' : 'hidden';
            }}
            onKeyDown={handleKeyDown}
            placeholder={isResearch ? "Ask for deep research on any topic..." : "Send a message..."}
            rows={1}
            disabled={isProcessing}
            style={{ overflowY: 'hidden', minHeight: '56px', maxHeight: '40vh' }}
          />
          <div className="chat-form-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="file" id="chat-attachment" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.webp" />
              <label htmlFor="chat-attachment" style={{ cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--text-secondary)', border: 'none', borderRadius: '4px', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--hover-bg)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'} title="Attach file (PDF, Image)">
                {isUploading ? <Loader2 size={18} className="spin" /> : <Paperclip size={18} />}
              </label>
              
              <button 
                type="button" 
                onClick={toggleListening}
                style={{ cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: isListening ? '#ef4444' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', transition: 'background 0.2s' }} 
                onMouseOver={e => e.currentTarget.style.background = isListening ? 'rgba(239, 68, 68, 0.2)' : 'var(--hover-bg)'} 
                onMouseOut={e => e.currentTarget.style.background = isListening ? 'rgba(239, 68, 68, 0.1)' : 'transparent'}
                title={isListening ? "Stop listening" : "Start voice dictation"}
              >
                {isListening ? <Mic size={18} className="pulse-animation" /> : <MicOff size={18} />}
              </button>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                Use Shift + Enter for new line
              </span>
            </div>
            {isProcessing ? (
              <button type="button" className="send-btn stop-btn" onClick={handleStop} title="Stop Generation" style={{ backgroundColor: 'var(--error-color)' }}>
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" className="send-btn" disabled={(!input.trim() && attachments.length === 0) || isUploading}>
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
                <span style={{ fontSize: '1.2rem' }}>🧠</span> Get an OpenRouter Key (Free/Premium Models)
              </a>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>✨</span> Get a Google Gemini Key (Free Tier Available)
              </a>
            </div>

            <button
              onClick={() => setActiveView && setActiveView('api-keys')}
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
