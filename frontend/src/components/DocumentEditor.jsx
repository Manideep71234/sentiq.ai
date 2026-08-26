import { useState, useEffect, useRef, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { 
  Clock, Save, FileSpreadsheet, Search, Bold, Italic, Underline as UnderlineIcon, 
  Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, 
  CheckSquare, Link2, Highlighter, Heading1, Heading2, Heading3, Table as TableIcon,
  Undo, Redo, X, Bot, Send, Sparkles, Check
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { CharacterCount } from '@tiptap/extension-character-count';

import AIFloatingToolbar from './AIFloatingToolbar';
import CSVGridEditor from './CSVGridEditor';

function FindAndReplace({ editor, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');

  const handleReplaceAll = () => {
    if (!searchTerm || !editor) return;
    const currentContent = editor.getHTML();
    // Using simple replaceAll on HTML string (not perfectly safe for all nodes but works for basic usage)
    // A robust solution requires TipTap SearchAndReplace extension
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const newContent = currentContent.replace(regex, replaceTerm);
    editor.commands.setContent(newContent);
  };

  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '0.75rem', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '250px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Find & Replace</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={14}/></button>
      </div>
      <input 
        placeholder="Find..." 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)}
        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--sidebar-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }} 
      />
      <input 
        placeholder="Replace with..." 
        value={replaceTerm} 
        onChange={e => setReplaceTerm(e.target.value)}
        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--panel-border)', background: 'var(--sidebar-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }} 
      />
      <button onClick={handleReplaceAll} style={{ padding: '0.4rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
        Replace All
      </button>
    </div>
  );
}

function TipTapToolbar({ editor }) {
// ... TipTapToolbar ...
// (Retaining existing code)
  if (!editor) return null;

  const btnStyle = (isActive) => ({
    background: isActive ? 'var(--accent-color)' : 'transparent',
    color: isActive ? 'white' : 'var(--text-secondary)',
    border: 'none',
    borderRadius: '4px',
    padding: '0.4rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  });

  const dividerStyle = {
    width: '1px',
    height: '24px',
    background: 'var(--panel-border)',
    margin: '0 0.25rem'
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0.5rem 1.5rem', borderBottom: '1px solid var(--panel-border)', background: 'var(--panel-bg)', alignItems: 'center' }}>
      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} style={{...btnStyle(false), opacity: editor.can().undo() ? 1 : 0.5}}><Undo size={16} /></button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} style={{...btnStyle(false), opacity: editor.can().redo() ? 1 : 0.5}}><Redo size={16} /></button>
      
      <div style={dividerStyle} />

      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} style={btnStyle(editor.isActive('heading', { level: 1 }))}><Heading1 size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} style={btnStyle(editor.isActive('heading', { level: 2 }))}><Heading2 size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} style={btnStyle(editor.isActive('heading', { level: 3 }))}><Heading3 size={16} /></button>

      <div style={dividerStyle} />

      <button onClick={() => editor.chain().focus().toggleBold().run()} style={btnStyle(editor.isActive('bold'))}><Bold size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} style={btnStyle(editor.isActive('italic'))}><Italic size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={btnStyle(editor.isActive('underline'))}><UnderlineIcon size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} style={btnStyle(editor.isActive('strike'))}><Strikethrough size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleHighlight().run()} style={btnStyle(editor.isActive('highlight'))}><Highlighter size={16} /></button>

      <div style={dividerStyle} />

      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} style={btnStyle(editor.isActive({ textAlign: 'left' }))}><AlignLeft size={16} /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} style={btnStyle(editor.isActive({ textAlign: 'center' }))}><AlignCenter size={16} /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} style={btnStyle(editor.isActive({ textAlign: 'right' }))}><AlignRight size={16} /></button>
      <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} style={btnStyle(editor.isActive({ textAlign: 'justify' }))}><AlignJustify size={16} /></button>

      <div style={dividerStyle} />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={btnStyle(editor.isActive('bulletList'))}><List size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={btnStyle(editor.isActive('orderedList'))}><ListOrdered size={16} /></button>
      <button onClick={() => editor.chain().focus().toggleTaskList().run()} style={btnStyle(editor.isActive('taskList'))}><CheckSquare size={16} /></button>

      <div style={dividerStyle} />

      <button onClick={() => {
        const url = window.prompt('URL');
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }} style={btnStyle(editor.isActive('link'))}><Link2 size={16} /></button>

      <div style={dividerStyle} />
      
      <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} style={btnStyle(false)}><TableIcon size={16} /></button>
    </div>
  );
}

