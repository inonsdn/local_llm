'use client';

import { useState, useRef, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  getRoom,
  getMessages,
  appendMessage,
  clearMessages,
  updateRoom,
  type ChatMessage,
  type ChatRoom,
} from '@/lib/db';

export default function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getRoom(id).then((r) => {
      if (!r) { router.replace('/'); return; }
      setRoom(r);
      setNameInput(r.name);
    });
    getMessages(id).then(setMessages).catch(console.error);
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (editingName) {
      setTimeout(() => nameInputRef.current?.select(), 50);
    }
  }, [editingName]);

  async function saveName() {
    const name = nameInput.trim();
    setEditingName(false);
    if (!name || !room || name === room.name) return;
    await updateRoom(id, { name });
    setRoom((r) => r ? { ...r, name } : r);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !room) return;

    setInput('');
    setLoading(true);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const userMsg = await appendMessage(id, 'user', text);
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, room_id: id }),
      });

      const data = await res.json();
      const content: string = data.content ?? data.response ?? data.message ?? JSON.stringify(data);

      const aiMsg = await appendMessage(id, 'assistant', content);
      setMessages((prev) => [...prev, aiMsg]);

      const now = new Date().toISOString();
      await updateRoom(id, { preview: content.slice(0, 80), last_message_at: now });
      setRoom((r) => r ? { ...r, preview: content.slice(0, 80), last_message_at: now } : r);
    } catch {
      const errMsg = await appendMessage(id, 'assistant', 'Error: could not reach AI server.');
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    await fetch('/api/chat', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: id }),
    });
    await clearMessages(id);
    setMessages([]);
    if (room) {
      const now = new Date().toISOString();
      await updateRoom(id, { preview: '', last_message_at: now });
      setRoom({ ...room, preview: '', last_message_at: now });
    }
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
        className="flex items-center gap-2 px-3 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 text-xl"
          style={{ color: 'var(--text-secondary)', touchAction: 'manipulation' }}
        >
          ←
        </button>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="w-full bg-transparent outline-none font-semibold"
              style={{
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-focus)',
                paddingBottom: '2px',
                fontSize: '16px', // prevents iOS zoom
              }}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') { setEditingName(false); setNameInput(room?.name ?? ''); }
              }}
            />
          ) : (
            <button
              className="flex items-center gap-1.5 max-w-full text-left"
              onClick={() => setEditingName(true)}
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {room?.name ?? '…'}
              </span>
              <svg
                className="w-3.5 h-3.5 shrink-0 opacity-40"
                style={{ color: 'var(--text-muted)' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}
        </div>

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
      <footer
        className="shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
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
