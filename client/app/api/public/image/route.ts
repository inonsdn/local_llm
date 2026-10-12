import { NextRequest, NextResponse } from 'next/server';

// Public, no-auth proxy: stateless image generation.
// Forwards prompt (+ optional inline reference image) to the backend
// /image/oneshot endpoint, which never persists a character. No Supabase.
const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function POST(req: NextRequest) {
  const incoming = await req.formData();

  const prompt = incoming.get('prompt');
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt required' }, { status: 422 });
  }

  const outgoing = new FormData();
  outgoing.append('prompt', prompt);

  const negative = incoming.get('negative');
  if (typeof negative === 'string' && negative.trim()) {
    outgoing.append('negative', negative);
  }

  const seed = incoming.get('seed');
  if (typeof seed === 'string' && seed.trim()) {
    outgoing.append('seed', seed);
  }

  const mode = incoming.get('mode');
  if (typeof mode === 'string' && mode.trim()) {
    outgoing.append('mode', mode);
  }

  const denoise = incoming.get('denoise');
  if (typeof denoise === 'string' && denoise.trim()) {
    outgoing.append('denoise', denoise);
  }

  const ref = incoming.get('ref');
  if (ref instanceof File && ref.size > 0) {
    outgoing.append('ref', ref, ref.name);
  }

  const res = await fetch(`${AI_URL}/image/oneshot`, {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' },
    body: outgoing,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return NextResponse.json({ error: 'Image backend error', detail: txt }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
