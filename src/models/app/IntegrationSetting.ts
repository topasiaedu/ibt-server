// src/models/IntegrationSetting.ts
export interface IntegrationSetting {
  integration_id: number;
  user_id: string;
  integration_type: string;
  settings: object; // Assuming JSON object; adjust as necessary
}
