// /api/whatsapp.ts
import axios, { AxiosResponse } from 'axios';
import { TemplateMessage } from '../models/whatsapp/templateTypes';
import { TextMessage } from '../models/whatsapp/messageTypes';

const whatsappAPIURL: string = 'https://your-whatsapp-business-api-endpoint';
const token: string = 'your_access_token'; // Use environment variables for sensitive data

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

/**
 * Send a message using a predefined template.
 * @param payload TemplateMessage - The message payload conforming to the TemplateMessage interface.
 */
const sendMessageWithTemplate = async (payload: TemplateMessage): Promise<AxiosResponse<any>> => {
    try {
        const response = await axios.post(`${whatsappAPIURL}/v1/messages`, payload, { headers });
        return response;
    } catch (error) {
        console.error('Error sending template message:', error);
        throw new Error('Failed to send template message');
    }
};

/**
 * Send a simple text message.
 * @param to string - The recipient's phone number.
 * @param body string - The text message body.
 */
const sendTextMessage = async (to: string, body: string): Promise<AxiosResponse<any>> => {
    const payload: TextMessage = {
        messaging_product: "whatsapp",
        to,
        text: { body }
    };

    try {
        const response = await axios.post(`${whatsappAPIURL}/v1/messages`, payload, { headers });
        return response;
    } catch (error) {
        console.error('Error sending text message:', error);
        throw new Error('Failed to send text message');
    }
};

export { sendMessageWithTemplate, sendTextMessage };
