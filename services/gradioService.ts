
import { Client } from "@gradio/client";

// Cache connected clients to avoid re-handshaking on every request where possible
const clientCache = new Map<string, any>();

export interface GradioOptions {
    hfToken?: string;
}

/**
 * Connects to a Gradio Space (or private endpoint) via the JS Client.
 * Handles caching and authentication tokens.
 */
export const getGradioClient = async (spaceId: string, options?: GradioOptions): Promise<any> => {
    // If we have a cached client for this space, return it.
    // Note: If tokens change, we might ideally want to invalidate, but for this app's session scope it's fine.
    if (clientCache.has(spaceId)) {
        return clientCache.get(spaceId);
    }

    try {
        const connectOptions = options?.hfToken 
            ? { hf_token: options.hfToken as `hf_${string}` } 
            : {};
            
        const client = await Client.connect(spaceId, connectOptions as any);
        clientCache.set(spaceId, client);
        return client;
    } catch (error: any) {
        console.error(`[GradioService] Failed to connect to Space: ${spaceId}`, error);
        let errorMessage = `Failed to connect to AI Service (${spaceId}).`;
        if (error.message) {
            if (error.message.includes("Space is sleeping")) {
                errorMessage = "The AI service is sleeping. Please wait ~60 seconds for it to wake up and try again.";
            } else if (error.message.includes("Space metadata could not be loaded") || error.message.includes("403")) {
                 errorMessage = "Access denied. This may be due to Hugging Face throttling or an invalid token. Please check your account status and API key in Settings.";
            } else {
                 errorMessage += ` Reason: ${error.message}`;
            }
        }
        throw new Error(errorMessage);
    }
};

/**
 * Generates an image using the external Image Studio (MCP) Gradio API.
 * @param prompt The text prompt for image generation.
 * @param hfToken Optional Hugging Face token for authentication.
 * @returns A promise that resolves to the generated image as a Blob.
 */
export const generateImageMCP = async (prompt: string, hfToken?: string): Promise<Blob> => {
    const MCP_URL = 'https://edbanshee-wan22-14b-lightning-14b-i2v-ui.hf.space/gradio_api/mcp/';

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (hfToken) {
        headers['Authorization'] = `Bearer ${hfToken}`;
    }

    // Standard Gradio API payload format
    const payload = {
        "data": [
            prompt,
            "low quality, blurry, watermark, text", // Default negative prompt
            7.5, // guidance_scale
            25, // num_inference_steps
            1024, // width
            1024, // height
            -1 // seed (-1 for random)
        ]
    };

    const response = await fetch(MCP_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP Tool request failed with status ${response.status}: ${errorText}`);
    }

    const json = await response.json();
    
    if (json.data && Array.isArray(json.data) && json.data[0]) {
        const output = json.data[0];
        let imageUrl: string;

        if (typeof output === 'string' && output.startsWith('http')) {
            imageUrl = output;
        } else if (typeof output === 'object' && output.url) {
            imageUrl = output.url;
        } else {
            // Handle cases where it might be a different structure
            const potentialUrl = (output as any)?.image?.url || (output as any)?.path;
            if (potentialUrl) {
                imageUrl = potentialUrl;
            } else {
                 throw new Error('MCP Tool returned an unexpected data format.');
            }
        }

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download the generated image from ${imageUrl}`);
        }
        return imageResponse.blob();

    } else {
        throw new Error('MCP Tool did not return valid data.');
    }
};


/**
 * Helper to directly run a prediction against a Gradio endpoint.
 */
export const predictGradio = async (spaceId: string, endpoint: string, payload: any, options?: GradioOptions): Promise<any> => {
    const client = await getGradioClient(spaceId, options);
    return await client.predict(endpoint, payload);
};
