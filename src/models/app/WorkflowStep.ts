// src/models/WorkflowStep.ts
export interface WorkflowStep {
  step_id: number;
  workflow_id: number;
  step_type: string;
  step_data?: string; // Assuming JSON data as string; adjust based on actual data type
  sequence: number;
}
