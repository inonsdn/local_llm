import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AI_URL = `${process.env.AI_HOST}:${process.env.AI_PORT}`;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(`${AI_URL}/character/${encodeURIComponent(id)}`);
  url.searchParams.set('user_id', user.id);

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'X-Api-Key': process.env.INTERNAL_API_KEY ?? '' },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Delete failed' }, { status: res.status });
  }
  return NextResponse.json({ status: 'deleted' });
}
