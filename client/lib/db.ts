import { createClient } from '@/lib/supabase/client';

export interface ChatRoom {
  id: string;
  user_id: string;
  name: string;
  preview: string;
  created_at: string;
  last_message_at: string;
}

export interface ChatMessage {
  id: number;
  room_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function getRooms(): Promise<ChatRoom[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRoom(id: string): Promise<ChatRoom | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data;
}

export async function createRoom(name: string): Promise<ChatRoom> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert({ name: name.trim() || 'New Chat', user_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRoom(id: string, patch: Partial<Pick<ChatRoom, 'preview' | 'last_message_at' | 'name'>>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('chat_rooms').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRoom(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('chat_rooms').delete().eq('id', id);
  if (error) throw error;
}

export async function getMessages(roomId: string): Promise<ChatMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function appendMessage(
  roomId: string,
  role: 'user' | 'assistant',
  content: string,
): Promise<ChatMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, role, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function clearMessages(roomId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('chat_messages').delete().eq('room_id', roomId);
  if (error) throw error;
}
