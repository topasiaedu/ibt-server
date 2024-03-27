// src/models/Campaign.ts
export interface Campaign {
  campaign_id: number;
  project_id: number;
  template_id: number;
  name: string;
  description: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}