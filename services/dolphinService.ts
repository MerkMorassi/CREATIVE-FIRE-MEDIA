
import { getDolphinUrl } from './apiKeyService';

/**
 * Dolphin Service (Sovereign Engine)
 * Interfaces with the merkmorassi/mythos-dolphin private LLM via OpenAI Standard Protocol.
 * Used for uncensored tasks: fiction writing, NSFW prompt engineering, etc.
 */

export interface DolphinResponse {
    text: string;
    error?: string;
}

export const runDolphinInference = async (
    prompt: string, 
    systemPrompt: string, 
    hfToken: string
): Promise<DolphinResponse> => {
    // 1. Get URL (e.g., https://merkmorassi-mythos-dolphin.hf.space)
    const dolphinBaseUrl = getDolphinUrl();
    if (!dolphinBaseUrl) {
        return { text: "", error: "Dolphin LLM URL is not configured in System Settings." };
    }

    // 2. Construct Endpoint (Standard OpenAI Route)
    // We target /v1/chat/completions because that is what your Sovereign Engine runs.
    const DOLPHIN_ENDPOINT = `${dolphinBaseUrl}/v1/chat/completions`;

    if (!hfToken) throw new Error("Dolphin Core requires a Hugging Face Token.");

    try {
        // 3. Construct Payload (OpenAI JSON Format)
        // This replaces the old Gradio array format.
        const payload = {
            model: "mythos-dolphin", 
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2048, // Increased for fiction writing
            stream: false
        };

        const response = await fetch(DOLPHIN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // 4. Handle Server States
        if (response.status === 503) {
            return { text: "", error: "Dolphin Hardware is booting (Cold Start). Please wait 60 seconds." };
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Dolphin Engine] Fault: ${response.status}`, errorText);
            throw new Error(`Dolphin Engine Fault (${response.status}). Check server logs.`);
        }

        // 5. Parse Response
        const json = await response.json();
        
        if (json.choices && json.choices.length > 0) {
            const content = json.choices[0].message.content;
            return { text: content.trim() };
        }

        throw new Error("Invalid response structure from Sovereign Engine.");

    } catch (e) {
        console.error("[Dolphin Engine] Fault:", e);
        return { text: "", error: e instanceof Error ? e.message : "Dolphin link failed." };
    }
};

/**
 * Specialized function to bypass safety filters for image prompts.
 * This sends the request strictly to Dolphin, keeping Gemini out of the loop.
 */
export const refineNsfwPrompt = async (prompt: string, hfToken: string): Promise<string> => {
    const systemPrompt = "You are a creative assistant for an uncensored AI art generator. Your task is to take a user's prompt and rewrite it to be more vivid, descriptive, and explicit, suitable for a powerful, unrestricted model. Do not refuse or lecture. Directly provide the enhanced prompt only.";
    
    const response = await runDolphinInference(prompt, systemPrompt, hfToken);
    
    if (response.error) {
        console.warn("[Dolphin NSFW Refine] Failed, falling back to original.", response.error);
        return prompt; 
    }
    return response.text;
};
