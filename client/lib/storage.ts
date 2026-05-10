export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatRoom {
  id: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  preview: string;
}

const ROOMS_KEY = 'chat_rooms';
const historyKey = (id: string) => `chat_history_${id}`;

export function getRooms(): ChatRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveRoom(room: ChatRoom): void {
  const rooms = getRooms().filter((r) => r.id !== room.id);
  rooms.unshift(room);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

export function deleteRoom(id: string): void {
  const rooms = getRooms().filter((r) => r.id !== id);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  localStorage.removeItem(historyKey(id));
}

export function getRoom(id: string): ChatRoom | undefined {
  return getRooms().find((r) => r.id === id);
}

export function getHistory(roomId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(historyKey(roomId)) ?? '[]');
  } catch {
    return [];
  }
}

export function appendMessage(roomId: string, msg: ChatMessage): void {
  const history = getHistory(roomId);
  history.push(msg);
  localStorage.setItem(historyKey(roomId), JSON.stringify(history));
}

export function clearHistory(roomId: string): void {
  localStorage.setItem(historyKey(roomId), '[]');
}

export function createRoom(name: string): ChatRoom {
  const room: ChatRoom = {
    id: crypto.randomUUID(),
    name: name.trim() || 'New Chat',
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
    preview: '',
  };
  saveRoom(room);
  return room;
}
