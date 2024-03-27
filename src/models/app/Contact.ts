// src/models/Contact.ts
export interface Contact {
  contact_id: number;
  user_id: string; // Assuming UUID format for Supabase auth users
  name: string;
  email?: string;
  phone: string;
  created_at: Date;
}
