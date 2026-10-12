import { NextRequest, NextResponse } from 'next/server';

// Public, no-auth proxy: poll job status. Anonymous (no user_id) so the
// backend reads/writes under its 'anonymous' bucket. No Supabase.
const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const res = await fetch(
    `${AI_URL}/image/${encodeURIComponent(jobId)}`,
    { headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' } },
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Image backend error' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
