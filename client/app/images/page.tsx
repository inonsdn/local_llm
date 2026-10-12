'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getImageJobs,
  insertImageJob,
  updateImageJob,
  deleteImageJob,
  getCharacters,
  type ImageJob,
  type Character,
} from '@/lib/db';

interface JobStatusResponse {
  status: 'pending' | 'done' | 'error';
  count?: number;
  images?: string[];
  error?: string | null;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function JobTile({
  job,
  onDelete,
  onStatusChange,
  onReuseSeed,
}: {
  job: ImageJob;
  onDelete: (jobId: string) => void;
  onStatusChange: (jobId: string, patch: Partial<ImageJob>) => void;
  onReuseSeed: (seed: number) => void;
}) {
  const [status, setStatus] = useState<JobStatusResponse>({
    status: job.status,
    count: job.image_count,
  });

  useEffect(() => {
    if (job.status !== 'pending') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/image/${job.job_id}`);
        if (!res.ok) return;
        const data: JobStatusResponse = await res.json();
        if (cancelled) return;
        setStatus(data);
        if (data.status === 'done' || data.status === 'error') {
          await updateImageJob(job.job_id, {
            status: data.status,
            image_count: data.count ?? 0,
            error: data.error ?? null,
            completed_at: new Date().toISOString(),
          });
          onStatusChange(job.job_id, {
            status: data.status,
            image_count: data.count ?? 0,
            error: data.error ?? null,
          });
        }
      } catch (e) {
        console.error('poll failed', e);
      }
    };

    poll();
    const interval = setInterval(() => {
      if (status.status === 'pending') poll();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.job_id, job.status]);

  const imageUrl = job.status === 'done' || status.status === 'done'
    ? `/api/image/${job.job_id}/file?index=0`
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="aspect-square flex items-center justify-center relative"
        style={{ background: 'var(--bg-input)' }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={job.prompt}
            className="w-full h-full object-cover"
          />
        ) : status.status === 'error' || job.status === 'error' ? (
          <div className="text-center px-4">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {job.error || status.error || 'Generation failed'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: 'var(--text-muted)', animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              generating…
            </p>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <p
          className="text-xs line-clamp-2"
          style={{ color: 'var(--text-secondary)' }}
          title={job.prompt}
        >
          {job.prompt}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(job.created_at)}
            {job.seed != null && (
              <>
                {' · '}
                <button
                  onClick={() => onReuseSeed(job.seed!)}
                  className="underline"
                  style={{ color: 'var(--text-muted)' }}
                  title="Click to reuse this seed"
                >
                  seed {job.seed}
                </button>
              </>
            )}
          </span>
          <div className="flex gap-1 shrink-0">
            {imageUrl && (
              <a
                href={imageUrl}
                download={`${job.job_id}.png`}
                className="rounded-lg px-2 py-1 text-xs"
                style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
              >
                Download
              </a>
            )}
            <button
              onClick={() => onDelete(job.job_id)}
              className="rounded-lg px-2 py-1 text-xs"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImagesPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ImageJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterId, setCharacterId] = useState<string>('');
  const [negative, setNegative] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [interrogating, setInterrogating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const interrogateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getImageJobs()
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
    getCharacters().then(setCharacters).catch(console.error);
  }, []);

  const handleGenerate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const parsedSeed = seedInput.trim() === '' ? undefined : Number(seedInput);
      if (parsedSeed !== undefined && (!Number.isFinite(parsedSeed) || parsedSeed < 0)) {
        throw new Error('Seed must be a non-negative number');
      }
      const negativeTrimmed = negative.trim() || undefined;

      const res = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          character_id: characterId || undefined,
          negative: negativeTrimmed,
          seed: parsedSeed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const job = await insertImageJob(
        data.job_id,
        text,
        negativeTrimmed ?? null,
        typeof data.seed === 'number' ? data.seed : null,
      );
      setJobs((prev) => [job, ...prev]);
      setPrompt('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [prompt, submitting, characterId, negative, seedInput]);

  const handleDelete = useCallback(async (jobId: string) => {
    await deleteImageJob(jobId);
    setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
  }, []);

  const handleStatusChange = useCallback((jobId: string, patch: Partial<ImageJob>) => {
    setJobs((prev) => prev.map((j) => (j.job_id === jobId ? { ...j, ...patch } : j)));
  }, []);

  const handleReuseSeed = useCallback((seed: number) => {
    setSeedInput(String(seed));
    setShowAdvanced(true);
  }, []);

  const handleInterrogateFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setInterrogating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/interrogate', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const tagString = data.prompt_string as string;
      if (!tagString) {
        throw new Error('No tags found');
      }
      // Prepend tags to current prompt, separating with comma
      setPrompt((prev) => prev.trim() ? `${tagString}, ${prev.trim()}` : tagString);
      // Auto-resize textarea after content change
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setInterrogating(false);
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 640) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

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
          Image Generation
        </h1>
      </header>

      <div
        className="shrink-0 px-3 py-3 space-y-2"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {characters.length > 0 && (
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="w-full rounded-xl px-4 py-3 outline-none"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '16px',
            }}
          >
            <option value="">No character (free prompt)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                Use character: {c.name} ({c.ref_count} ref{c.ref_count === 1 ? '' : 's'})
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={interrogateInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleInterrogateFile}
          />
          <button
            type="button"
            onClick={() => interrogateInputRef.current?.click()}
            disabled={interrogating}
            className="rounded-xl px-3 py-2 text-xs disabled:opacity-40"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {interrogating ? 'Reading image…' : '📷 Tag from image'}
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="w-full resize-none rounded-xl px-4 py-3 outline-none"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '16px',
            minHeight: '48px',
            maxHeight: '160px',
            lineHeight: '1.5',
          }}
          rows={1}
          placeholder={
            characterId
              ? 'Describe the scene: walking in paris, red dress, evening, smiling…'
              : 'masterpiece, best quality, 1girl, kimono, cherry blossoms…'
          }
          value={prompt}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs underline"
          style={{ color: 'var(--text-muted)' }}
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced (seed, negative prompt)'}
        </button>

        {showAdvanced && (
          <div className="space-y-2">
            <input
              type="number"
              min={0}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '16px',
              }}
              placeholder="Seed (leave empty for random)"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
            />
            <textarea
              className="w-full resize-none rounded-xl px-4 py-3 outline-none"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: '16px',
                minHeight: '72px',
                lineHeight: '1.5',
              }}
              rows={2}
              placeholder="Negative prompt (leave empty to use server default)"
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {error ? (
            <span className="text-xs" style={{ color: '#f87171' }}>{error}</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Takes ~30–60s. You can navigate away.
            </span>
          )}
          <button
            onClick={handleGenerate}
            disabled={submitting || !prompt.trim()}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)', color: '#fff', touchAction: 'manipulation' }}
          >
            {submitting ? 'Submitting…' : 'Generate'}
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-3 py-4">
        {loading ? (
          <p className="text-center text-sm mt-20" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: 'var(--accent-muted)' }}
            >
              🎨
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No images yet. Try a prompt above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {jobs.map((job) => (
              <JobTile
                key={job.job_id}
                job={job}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onReuseSeed={handleReuseSeed}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
