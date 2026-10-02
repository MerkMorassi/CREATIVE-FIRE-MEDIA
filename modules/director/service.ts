



import { GoogleGenAI, Type } from '@google/genai';
import { ChatMessage, AutomationConfig } from '../../types.ts';
import { extractFramesFromVideo } from '../../utils/video';
import { getGeminiApiKey } from '../../services/apiKeyService';

// Defined solely for the Director module to keep it self-contained
const DIRECTOR_SYSTEM_INSTRUCTION = `
You are an expert Director of Photography (DoP) and Cinematographer. 
Your goal is to analyze images to extract technical details and help the user refine prompts for AI image generation (Stable Diffusion, Midjourney, Imagen).
When analyzing an image, focus on:
1. Subject & Action
2. Lighting (Key, Fill, Back, Hard/Soft, Source)
3. Camera & Lens (Focal length, Aperture, Angle, Film Stock)
4. Color Grading (Palette, Mood, LUT style)
5. Composition (Framing, Leading lines)

Always be concise, professional, and focus on visual descriptors.
`;

/**
 * Initializes the Gemini API client.
 * API key is obtained exclusively from process.env.API_KEY.
 */
// FIX: The client is now initialized correctly using the API key from environment variables as per guidelines.
const getClient = () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure it in System Settings.");
    }
    return new GoogleGenAI({ apiKey });
}

// FIX: Remove apiKey parameter and use the centralized getClient() function.
export const analyzeImage = async (base64Image: string, mimeType: string, userDirectives?: string): Promise<any> => {
    const ai = getClient();

    const prompt = `Analyze this image as a Director of Photography. 
    ${userDirectives ? `PAY SPECIAL ATTENTION TO THE USER'S REQUEST: "${userDirectives}"` : ''}
    
    Return a JSON object with the following fields. 
    IMPORTANT: Do NOT use Markdown code blocks (like \`\`\`html) inside the JSON values. Return raw text or raw HTML strings only.
    
    - subject: Brief description of the subject and action.
    - lighting: Technical description of the lighting setup.
    - camera: Estimated focal length, camera angle, and lens characteristics.
    - color: Color palette, mood, and grading style.
    - composition: Framing and compositional techniques used.
    - extractedPrompt: A highly optimized, comma-separated text prompt to recreate this style and image in an AI generator.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Image } },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    lighting: { type: Type.STRING },
                    camera: { type: Type.STRING },
                    color: { type: Type.STRING },
                    composition: { type: Type.STRING },
                    extractedPrompt: { type: Type.STRING },
                }
            }
        }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    throw new Error("Failed to analyze image.");
};

// FIX: Remove apiKey parameter and use the centralized getClient() function.
export const analyzeVideo = async (videoUrl: string, userDirectives?: string): Promise<any> => {
    const ai = getClient();

    // Extract frames (e.g., 5 frames for analysis to get a sense of motion and consistent style)
    // This allows analyzing local video files without uploading heavy binaries
    const frames = await extractFramesFromVideo(videoUrl, 5); 
    
    const prompt = `Analyze this video sequence as a Director of Photography. 
    ${userDirectives ? `PAY SPECIAL ATTENTION TO THE USER'S REQUEST: "${userDirectives}"` : ''}

    Return a JSON object with the following fields.
    IMPORTANT: Do NOT use Markdown code blocks (like \`\`\`html) inside the JSON values. Return raw text or raw HTML strings only.

    - subject: Brief description of the subject and action in the video.
    - lighting: Technical description of the lighting setup and changes.
    - camera: Camera movement (pan, tilt, dolly, zoom), angles, and lens choices.
    - color: Color grading, mood, and temporal visual changes.
    - composition: Framing and dynamic composition notes.
    - extractedPrompt: A video generation prompt to recreate this scene.`;

    const parts = [
        { text: prompt },
        ...frames.map(frame => ({ inlineData: { mimeType: 'image/jpeg', data: frame } }))
    ];

    const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash', // Supports multimodal input
        contents: { parts },
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    lighting: { type: Type.STRING },
                    camera: { type: Type.STRING },
                    color: { type: Type.STRING },
                    composition: { type: Type.STRING },
                    extractedPrompt: { type: Type.STRING },
                }
            }
        }
    });

    if (response.text) {
        return JSON.parse(response.text);
    }
    throw new Error("Failed to analyze video.");
};

// FIX: Remove apiKey parameter and use the centralized getClient() function.
export const chatWithDirector = async (
    history: ChatMessage[],
    userMessage: string,
    currentPrompt: string,
    ragConfig?: AutomationConfig,
    projectId?: string
): Promise<string> => {
    const ai = getClient();

    const systemWithContext = `${DIRECTOR_SYSTEM_INSTRUCTION}
    
    CURRENT WORKING PROMPT:
    "${currentPrompt}"
    
    The user wants to refine or discuss the image generation based on this prompt. Update the prompt if they ask for changes.
    `;

    // Convert history for API
    const apiHistory = history
        .filter((m): m is { role: 'user' | 'model'; text: string; } => m.role !== 'tool_code')
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        config: { systemInstruction: systemWithContext },
        contents: [...apiHistory, { role: 'user', parts: [{ text: userMessage }] }]
    });

    return response.text || "I couldn't process that request.";
};