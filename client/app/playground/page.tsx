'use client';

// Storage-free image playground.
// No Supabase, no auth, no database — every result lives in React state only
// and is gone on refresh. Generation is stateless on the backend too
// (/image/oneshot discards the reference image after use).

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface JobStatus {
  status: 'pending' | 'done' | 'error';
  count?: number;
  error?: string | null;
}

interface Job {
  jobId: string;
  prompt: string;
  seed: number | null;
}

function ResultTile({ job, onForget }: { job: Job; onForget: (jobId: string) => void }) {
  const [status, setStatus] = useState<JobStatus>({ status: 'pending' });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/public/image/${job.jobId}`);
        if (!res.ok || cancelled) return;
        const data: JobStatus = await res.json();
        if (cancelled) return;
        setStatus(data);
        if (data.status !== 'pending' && timer) {
          clearInterval(timer);
          timer = null;
        }
      } catch (e) {
        console.error('poll failed', e);
      }
    };

    poll();
    timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [job.jobId]);

  const imageUrl = status.status === 'done' ? `/api/public/image/${job.jobId}/file?index=0` : null;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="aspect-square flex items-center justify-center"
        style={{ background: 'var(--bg-input)' }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={job.prompt} className="w-full h-full object-cover" />
        ) : status.status === 'error' ? (
          <div className="text-center px-4">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {status.error || 'Generation failed'}
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
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>generating…</p>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }} title={job.prompt}>
          {job.prompt}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {job.seed != null ? `seed ${job.seed}` : ''}
          </span>
          <div className="flex gap-1 shrink-0">
            {imageUrl && (
              <a
                href={imageUrl}
                download={`${job.jobId}.png`}
                className="rounded-lg px-2 py-1 text-xs"
                style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
              >
                Download
              </a>
            )}
            <button
              onClick={() => onForget(job.jobId)}
              className="rounded-lg px-2 py-1 text-xs"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [prompt, setPrompt] = useState('');
  const [negative, setNegative] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [refFile, setRefFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'ipadapter' | 'img2img'>('ipadapter');
  const [denoise, setDenoise] = useState(0.5);
  const [submitting, setSubmitting] = useState(false);
  const [interrogating, setInterrogating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const interrogateInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleInterrogateFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setInterrogating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/public/interrogate', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const tagString = data.prompt_string as string;
      if (!tagString) throw new Error('No tags found');
      setPrompt((prev) => (prev.trim() ? `${tagString}, ${prev.trim()}` : tagString));
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

  const handleGenerate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const parsedSeed = seedInput.trim();
      if (parsedSeed !== '' && (!Number.isFinite(Number(parsedSeed)) || Number(parsedSeed) < 0)) {
        throw new Error('Seed must be a non-negative number');
      }

      const fd = new FormData();
      fd.append('prompt', text);
      if (negative.trim()) fd.append('negative', negative.trim());
      if (parsedSeed !== '') fd.append('seed', parsedSeed);
      if (refFile) {
        fd.append('ref', refFile);
        fd.append('mode', mode);
        if (mode === 'img2img') fd.append('denoise', String(denoise));
      }

      const res = await fetch('/api/public/image', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setJobs((prev) => [
        { jobId: data.job_id, prompt: text, seed: typeof data.seed === 'number' ? data.seed : null },
        ...prev,
      ]);
      setPrompt('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [prompt, submitting, negative, seedInput, refFile, mode, denoise]);

  const handleForget = useCallback((jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
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
    <div className="flex flex-col h-full-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <header className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0 text-xl"
          style={{ color: 'var(--text-secondary)', touchAction: 'manipulation' }}
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            Playground
          </h1>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            No login, nothing saved — results vanish on refresh
          </p>
        </div>
      </header>

      <div className="shrink-0 px-3 py-3 space-y-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex flex-wrap items-center gap-2">
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
            {interrogating ? 'Reading image…' : '📷 Tag from style image'}
          </button>

          <input
            ref={refInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => setRefFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => refInputRef.current?.click()}
            className="rounded-xl px-3 py-2 text-xs"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {refFile ? `👤 Ref: ${refFile.name}` : '👤 Likeness ref (optional)'}
          </button>
          {refFile && (
            <button
              type="button"
              onClick={() => setRefFile(null)}
              className="text-xs underline"
              style={{ color: 'var(--text-muted)' }}
            >
              clear
            </button>
          )}
        </div>

        {refFile && (
          <div className="flex flex-col gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
            <div className="flex gap-2">
              {([
                ['ipadapter', 'Likeness (new scene)'],
                ['img2img', 'Match reference'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className="flex-1 rounded-lg px-2 py-2 text-xs"
                  style={{
                    background: mode === value ? 'var(--accent-muted)' : 'transparent',
                    color: mode === value ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: `1px solid ${mode === value ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'img2img' && (
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span style={{ minWidth: '88px' }}>Match strength</span>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  value={denoise}
                  onChange={(e) => setDenoise(Number(e.target.value))}
                  className="flex-1"
                />
                <span style={{ minWidth: '54px', color: 'var(--text-secondary)' }}>
                  {denoise <= 0.45 ? 'closest' : denoise >= 0.65 ? 'loosest' : 'balanced'}
                </span>
              </label>
            )}
          </div>
        )}

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
          placeholder="masterpiece, best quality, 1girl, silver hair, bookshelf, cardigan…"
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
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '16px' }}
              placeholder="Seed (leave empty for random)"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
            />
            <textarea
              className="w-full resize-none rounded-xl px-4 py-3 outline-none"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '16px', minHeight: '72px', lineHeight: '1.5' }}
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
              Takes ~30–60s. Nothing is stored.
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
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: 'var(--accent-muted)' }}>
              🎨
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No images yet. Tag a style image, add an optional likeness ref, and Generate.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {jobs.map((job) => (
              <ResultTile key={job.jobId} job={job} onForget={handleForget} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