function AIAssistantPanel({ editor, docId, onClose }) {
  const [messages, setMessages] = useState([{ role: 'ai', content: 'Hi! I can help you rewrite, summarize, or translate this document. What would you like to do?', isActionable: false }]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);
  let wsRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || !editor || isProcessing) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    const getWsBaseUrl = () => {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `ws://${window.location.host}`;
      }
      return 'wss://sentiqai-production.up.railway.app';
    };

    const wsUrl = `${getWsBaseUrl()}/documents/ws/${docId}?token=${window.wsToken || ''}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const documentContent = editor.getHTML();

    ws.onopen = () => {
      ws.send(JSON.stringify({
        selected_text: documentContent,
        instruction: userMessage,
        surrounding_context: "",
        provider: 'openrouter',
        model: 'openrouter/free'
      }));
    };

    let aiResponse = "";
    setMessages(prev => [...prev, { role: 'ai', content: '', isActionable: false }]);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        console.error("WS Error:", data.error);
        setMessages(prev => {
          const newM = [...prev];
          newM[newM.length - 1].content = `Error: ${data.error}`;
          return newM;
        });
        setIsProcessing(false);
        ws.close();
      } else if (data.type === 'content') {
        aiResponse += data.content;
        setMessages(prev => {
          const newM = [...prev];
          newM[newM.length - 1].content = aiResponse;
          return newM;
        });
      } else if (data.type === 'done') {
        setIsProcessing(false);
        setMessages(prev => {
          const newM = [...prev];
          newM[newM.length - 1].isActionable = true;
          return newM;
        });
        ws.close();
      }
    };

    ws.onerror = () => {
      setIsProcessing(false);
      setMessages(prev => {
        const newM = [...prev];
        newM[newM.length - 1].content = 'Connection error.';
        return newM;
      });
    };
  };

  const handleApply = (content) => {
    if (editor) {
      editor.commands.setContent(content);
    }
  };

  return (
    <div style={{ position: 'absolute', bottom: '80px', right: '20px', width: '350px', height: '500px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          <Bot size={18} color="var(--accent-color)" />
          Document AI
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '85%', padding: '0.75rem', borderRadius: '8px', background: m.role === 'user' ? 'var(--accent-color)' : 'var(--sidebar-bg)', color: m.role === 'user' ? 'white' : 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5, border: m.role === 'ai' ? '1px solid var(--panel-border)' : 'none' }}>
              {m.role === 'ai' && <Sparkles size={14} style={{ marginBottom: '0.25rem', color: 'var(--text-secondary)' }} />}
              <div dangerouslySetInnerHTML={{ __html: m.role === 'ai' ? DOMPurify.sanitize(m.content) : m.content }} />
            </div>
            {m.role === 'ai' && m.isActionable && (
              <button 
                onClick={() => handleApply(m.content)}
                style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
              >
                <Check size={14} /> Apply to Document
              </button>
            )}
          </div>
        ))}
        {isProcessing && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="typing-indicator"><span>.</span><span>.</span><span>.</span></div> Generating...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ padding: '0.75rem', borderTop: '1px solid var(--panel-border)', display: 'flex', gap: '0.5rem' }}>
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask AI to rewrite..."
          disabled={isProcessing}
          style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '20px', border: '1px solid var(--panel-border)', background: 'var(--main-bg)', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button type="submit" disabled={isProcessing || !input.trim()} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (isProcessing || !input.trim()) ? 'not-allowed' : 'pointer', opacity: (isProcessing || !input.trim()) ? 0.6 : 1 }}>
          <Send size={16} style={{ marginLeft: '2px' }} />
        </button>
      </form>
    </div>
  );
}

// --- Main Document Editor Component ---

export default function DocumentEditor({ doc, onUpdate, onToggleVersions }) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [docType, setDocType] = useState(doc.doc_type);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(doc.updated_at);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  
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

  // Setup TipTap
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      Highlight,
      CharacterCount
    ],
    content: DOMPurify.sanitize(doc.content),
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
  }, [doc.id]); // re-init if doc id changes

  // Update state when active doc changes
  useEffect(() => {
    setTitle(doc.title);
    setContent(doc.content);
    setDocType(doc.doc_type);
    setLastSaved(doc.updated_at);
    if (editor && doc.doc_type !== 'csv' && editor.getHTML() !== doc.content) {
      editor.commands.setContent(DOMPurify.sanitize(doc.content));
    }
  }, [doc.id]);

  // Debounced auto-save (2 seconds)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== doc.content || title !== doc.title || docType !== doc.doc_type) {
        saveDocument(content, title, docType, false);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [content, title, docType, doc.content, doc.title, doc.doc_type, saveDocument]);
  
  const handleCSVChange = (newCsvContent) => {
    setContent(newCsvContent);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* Editor Header */}
      <div style={{ padding: '0.75rem 1.5rem', borderBottom: docType === 'csv' ? '1px solid var(--panel-border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent' }}>
        <input 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          style={{ fontSize: '1.2rem', fontWeight: 600, border: 'none', outline: 'none', background: 'transparent', flex: 1, color: 'var(--text-primary)' }}
          placeholder="Untitled Document"
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {docType !== 'csv' && (
            <button 
              onClick={() => setShowFindReplace(!showFindReplace)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem', background: 'transparent', border: '1px solid var(--panel-border)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <Search size={14} /> Find
            </button>
          )}

          <select 
            value={docType} 
            onChange={(e) => {
              const newType = e.target.value;
              setDocType(newType);
              if (newType !== 'csv' && editor) {
                editor.commands.setContent(content);
              }
            }}
            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--panel-border)', fontSize: '0.85rem', background: 'var(--panel-bg)', color: 'var(--text-primary)' }}
          >
            <option value="markdown">Markdown / Rich Text</option>
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

      {/* Editor Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        
        {docType !== 'csv' && <TipTapToolbar editor={editor} />}
        {showFindReplace && docType !== 'csv' && <FindAndReplace editor={editor} onClose={() => setShowFindReplace(false)} />}

        <div style={{ flex: 1, overflowY: 'auto', padding: docType === 'csv' ? '0' : '2rem', display: 'flex', flexDirection: 'column' }}>
          {docType === 'csv' ? (
            <CSVGridEditor content={content} onChange={handleCSVChange} />
          ) : (
            <div style={{ maxWidth: '850px', width: '100%', margin: '0 auto', background: 'var(--panel-bg)', minHeight: '800px', padding: '4rem', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid var(--panel-border)' }} className="tiptap-wrapper">
              <EditorContent editor={editor} />
            </div>
          )}
        </div>
        
        {/* Render AIFloatingToolbar - we pass editor to let it lock/unlock */}
        {docType !== 'csv' && editor && (
          <AIFloatingToolbar 
            editorRef={{ current: editor.view.dom }} 
            docId={doc.id} 
            onContentChange={(newHtml) => editor.commands.setContent(newHtml)} 
            tipTapEditor={editor}
          />
        )}
      </div>
      
      {/* AI Assistant Floating Button */}
      {docType !== 'csv' && !showAIPanel && (
        <button 
          onClick={() => setShowAIPanel(true)}
          style={{ position: 'absolute', bottom: '20px', right: '20px', width: '50px', height: '50px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(59, 130, 246, 0.4)', zIndex: 90, transition: 'transform 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="Document AI"
        >
          <Bot size={24} />
        </button>
      )}

      {/* AI Assistant Panel */}
      {showAIPanel && docType !== 'csv' && (
        <AIAssistantPanel editor={editor} docId={doc.id} onClose={() => setShowAIPanel(false)} />
      )}

      <style>
        {`
          .tiptap-wrapper .ProseMirror {
            min-height: 100%;
            outline: none;
            line-height: 1.6;
            color: var(--text-primary);
          }
          .tiptap-wrapper .ProseMirror p {
            margin-top: 0;
            margin-bottom: 1rem;
          }
          .tiptap-wrapper .ProseMirror h1, .tiptap-wrapper .ProseMirror h2, .tiptap-wrapper .ProseMirror h3 {
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
          }
          .tiptap-wrapper .ProseMirror table {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
            margin: 0;
            overflow: hidden;
          }
          .tiptap-wrapper .ProseMirror table td, .tiptap-wrapper .ProseMirror table th {
            min-width: 1em;
            border: 2px solid var(--panel-border);
            padding: 3px 5px;
            vertical-align: top;
            box-sizing: border-box;
            position: relative;
          }
          .tiptap-wrapper .ProseMirror table th {
            font-weight: bold;
            text-align: left;
            background-color: var(--sidebar-bg);
          }
          .tiptap-wrapper .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding: 0;
          }
          .tiptap-wrapper .ProseMirror ul[data-type="taskList"] p {
            margin: 0;
          }
          .tiptap-wrapper .ProseMirror ul[data-type="taskList"] li {
            display: flex;
          }
          .tiptap-wrapper .ProseMirror ul[data-type="taskList"] li > label {
            flex: 0 0 auto;
            margin-right: 0.5rem;
            user-select: none;
          }
          .tiptap-wrapper .ProseMirror ul[data-type="taskList"] li > div {
            flex: 1 1 auto;
          }
          .tiptap-wrapper .ProseMirror mark {
            background-color: #fef08a;
          }
          .tiptap-wrapper .ProseMirror a {
            color: #3b82f6;
            cursor: pointer;
          }
          
          .typing-indicator span {
            animation: blink 1.4s infinite both;
          }
          .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
          .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes blink {
            0% { opacity: 0.2; }
            20% { opacity: 1; }
            100% { opacity: 0.2; }
          }
        `}
      </style>
    </div>
  );
}
