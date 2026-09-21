import { NextRequest, NextResponse } from 'next/server';

const AI_URL = process.env.AI_URL ?? 'http://127.0.0.1:8000';

async function forward(path: string, body: unknown) {
  try {
    const res = await fetch(`${AI_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'AI server error' }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Cannot reach AI server' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const { message, room_id } = await req.json();
  return forward('/chat', { message, room_id: room_id ?? 'default' });
}

export async function DELETE(req: NextRequest) {
  const { room_id } = await req.json().catch(() => ({}));
  return forward('/clear', { room_id: room_id ?? 'default' });
}
