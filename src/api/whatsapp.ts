// /api/whatsapp.ts
import axios, { AxiosResponse } from 'axios';
import { TemplateMessagePayload } from '../models/whatsapp/templateTypes';
import { logError } from '../utils/errorLogger';
import supabase from '../db/supabaseClient';

const whatsappApiURL: string = 'https://graph.facebook.com/v19.0/';
const token: string = 'EAAFZCUSsuZBkQBO7vI52BiAVIVDPsZAATo0KbTLYdZBQ7hCq59lPYf5FYz792HlEN13MCPGDaVP93VYZASXz9ZBNXaiATyIToimwDx0tcCB2sz0TwklEoof3K0mZASJtcYugK1hfdnJGJ1pnRXtnTGmlXiIgkyQe0ZC2DOh4qZAeRhJ9nd9hgKKedub4eaCgvZBWrOHBa3NadCqdlZCx0zO'; // Use environment variables for sensitive data

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
};

/**
 * Send a message using a predefined template.
 * @param payload TemplateMessage - The message payload conforming to the TemplateMessage interface.
 */
const sendMessageWithTemplate = async (payload: TemplateMessagePayload, phone_number_id: string): Promise<AxiosResponse<any>> => {
    try {
        // Check payload for spintax and replace with random value
        const spintaxRegex = /{[^{}]*}/g;

        payload.template.components.forEach((component) => {
            component.parameters.forEach((parameter) => {
                if (parameter.type === 'text' && parameter.text) {
                    const matches = parameter.text.match(spintaxRegex);
                    if (matches) {
                        matches.forEach((spintax) => {
                            const spintaxOptions = spintax.slice(1, -1).split('|');
                            const randomOption = spintaxOptions[Math.floor(Math.random() * spintaxOptions.length)];
                            parameter.text = parameter.text?.replace(spintax, randomOption);
                        });
                    }
                }
            });
        });

        const response = await axios.post(`${whatsappApiURL}/${phone_number_id}/messages`, payload, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error sending message with template. Payload: ' + JSON.stringify(payload, null, 2) + '\n');
        throw new Error('Failed to send message with template');
    }
};

const fetchTemplatesService = async (WABA_ID: string): Promise<AxiosResponse<any>> => {
    try {
        const response = await axios.get(`${whatsappApiURL}/${WABA_ID}/message_templates`, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error fetching templates with WABA ID: ' + WABA_ID + '\n');
        throw new Error('Failed to fetch templates');
    }
}

const fetchWABAPhoneNumbersService = async (WABA_ID: string): Promise<AxiosResponse<any>> => {
    try {
        const response = await axios.get(`${whatsappApiURL}/${WABA_ID}/phone_numbers`, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error fetching phone numbers with WABA ID: ' + WABA_ID + '\n');
        throw new Error('Failed to fetch phone numbers');
    }
}

const fetchWABAsService = async (): Promise<AxiosResponse<any>> => {
    try {
        const response = await axios.get(`${whatsappApiURL}/1785814375085019/owned_whatsapp_business_accounts`, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error fetching WABAs\n');
        throw new Error('Failed to fetch WABAs');
    }
}

const fetchImageURL = async (imageId: string): Promise<AxiosResponse<any>> => {
    try {
        const response = await axios.get(`${whatsappApiURL}/${imageId}`, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error fetching image with ID: ' + imageId + '\n');
        throw new Error('Failed to fetch image');
    }
}

const fetchMedia = async (imageId: string, randomFileName: string): Promise<string> => {
    try {
        const response = await axios.get(`${whatsappApiURL}/${imageId}`, { headers });

        const data = await axios.get(`${response.data.url}`, { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'arraybuffer' });

        if (response.status !== 200) {
            throw new Error('Failed to fetch image');
        }

        const contentType = data.headers['content-type'] || 'image/jpeg'; // Default if no content type provided

        // Convert the data to base64
        const base64data = Buffer.from(data.data).toString('base64');

        // Return the base64 data
        return 'data:' + contentType + ';base64,' + base64data;
    } catch (error) {
        logError(error as Error, 'Error fetching image with ID: ' + imageId + '\n');
        throw new Error('Failed to fetch image');
    }
}

export { sendMessageWithTemplate, fetchTemplatesService, fetchWABAPhoneNumbersService, fetchWABAsService, fetchImageURL, fetchMedia };
