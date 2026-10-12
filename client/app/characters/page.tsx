'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCharacters,
  insertCharacter,
  updateCharacterRefCount,
  deleteCharacter as deleteCharacterRow,
  type Character,
} from '@/lib/db';

function CharacterCard({
  character,
  onDelete,
}: {
  character: Character;
  onDelete: (id: string) => void;
}) {
  const refIndices = Array.from({ length: character.ref_count }, (_, i) => i);

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="grid grid-cols-2 gap-0.5" style={{ background: 'var(--border)' }}>
        {refIndices.length === 0 ? (
          <div
            className="col-span-2 aspect-square flex items-center justify-center"
            style={{ background: 'var(--bg-input)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>no refs</span>
          </div>
        ) : (
          refIndices.slice(0, 4).map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={`/api/character/${character.id}/ref/${i}`}
              alt={`ref ${i}`}
              className="aspect-square w-full object-cover"
              style={{ background: 'var(--bg-input)' }}
            />
          ))
        )}
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {character.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {character.ref_count} reference{character.ref_count === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => onDelete(character.id)}
          className="rounded-lg px-2 py-1 text-xs shrink-0"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function CharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCharacters()
      .then(setCharacters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).slice(0, 4);
    setFiles(selected);
  };

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || files.length === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    let row: Character | null = null;
    try {
      row = await insertCharacter(trimmed);

      const fd = new FormData();
      fd.set('character_id', row.id);
      for (const f of files) fd.append('files', f);

      const res = await fetch('/api/character', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      await updateCharacterRefCount(row.id, data.ref_count);

      setCharacters((prev) => [{ ...row!, ref_count: data.ref_count }, ...prev]);
      setName('');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // best-effort cleanup of the orphaned row
      if (row) {
        try { await deleteCharacterRow(row.id); } catch { /* ignore */ }
      }
    } finally {
      setSubmitting(false);
    }
  }, [name, files, submitting]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/character/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('FastAPI delete failed', e);
    }
    await deleteCharacterRow(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return (
    <div
      className="flex flex-col h-full-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
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
        <h1 className="flex-1 text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          Characters
        </h1>
      </header>

      {/* Create form */}
      <div
        className="shrink-0 px-3 py-3 space-y-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <input
          className="w-full rounded-xl px-4 py-3 outline-none"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '16px',
          }}
          placeholder="Character name (e.g. Aria)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label
          className="flex items-center justify-between gap-2 rounded-xl px-4 py-3 cursor-pointer"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
        >
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {files.length === 0
              ? 'Choose 1–4 reference images'
              : `${files.length} file${files.length === 1 ? '' : 's'} selected`}
          </span>
          <span className="text-xs" style={{ color: 'var(--accent)' }}>Browse</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        <div className="flex items-center justify-between gap-2">
          {error ? (
            <span className="text-xs" style={{ color: '#f87171' }}>{error}</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Best results with portrait/front-view shots, same character.
            </span>
          )}
          <button
            onClick={handleCreate}
            disabled={submitting || !name.trim() || files.length === 0}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: '#fff', touchAction: 'manipulation' }}
          >
            {submitting ? 'Uploading…' : 'Create'}
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <p className="text-center text-sm mt-20" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        ) : characters.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: 'var(--accent-muted)' }}
            >
              👤
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No characters yet. Create one above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {characters.map((c) => (
              <CharacterCard key={c.id} character={c} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
