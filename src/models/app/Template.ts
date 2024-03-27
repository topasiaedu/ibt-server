// src/models/Template.ts
export interface Template {
  template_id: number;
  project_id: number;
  name: string;
  content: string;
  approval_status: string;
  created_at: Date;
}
