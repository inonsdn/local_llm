import { NextRequest, NextResponse } from 'next/server';

const AI_URL = `http://${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function POST(req: NextRequest) {
    const { message } = await req.json();

    const res = await fetch(`${AI_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });

    if (!res.ok) {
        return NextResponse.json({ error: 'AI server error' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
}

export async function DELETE() {
    const res = await fetch(`${AI_URL}/clear`, { method: 'POST' });

    if (!res.ok) {
        return NextResponse.json({ error: 'AI server error' }, { status: res.status });
    }

    return NextResponse.json({ status: 'cleared' });
}
