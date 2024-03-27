// messageTypes.ts
export interface TextMessage {
  messaging_product: string;
  to: string;
  text: {
    body: string;
  };
}

export interface MediaMessage {
  messaging_product: string;
  to: string;
  type: 'image' | 'audio' | 'video' | 'document';
  media_id: string; // Assume media uploaded and ID obtained
}

// Extend this file with other specific message types as needed, e.g., location, interactive, etc.
