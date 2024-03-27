// templateTypes.ts
export interface TemplateMessage {
  messaging_product: string;
  to: string;
  type: 'template';
  template: {
    name: string;
    language: {
      code: string;
    };
    components: TemplateComponent[];
  };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
}

export type TemplateParameter = TextParameter | MediaParameter;

export interface TextParameter {
  type: 'text';
  text: string;
}

export interface MediaParameter {
  type: 'image' | 'video' | 'document';
  media_id: string;
}
