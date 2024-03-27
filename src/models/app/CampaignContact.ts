// src/models/CampaignContact.ts
export interface CampaignContact {
  campaign_id: number;
  contact_id: number;
  sent_at: Date;
  status: string;
}
