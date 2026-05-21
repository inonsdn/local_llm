import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, room_id } = await req.json();

  const res = await fetch(`${AI_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.INTERNAL_API_KEY ?? '',
    },
    body: JSON.stringify({ message, user_id: user.id, room_id }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'AI server error' }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { room_id } = await req.json().catch(() => ({}));

  const res = await fetch(`${AI_URL}/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.INTERNAL_API_KEY ?? '',
    },
    body: JSON.stringify({ user_id: user.id, room_id }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'AI server error' }, { status: res.status });
  }

  return NextResponse.json({ status: 'cleared' });
}
