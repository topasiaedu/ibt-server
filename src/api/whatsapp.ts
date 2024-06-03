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

// {
// 	"messaging_product": "whatsapp",
// 	"recipient_type": "individual",
// 	"to": "60139968817",
// 	"type": "text",
// 	"text": {
// 		"body": "755825213338648"
// 	}
// }

export type MessagePayload = {
    messaging_product: string;
    recipient_type: string;
    to: string;
    type: string;
    text: {
        body: string;
    }
}


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

const sendMessage = async (payload: MessagePayload, phone_number_id: string): Promise<AxiosResponse<any>> => {
    try {
        const response = await axios.post(`${whatsappApiURL}/${phone_number_id}/messages`, payload, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error sending message. Payload: ' + JSON.stringify(payload, null, 2) + '\n');
        throw new Error('Failed to send message');
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
        console.error('Error fetching WABAs:', JSON.stringify(error, null, 2));
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

const fetchMedia = async (imageId: string, randomFileName: string) => {
    try {
        // Assume axios and headers are set up previously
        const response = await axios.get(`${whatsappApiURL}/${imageId}`, { headers });

        // Fetch the actual image data as a buffer
        const data = await axios.get(response.data.url, {
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'arraybuffer'
        });

        if (response.status !== 200) {
            throw new Error('Failed to fetch image');
        }

        const contentType = data.headers['content-type'] || 'image/jpeg'; // Default if no content type is provided

        // Upload the buffer directly to Supabase storage
        const { data: uploadData, error } = await supabase.storage
            .from('media')
            .upload(randomFileName, data.data, {
                contentType: contentType,
                upsert: true
            });

        if (error) throw error;

        return `https://yvpvhbgcawvruybkmupv.supabase.co/storage/v1/object/public/media/` + uploadData.path;
    } catch (error) {
        console.error('Error fetching or uploading image with ID:', imageId, error);
        throw new Error('Failed to fetch or upload image');
    }
}

const subscribeWebhook = async (WABA_ID: string) => {
    // https://graph.facebook.com/v19.0/278010752057306/subscribed_apps
    try {
        const response = await axios.post(`${whatsappApiURL}/${WABA_ID}/subscribed_apps?access_token=${token}`, {}, { headers });
        return response;
    } catch (error) {
        logError(error as Error, 'Error subscribing webhook with WABA ID: ' + WABA_ID + '\n');
        throw new Error('Failed to subscribe webhook');
    }
}

export { sendMessageWithTemplate, fetchTemplatesService, fetchWABAPhoneNumbersService, fetchWABAsService, fetchImageURL, fetchMedia, subscribeWebhook, sendMessage };
