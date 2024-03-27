// src/models/Conversation.ts
export interface Conversation {
  conversation_id: number;
  user_id: string;
  contact_id: number;
  last_message_id: number;
  current_window_id?: number; // Nullable, based on your application logic
  updated_at: Date;
}
