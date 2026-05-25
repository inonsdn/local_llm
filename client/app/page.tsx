'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getRooms, createRoom, updateRoom, type ChatRoom } from '@/lib/db';

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SkeletonRoom() {
  return (
    <li
      className="flex items-center gap-4 rounded-2xl px-4 py-3 animate-pulse"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="w-11 h-11 rounded-full shrink-0" style={{ background: 'var(--accent-muted)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded-full w-2/5" style={{ background: 'var(--accent-muted)' }} />
        <div className="h-2.5 rounded-full w-3/5" style={{ background: 'var(--border)' }} />
      </div>
    </li>
  );
}

interface DialogProps {
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

function InputDialog({ title, placeholder, initialValue = '', confirmLabel, onConfirm, onClose }: DialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // small delay so the animation settles before focusing (avoids iOS keyboard jump)
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(t);
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (trimmed) onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'var(--bg-overlay)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet on mobile, centered card on desktop */}
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <input
          ref={inputRef}
          className="w-full rounded-xl px-4 py-3 outline-none"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-focus)',
            color: 'var(--text-primary)',
            fontSize: '16px', // prevents iOS zoom
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [renameRoom, setRenameRoom] = useState<ChatRoom | null>(null);

  // long-press detection
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
    getRooms()
      .then(setRooms)
      .catch(console.error)
      .finally(() => setLoadingRooms(false));
  }, []);

  const filtered = rooms.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreate(name: string) {
    setShowNewDialog(false);
    try {
      const room = await createRoom(name);
      router.push(`/chat/${room.id}`);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRename(name: string) {
    if (!renameRoom) return;
    const id = renameRoom.id;
    setRenameRoom(null);
    await updateRoom(id, { name });
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, name } : r));
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const onPressStart = useCallback((room: ChatRoom) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setRenameRoom(room);
    }, 600);
  }, []);

  const onPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  function onTap(room: ChatRoom) {
    // if long press already fired, don't navigate
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    router.push(`/chat/${room.id}`);
  }

  return (
    <div
      className="flex flex-col h-full-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          AI Chat
        </h1>
        <div className="flex items-center gap-2">
          {userEmail && (
            <span className="text-xs hidden sm:block truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>
              {userEmail}
            </span>
          )}
          <button
            onClick={() => router.push('/images')}
            className="rounded-xl px-3 py-2 text-sm"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Images
          </button>
          <button
            onClick={handleSignOut}
            className="rounded-xl px-3 py-2 text-sm"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            className="w-full rounded-xl pl-9 pr-4 py-3 outline-none"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '16px', // prevents iOS zoom
            }}
            placeholder="Search chats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Room list */}
      <main className="flex-1 overflow-y-auto px-4 py-2 pb-28">
        <ul className="space-y-2">
          {loadingRooms ? (
            <>
              <SkeletonRoom />
              <SkeletonRoom />
              <SkeletonRoom />
            </>
          ) : filtered.length === 0 ? (
            <li className="flex flex-col items-center gap-4 py-24 text-center">
              {search ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No chats match &ldquo;{search}&rdquo;
                </p>
              ) : (
                <>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                    style={{ background: 'var(--accent-muted)' }}
                  >
                    💬
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No chats yet. Start your first conversation!
                  </p>
                  <button
                    onClick={() => setShowNewDialog(true)}
                    className="rounded-xl px-6 py-3 text-sm font-medium"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    Start first chat
                  </button>
                </>
              )}
            </li>
          ) : (
            <>{filtered.map((room) => (
              <li key={room.id}>
              <button
                type="button"
                className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  touchAction: 'manipulation',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
                onClick={() => onTap(room)}
                onPointerDown={() => onPressStart(room)}
                onPointerUp={onPressEnd}
                onPointerCancel={onPressEnd}
                onContextMenu={(e) => { e.preventDefault(); setRenameRoom(room); }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {room.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {room.name}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(room.last_message_at)}
                    </span>
                  </div>
                  {room.preview && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {room.preview}
                    </p>
                  )}
                </div>
              </button>
              </li>
            ))}</>
          )}
        </ul>
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowNewDialog(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-light active:scale-90 transition-transform"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          boxShadow: '0 4px 28px rgba(192,132,252,0.4)',
          touchAction: 'manipulation',
        }}
        aria-label="New chat"
      >
        +
      </button>

      {showNewDialog && (
        <InputDialog
          title="New chat"
          placeholder="Chat name…"
          confirmLabel="Create"
          onConfirm={handleCreate}
          onClose={() => setShowNewDialog(false)}
        />
      )}

      {renameRoom && (
        <InputDialog
          title="Rename chat"
          placeholder="New name…"
          initialValue={renameRoom.name}
          confirmLabel="Save"
          onConfirm={handleRename}
          onClose={() => setRenameRoom(null)}
        />
      )}
    </div>
  );
}
