import { NextRequest, NextResponse } from 'next/server';

// Public, no-auth proxy: fetch a finished image. Anonymous (no user_id).
// No Supabase. Returns the raw PNG bytes.
const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const index = req.nextUrl.searchParams.get('index') ?? '0';
  const url = new URL(`${AI_URL}/image/${encodeURIComponent(jobId)}/file`);
  url.searchParams.set('index', index);

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Image not available' }, { status: res.status });
  }

  const buf = await res.arrayBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
