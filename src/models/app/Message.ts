// src/models/Message.ts
export interface Message {
  message_id: number;
  user_id: string;
  phone_number_id: number;
  message_type: string;
  content: string;
  status: string;
  created_at: Date;
}
