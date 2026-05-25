import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const index = req.nextUrl.searchParams.get('index') ?? '0';
  const url = new URL(`${AI_URL}/image/${encodeURIComponent(jobId)}/file`);
  url.searchParams.set('index', index);
  url.searchParams.set('user_id', user.id);

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
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
