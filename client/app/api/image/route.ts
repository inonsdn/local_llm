import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt, negative, seed } = await req.json();
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt required' }, { status: 422 });
  }

  const res = await fetch(`${AI_URL}/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.INTERNAL_API_KEY ?? '',
    },
    body: JSON.stringify({ prompt, negative, seed, user_id: user.id }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Image backend error' }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
