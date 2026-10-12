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
  const file = incoming.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 422 });
  }

  const outgoing = new FormData();
  outgoing.append('file', file, file.name);

  const res = await fetch(`${AI_URL}/interrogate`, {
    method: 'POST',
    headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' },
    body: outgoing,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return NextResponse.json({ error: 'Interrogate failed', detail: txt }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
