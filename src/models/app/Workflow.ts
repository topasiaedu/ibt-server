// src/models/Workflow.ts
export interface Workflow {
  workflow_id: number;
  user_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
}
