// src/models/PhoneNumber.ts
export interface PhoneNumber {
  phone_number_id: number;
  project_id: number;
  number: string;
  wabaid?: string;
  created_at: Date;
}
