import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Send, Trash2, Loader2, Bot, User, ChevronLeft, ChevronRight,
  FileText, Sparkles
} from 'lucide-react';
import { getApiKey, hasApiKey } from '../lib/ai';
import { invoke } from '@tauri-apps/api/core';

interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  activeFile: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are the FORGE AI assistant — an embedded research partner inside the Theophysics framework workspace.

You operate within FORGE: Logos Workshop, a desktop application for working with a structured collection of axioms, laws, and claims that treat physics and theology as dual measurement frames over a single divinely-ordered relational substrate.

Context you have:
- The user is David, the framework creator. He thinks in interconnected systems, not linearly.
- The framework includes: the Master Equation χ=∭(G·M·E·S·T·K·R·Q·F·C)dxdydt, 10 Laws with symmetry pairs, 188 numbered axioms, and experimental correlations (PEAR-LAB 6.35σ, GCP 6σ, PROP-COSMOS 5.7σ).
- You are inside his editor. He may share the current file content with you.

Your role:
- Be direct, concise, and substantive.
- Challenge ideas more than you affirm them. Easy agreement earns less trust.
- When you see a claim, think structurally: what would break it? What holds it together?
- When asked to help write or rewrite, match the framework's voice: rigorous but not dry, theological but not devotional, scientific but not reductive.
- You can reference the Core8 commands (/PROBE, /EAST, /CONNECT, /DEEPER, /INTEGRATE, /CHAIN, /BLINDSPOT, /NORTH) as shared vocabulary.
- Never be performative. No "great insight" or "glad you asked." Just work.

If the user shares file content, analyze it in context of the framework. If they ask general questions, answer them. If they want to think out loud, track the thread underneath the tangent.`;

const AiPanel: React.FC<AiPanelProps> = ({ open, onClose, activeFile }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [includeFile, setIncludeFile] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load file content when activeFile changes
  useEffect(() => {
    if (!activeFile) {
      setFileContent(null);
      return;
    }
    invoke<string>('read_note', { path: activeFile })
      .then(setFileContent)
      .catch(() => setFileContent(null));
  }, [activeFile]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    if (!hasApiKey()) return;

    const apiKey = getApiKey();
    if (!apiKey) return;

    // Build user message with optional file context
    let userContent = trimmed;
    if (includeFile && fileContent && activeFile) {
      const fileName = activeFile.split(/[\\/]/).pop() || 'unknown';
      userContent = `[Current file: ${fileName}]\n\`\`\`markdown\n${fileContent}\n\`\`\`\n\n${trimmed}`;
    }

    const userMsg: ChatMessage = { role: 'user', content: trimmed, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);
    setStreamText('');
    setIncludeFile(false);

    // Build API messages
    const apiMessages = updatedMessages.map(m => ({
      role: m.role,
      content: m.role === 'user' && m === userMsg ? userContent : m.content,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `API error ${response.status}`;
        try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errMsg}`, timestamp: Date.now() }]);
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                fullText += event.delta.text;
                setStreamText(fullText);
              }
            } catch {}
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullText, timestamp: Date.now() }]);
      setStreamText('');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now() }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, messages, streaming, includeFile, fileContent, activeFile]);

  const handleAbort = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      if (streamText) {
        setMessages(prev => [...prev, { role: 'assistant', content: streamText + '\n\n_(aborted)_', timestamp: Date.now() }]);
        setStreamText('');
      }
      setStreaming(false);
    }
  };

  const handleClear = () => {
    if (streaming) handleAbort();
    setMessages([]);
    setStreamText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  const fileName = activeFile?.split(/[\\/]/).pop()?.replace('.md', '') || null;

  return (
    <div className="ai-panel">
      {/* Header */}
      <div className="ai-panel-header">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-forge-ember" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleClear} className="ai-panel-btn" title="Clear conversation">
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} className="ai-panel-btn" title="Close panel (Ctrl+Shift+A)">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-panel-messages">
        {messages.length === 0 && !streamText && (
          <div className="ai-panel-empty">
            <Sparkles size={24} className="text-forge-ember/20 mb-3" />
            <p className="text-[11px] text-gray-600 text-center leading-relaxed">
              Your framework research partner.<br />
              Ask anything, or toggle <strong className="text-gray-500">Include file</strong> to give it context.
            </p>
            <div className="mt-3 space-y-1">
              {[
                'What would /PROBE find in this note?',
                'How does this connect to Law 3?',
                'Rewrite this claim more precisely',
                'What am I not seeing here?',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="ai-panel-suggestion"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-msg ${msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-assistant'}`}>
            <div className="ai-msg-icon">
              {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
            </div>
            <div className="ai-msg-content">{msg.content}</div>
          </div>
        ))}

        {streamText && (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-msg-icon">
              <Bot size={10} />
            </div>
            <div className="ai-msg-content">
              {streamText}
              <span className="ai-cursor">▊</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="ai-panel-input-area">
        {/* File context toggle */}
        {fileName && (
          <button
            onClick={() => setIncludeFile(!includeFile)}
            className={`ai-panel-file-toggle ${includeFile ? 'active' : ''}`}
            title={includeFile ? `Will include ${fileName} content` : `Click to include ${fileName} as context`}
          >
            <FileText size={10} />
            <span>{fileName}</span>
            {includeFile && <span className="text-forge-ember">✓</span>}
          </button>
        )}

        <div className="ai-panel-input-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey() ? 'Ask anything...' : 'Set API key in Settings first'}
            disabled={!hasApiKey() || streaming}
            rows={1}
            className="ai-panel-textarea"
          />
          {streaming ? (
            <button onClick={handleAbort} className="ai-panel-send abort" title="Stop">
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !hasApiKey()}
              className="ai-panel-send"
              title="Send (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiPanel;
