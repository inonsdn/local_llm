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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRoom(id).then((r) => {
      if (!r) { router.replace('/'); return; }
      setRoom(r);
    });
    getMessages(id).then(setMessages).catch(console.error);
  }, [id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || !room) return;

    setInput('');
    setLoading(true);

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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-gray-800 shrink-0">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800"
          title="Back"
        >
          ←
        </button>
        <h1 className="flex-1 text-base font-semibold tracking-tight truncate">
          {room?.name ?? '…'}
        </h1>
        <button
          onClick={handleClear}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Clear
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 mt-20 text-sm">
            Send a message to start chatting.
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer className="shrink-0 border-t border-gray-800 px-4 py-4">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <textarea
            className="flex-1 resize-none rounded-xl bg-gray-800 border border-gray-700 px-4 py-3 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            rows={1}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
