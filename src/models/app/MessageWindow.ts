// src/models/MessageWindow.ts
export interface MessageWindow {
  window_id: number;
  contact_id: number;
  opened_at: Date;
  closed_at?: Date; // Nullable
}
