'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function addMessage(role: ChatMessage['role'], content: string) {
    setMessages((prev) => [...prev, { id: nextId.current++, role, content }]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    addMessage('user', text);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      addMessage('assistant', res.ok ? data.content : `Error: ${data.error ?? 'AI server error'}`);
    } catch {
      addMessage('assistant', 'Error: could not reach AI server.');
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    await fetch('/api/chat', { method: 'DELETE' }).catch(() => {});
    setMessages([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // only send on Enter without Shift on non-mobile (mobile Enter = newline is more natural)
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // auto grow
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  return (
    <div
      className="flex flex-col h-full-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          AI Chat
        </h1>
        <button
          onClick={handleClear}
          className="px-3 py-2 rounded-xl text-sm shrink-0"
          style={{
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            touchAction: 'manipulation',
          }}
        >
          Clear
        </button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-center text-sm mt-20" style={{ color: 'var(--text-muted)' }}>
            Send a message to start chatting.
          </p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed"
              style={
                msg.role === 'user'
                  ? { background: 'var(--user-bubble)', color: '#f0e6ff', borderBottomRightRadius: '4px' }
                  : { background: 'var(--ai-bubble)', color: 'var(--text-primary)', borderBottomLeftRadius: '4px', border: '1px solid var(--border)' }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl px-4 py-3 flex gap-1.5 items-center"
              style={{ background: 'var(--ai-bubble)', border: '1px solid var(--border)', borderBottomLeftRadius: '4px' }}
            >
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: 'var(--text-muted)', animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="shrink-0 px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-xl px-4 py-3 outline-none"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '16px', // prevents iOS zoom
              minHeight: '48px',
              maxHeight: '160px',
              lineHeight: '1.5',
            }}
            rows={1}
            placeholder="Message…"
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl px-4 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              height: '48px',
              touchAction: 'manipulation',
            }}
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
