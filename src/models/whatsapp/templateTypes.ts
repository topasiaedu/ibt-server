// templateTypes.ts

// Example: TemplateMessage
// {
// 	"messaging_product": "whatsapp",
// 	"recipient_type": "individual",
// 	"to": "60139968817",
// 	"type": "template",
// 	"template": {
// 		"name": "ws_1d_feb2_2moro",
// 		"language": {
// 			"code": "zh_CN"
// 		},
// 		"components": [
// 			{
// 				"type": "HEADER",
// 				"parameters": [
// 					{
// 						"type": "image",
// 						"image": {
// 							"link": "https://picsum.photos/200/300"
// 						}
// 					}
// 				]
// 			},
// 			{
// 				"type": "BODY",
// 				"parameters": [
// 					{
// 						"type": "text",
// 						"text": "Stanley"
// 					}
// 				]
// 			}
// 		]
// 	}
// }
export interface TemplateMessagePayload {
  messaging_product: string;
  recipient_type: string;
  to: string;
  type: string;
  template: Template;
}

export interface Template {
  name: string;
  language: Language;
  components?: Component[];
}

export interface Language {
  code: string;
}

export interface Component {
  type: string;
  parameters: Parameter[];
}

export interface Parameter {
  type: string;
  image?: Media;
  video?: Media;
  text?: string;
}

export interface Media {
  link: string;
}

// Example: TemplateResponse
