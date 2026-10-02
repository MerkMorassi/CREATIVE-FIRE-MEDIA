import { getGradioClient } from './gradioService';
import { getVoiceLabUrl, getHfApiKey } from './apiKeyService';

export interface ChatterboxRequest {
    text: string;
    audioRef: string; // Base64 Data URL
    exaggeration: number;
    temperature: number;
    seed_num: number;
    cfg_weight: number;
}

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
};

export const ChatterboxService = {
    async synthesize(req: ChatterboxRequest): Promise<ArrayBuffer> {
        const spaceUrl = getVoiceLabUrl();
        const hfToken = getHfApiKey() || undefined;

        if (!spaceUrl) {
            throw new Error("Voice Lab (Chatterbox) URL is not configured. Please set it in System Settings.");
        }

        console.log(`[Chatterbox] Connecting to: ${spaceUrl}`);
        const client = await getGradioClient(spaceUrl, { hfToken });

        const audioBlob = await dataUrlToBlob(req.audioRef);
        
        // This is a common signature for XTTSv2 Gradio spaces.
        // It's a reasonable assumption given the context of voice cloning.
        // We adapt the parameters from the original mock to this more standard signature.
        const payload = [
            req.text,          // text
            "en",              // language
            audioBlob,         // speaker_wav
            0.7,               // top_p (default)
            50,                // top_k (default)
            req.temperature,   // temperature
            1.0,               // length_penalty (default)
            2.0,               // repetition_penalty (default)
            1.0,               // speed (default)
            true               // enable_text_splitting
        ];

        console.log("[Chatterbox] Sending payload to Gradio endpoint '/predict' or '/synthesize'.");
        
        let result;
        try {
            // Most modern spaces use a named endpoint, but we'll try the legacy '/predict' first.
            result = await client.predict("/predict", payload);
        } catch (e) {
            console.warn("'/predict' endpoint failed, trying '/synthesize'...", e);
            try {
                // Some older or custom spaces might use this endpoint name
                result = await client.predict("/synthesize", payload);
            } catch (e2) {
                console.error("Both /predict and /synthesize failed.", e2);
                throw new Error("Could not find a valid API endpoint on the Gradio space. Tried /predict and /synthesize.");
            }
        }
        
        // The output from XTTS is usually at index 1 and is an object with a URL.
        if (result && result.data && result.data[1]) {
            let audioUrl = result.data[1];
            if (typeof audioUrl === 'object' && audioUrl.url) {
                audioUrl = audioUrl.url;
            }

            if (typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
                const response = await fetch(audioUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch synthesized audio from: ${audioUrl}`);
                }
                console.log("[Chatterbox] Synthesis successful, downloading audio buffer.");
                return await response.arrayBuffer();
            }
        }

        console.error("Invalid response from Voice Lab service:", result);
        throw new Error("Invalid response from Voice Lab service. Expected an audio file URL in the response data.");
    }
};
