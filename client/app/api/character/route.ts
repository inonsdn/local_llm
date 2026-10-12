import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const incoming = await req.formData();
  const characterId = incoming.get('character_id');
  if (typeof characterId !== 'string' || !characterId) {
    return NextResponse.json({ error: 'character_id required' }, { status: 422 });
  }

  const files = incoming.getAll('files').filter((v): v is File => v instanceof File);
  if (files.length === 0 || files.length > 4) {
    return NextResponse.json({ error: 'Provide 1-4 files' }, { status: 422 });
  }

  // build a new FormData for FastAPI
  const outgoing = new FormData();
  outgoing.set('user_id', user.id);
  outgoing.set('character_id', characterId);
  for (const f of files) outgoing.append('files', f, f.name);

  const res = await fetch(`${AI_URL}/character`, {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' },
    body: outgoing,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return NextResponse.json({ error: 'Upload failed', detail: txt }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
