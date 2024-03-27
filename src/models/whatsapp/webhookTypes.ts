// webhookTypes.ts
export interface WebhookEvent {
  object: string;
  entry: Entry[];
}

export interface Entry {
  id: string;
  changes: Change[];
}

export interface Change {
  field: string;
  value: any; // This can be further detailed into specific event types
}

// You can expand upon these basic types with more specific event details as needed.
