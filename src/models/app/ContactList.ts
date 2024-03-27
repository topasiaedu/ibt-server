// src/models/ContactList.ts
export interface ContactList {
  contact_list_id: number;
  name: string;
  description?: string;
  created_at: Date;
}
