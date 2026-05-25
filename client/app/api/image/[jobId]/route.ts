import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(
    `${AI_URL}/image/${encodeURIComponent(jobId)}?user_id=${user.id}`,
    { headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' } },
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Image backend error' }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
