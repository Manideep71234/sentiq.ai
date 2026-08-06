import { useState, useEffect, useRef } from 'react';
import { Wand2, X, Check } from 'lucide-react';

export default function AIFloatingToolbar({ editorRef, docId, onContentChange }) {
  const [selectionRange, setSelectionRange] = useState(null);
  const [position, setPosition] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [diffNode, setDiffNode] = useState(null);
  
  // Custom instruction state
  const [showCustom, setShowCustom] = useState(false);
  const [customInstruction, setCustomInstruction] = useState('');

  // Handle text selection
  useEffect(() => {
    const handleSelection = () => {
      if (isProcessing) return; // Don't show toolbar while processing
      
      const selection = window.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) {
        setPosition(null);
        setSelectionRange(null);
        return;
      }

      const range = selection.getRangeAt(0);
      // Ensure selection is inside the editor
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current.getBoundingClientRect();
        
        setPosition({
          top: rect.bottom - editorRect.top + 10,
          left: rect.left - editorRect.left,
        });
        setSelectionRange(range);
      } else {
        setPosition(null);
        setSelectionRange(null);
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [editorRef, isProcessing]);

  const triggerAIEdit = (instruction) => {
    if (!selectionRange) return;
    
    setIsProcessing(true);
    setShowCustom(false);
    setPosition(null);

    const originalText = selectionRange.toString();
    
    // Create diff node
    const diffContainer = document.createElement('span');
    diffContainer.className = 'ai-diff-container';
    diffContainer.contentEditable = "false"; // prevent user editing inside it during stream
    diffContainer.style.background = '#f0f9ff';
    diffContainer.style.border = '1px solid #bae6fd';
    diffContainer.style.padding = '2px 4px';
    diffContainer.style.borderRadius = '4px';
    diffContainer.style.display = 'inline-block';
    
    const originalNode = document.createElement('del');
    originalNode.style.color = 'var(--text-secondary)';
    originalNode.textContent = originalText;
    
    const suggestionNode = document.createElement('ins');
    suggestionNode.style.color = 'var(--accent-color)';
    suggestionNode.style.textDecoration = 'none';
    suggestionNode.style.marginLeft = '0.5rem';
    suggestionNode.style.fontWeight = '500';
    
    // Create stop button
    const stopBtn = document.createElement('button');
    stopBtn.innerHTML = '⏹';
    stopBtn.style.background = '#ef4444';
    stopBtn.style.color = 'white';
    stopBtn.style.border = 'none';
    stopBtn.style.borderRadius = '3px';
    stopBtn.style.cursor = 'pointer';
    stopBtn.style.marginLeft = '0.5rem';
    stopBtn.title = "Stop Generation";
    stopBtn.onclick = () => {
      if (ws) ws.close();
      setIsProcessing(false);
      diffContainer.replaceWith(document.createTextNode(originalText));
      onContentChange(editorRef.current.innerHTML);
      setDiffNode(null);
    };
    
    diffContainer.appendChild(originalNode);
    diffContainer.appendChild(suggestionNode);
    diffContainer.appendChild(stopBtn);
    
    selectionRange.deleteContents();
    selectionRange.insertNode(diffContainer);
    setDiffNode({ container: diffContainer, original: originalText, suggestionNode });

    // Stream from websocket
    const getWsBaseUrl = () => {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `ws://${window.location.host}`;
      }
      return 'wss://sentiqai-production.up.railway.app';
    };
    
    const wsUrl = `${getWsBaseUrl()}/documents/ws/${docId}?token=${window.wsToken || ''}`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        selected_text: originalText,
        instruction: instruction,
        surrounding_context: editorRef.current.innerText,
        provider: 'openrouter',
        model: 'openrouter/free'
      }));
    };

    let fullSuggestion = "";

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error("WS Error:", data.error);
        setIsProcessing(false);
        ws.close();
      } else if (data.type === 'content') {
        fullSuggestion += data.content;
        suggestionNode.textContent = fullSuggestion;
      } else if (data.type === 'done') {
        setIsProcessing(false);
        ws.close();
        stopBtn.remove();
        
        // Show accept/reject buttons
        const actionNode = document.createElement('span');
        actionNode.className = 'ai-diff-actions';
        actionNode.contentEditable = "false";
        actionNode.style.marginLeft = '0.5rem';
        actionNode.style.display = 'inline-flex';
        actionNode.style.gap = '0.25rem';
        
        const acceptBtn = document.createElement('button');
        acceptBtn.innerHTML = '✓';
        acceptBtn.style.background = '#22c55e';
        acceptBtn.style.color = 'white';
        acceptBtn.style.border = 'none';
        acceptBtn.style.borderRadius = '3px';
        acceptBtn.style.cursor = 'pointer';
        acceptBtn.onclick = () => {
          diffContainer.replaceWith(document.createTextNode(fullSuggestion));
          onContentChange(editorRef.current.innerHTML);
          setDiffNode(null);
        };
        
        const rejectBtn = document.createElement('button');
        rejectBtn.innerHTML = '✕';
        rejectBtn.style.background = '#ef4444';
        rejectBtn.style.color = 'white';
        rejectBtn.style.border = 'none';
        rejectBtn.style.borderRadius = '3px';
        rejectBtn.style.cursor = 'pointer';
        rejectBtn.onclick = () => {
          diffContainer.replaceWith(document.createTextNode(originalText));
          onContentChange(editorRef.current.innerHTML);
          setDiffNode(null);
        };
        
        actionNode.appendChild(acceptBtn);
        actionNode.appendChild(rejectBtn);
        diffContainer.appendChild(actionNode);
      }
    };
  };

  if (!position) return null;

  return (
    <div 
      className="animate-pop-in"
      style={{
        position: 'absolute',
        top: position.top,
        left: Math.max(0, position.left), // prevent going off left edge
        background: '#1e293b',
        color: 'white',
        borderRadius: '6px',
        padding: '0.5rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        zIndex: 50
      }}
    >
      <Wand2 size={14} style={{ color: '#bae6fd' }} />
      
      {!showCustom ? (
        <>
          <button onClick={() => triggerAIEdit('Rewrite this to be more professional and clear.')} className="ai-toolbar-btn">Rewrite</button>
          <button onClick={() => triggerAIEdit('Expand on this, adding more detail.')} className="ai-toolbar-btn">Expand</button>
          <button onClick={() => triggerAIEdit('Shorten this concisely.')} className="ai-toolbar-btn">Shorten</button>
          <button onClick={() => triggerAIEdit('Fix grammar and spelling.')} className="ai-toolbar-btn">Fix grammar</button>
          <button onClick={() => setShowCustom(true)} className="ai-toolbar-btn" style={{ fontStyle: 'italic' }}>Custom...</button>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <input 
            autoFocus
            value={customInstruction}
            onChange={e => setCustomInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') triggerAIEdit(customInstruction);
              if (e.key === 'Escape') setShowCustom(false);
            }}
            placeholder="Instruction..."
            style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: 'none', outline: 'none', background: '#334155', color: 'white', fontSize: '0.85rem' }}
          />
          <button onClick={() => triggerAIEdit(customInstruction)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem', cursor: 'pointer' }}><Check size={14}/></button>
          <button onClick={() => setShowCustom(false)} style={{ background: 'transparent', color: 'white', border: 'none', padding: '0.25rem', cursor: 'pointer' }}><X size={14}/></button>
        </div>
      )}
    </div>
  );
}
