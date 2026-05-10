'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRooms, createRoom, deleteRoom, type ChatRoom } from '@/lib/storage';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setRooms(getRooms());
  }, []);

  function handleCreate() {
    const room = createRoom(newName);
    setNewName('');
    setCreating(false);
    router.push(`/chat/${room.id}`);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteRoom(id);
    setRooms(getRooms());
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Local AI Chat</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          + New Chat
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        {creating && (
          <div className="mb-4 flex gap-2 max-w-xl mx-auto">
            <input
              autoFocus
              className="flex-1 rounded-xl bg-gray-800 border border-gray-700 px-4 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="Chat name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button
              onClick={handleCreate}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setCreating(false)}
              className="rounded-xl bg-gray-800 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {rooms.length === 0 && !creating && (
          <div className="text-center mt-32">
            <p className="text-gray-500 text-sm mb-4">No chats yet.</p>
            <button
              onClick={() => setCreating(true)}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Start your first chat
            </button>
          </div>
        )}

        <ul className="max-w-xl mx-auto space-y-2">
          {rooms.map((room) => (
            <li
              key={room.id}
              onClick={() => router.push(`/chat/${room.id}`)}
              className="group flex items-center gap-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 px-4 py-3 cursor-pointer transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
                {room.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{room.name}</span>
                  <span className="text-xs text-gray-500 shrink-0">{timeAgo(room.lastMessageAt)}</span>
                </div>
                {room.preview && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">{room.preview}</p>
                )}
              </div>
              <button
                onClick={(e) => handleDelete(e, room.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-lg leading-none"
                title="Delete"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
