
import { GoogleGenAI, FunctionDeclaration, Type, Content, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { GemmaConfig, Message, StreamChunk } from '../../types.ts';
import { fetchModels } from '../../services/geminiService.ts';

const getToolDefinitions = (allowedTools: string[]): { functionDeclarations: FunctionDeclaration[] }[] | undefined => {
    if (allowedTools.length === 0) return undefined;
    const functions: FunctionDeclaration[] = [];

    if (allowedTools.includes('web_search')) {
        functions.push({
            name: 'web_search',
            description: 'Search the internet for information.',
            parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING, description: 'The search query' } }, required: ['query'] },
        });
    }
    if (allowedTools.includes('calculator')) {
        functions.push({
            name: 'calculator',
            description: 'Calculate math expressions.',
            parameters: { type: Type.OBJECT, properties: { expression: { type: Type.STRING, description: 'The math expression to evaluate' } }, required: ['expression'] },
        });
    }
    if (allowedTools.includes('filesystem')) {
        functions.push({ name: 'list_files', description: 'List all files in the virtual file system.', parameters: { type: Type.OBJECT, properties: {}, required: [] } });
        functions.push({
            name: 'read_file',
            description: 'Read the content of a specific file by its ID or name.',
            parameters: { type: Type.OBJECT, properties: { file_id: { type: Type.STRING, description: 'The ID or name of the file to read' } }, required: ['file_id'] },
        });
        functions.push({
            name: 'write_file',
            description: 'Create or overwrite a file in the virtual file system.',
            parameters: { type: Type.OBJECT, properties: { filename: { type: Type.STRING, description: 'The name of the file' }, content: { type: Type.STRING, description: 'The content to write' } }, required: ['filename', 'content'] },
        });
    }
    if (allowedTools.includes('image_generation')) {
        functions.push({
            name: 'image_generation',
            description: 'Generate an image based on a descriptive prompt.',
            parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: 'A detailed description of the image to create.' } }, required: ['prompt'] },
        });
    }
    if (allowedTools.includes('video_generation')) {
        functions.push({
            name: 'video_generation',
            description: 'Generate a short video based on a descriptive prompt.',
            parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: 'A detailed description of the video to create.' } }, required: ['prompt'] },
        });
    }
    if (allowedTools.includes('generate_speech')) {
        functions.push({
            name: 'generate_speech',
            description: "Synthesize speech from text using the current agent's cloned voice. Requires a pre-uploaded voice seed.",
            parameters: { type: Type.OBJECT, properties: { text: { type: Type.STRING, description: 'The text to convert to speech.' } }, required: ['text'] },
        });
    }
    if (allowedTools.includes('delegate_to_dolphin')) {
        functions.push({
            name: 'delegate_to_dolphin',
            description: 'Delegate a complex or uncensored prompt to the MythOS Dolphin model for a response.',
            parameters: { type: Type.OBJECT, properties: { prompt: { type: Type.STRING, description: 'The prompt to send to the Dolphin model.' } }, required: ['prompt'] },
        });
    }
    if (allowedTools.includes('switch_model_and_query')) {
        functions.push({
            name: 'switch_model_and_query',
            description: 'Delegate a query to another specialized agent. Use this when the user asks for something another agent is better at, for example, using a code-generation agent for a programming task, or an uncensored agent for a sensitive topic.',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    target_model_id: { type: Type.STRING, description: 'The ID of the agent to delegate to (e.g., "MYTHOS_DOLPHIN").' },
                    query: { type: Type.STRING, description: "The user's query to send to the target agent." },
                },
                required: ['target_model_id', 'query'],
            },
        });
    }
    if (allowedTools.includes('share_media')) {
        functions.push({
            name: 'share_media',
            description: "Share a media asset (image or video) with the user from the agent's media library.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    media_id: { type: Type.STRING, description: "The ID of the media asset to share. First, use list_files to find media." },
                    caption: { type: Type.STRING, description: "An optional caption to include with the media." },
                },
                required: ['media_id'],
            },
        });
    }


    if (functions.length === 0) return undefined;
    return [{ functionDeclarations: functions }];
};

/**
 * A client for interacting with the Google Gemini API.
 * This class encapsulates all the logic for making requests to Gemini,
 * including checking connections, listing models, generating embeddings,
 * and streaming chat responses with tool support.
 * It is designed to be a standalone module for use in any TypeScript application.
 */
class GeminiClient {
    /**
     * Verifies if the provided API key is valid by attempting to list models.
     * @param {string} apiKey The Google Gemini API key.
     * @returns {Promise<boolean>} A promise that resolves to true if the connection is successful, false otherwise.
     */
    async checkConnection(apiKey: string): Promise<boolean> {
        if (!apiKey) return false;
        try {
            // Use the new, working listModels method to validate the key.
            await this.listModels(apiKey);
            return true;
        } catch (e) {
            console.error("Gemini API key check failed:", e);
            return false;
        }
    }
    
    /**
     * Fetches a list of available Gemini models that support content generation.
     * @param {string} apiKey The Google Gemini API key.
     * @returns {Promise<{ name: string, displayName: string }[]>} A promise that resolves to an array of model objects.
     * @throws An error if the API key is missing or the request fails.
     */
    async listModels(apiKey: string): Promise<{ name: string, displayName: string }[]> {
        if (!apiKey) {
            throw new Error("API Key is required to fetch models.");
        }
        
        try {
            // FIX: Replaced the failing raw `fetch` call with the stable, hardcoded model provider
            // from `geminiService.ts`. This resolves the "invalid argument" error and unifies
            // the source of available models within the application.
            const models = await fetchModels();
            // Map the format from { id, name } to the expected { name, displayName }.
            return models.map(m => ({ name: m.id, displayName: m.name }));
        } catch (error) {
            console.error("Failed to list Gemini models:", error);
            throw error;
        }
    }

    /**
     * Generates a vector embedding for a given text using the 'text-embedding-004' model.
     * @param {string} text The text to generate an embedding for.
     * @param {string} apiKey The Google Gemini API key.
     * @returns {Promise<number[]>} A promise that resolves to an array of numbers representing the embedding.
     * @throws An error if the API key is missing.
     */
    async generateEmbedding(text: string, apiKey: string): Promise<number[]> {
        if (!apiKey) throw new Error("Gemini API key is missing.");
        const ai = new GoogleGenAI({ apiKey });
        const model = 'text-embedding-004'; // Recommended model for embeddings
        const result = await ai.models.embedContent({
            model,
            content: { parts: [{ text }] },
        });
        return result.embedding.values;
    }

    /**
     * Streams a chat response from the Gemini model based on a conversation history and configuration.
     * Handles system instructions, tool calls, multi-modal inputs, and safety settings automatically.
     * @param {Message[]} messages An array of messages representing the conversation history.
     * @param {GemmaConfig} config The configuration for the generation, including model name, API key, and parameters.
     * @returns {AsyncGenerator<StreamChunk, void, unknown>} An async generator that yields stream chunks of type 'text' or 'tool_call'.
     * @throws An error if the API key is missing.
     */
    async *streamChat(messages: Message[], config: GemmaConfig): AsyncGenerator<StreamChunk, void, unknown> {
        const { modelName, apiKey, parameters, tools } = config;
        if (!apiKey) throw new Error("Gemini API key is missing.");

        const ai = new GoogleGenAI({ apiKey });

        const contents: Content[] = [];
        for (const m of messages) {
            switch (m.role) {
                case 'user':
                    const userParts: any[] = [];
                    if (m.content) {
                        userParts.push({ text: m.content });
                    }
                    if (m.images && m.images.length > 0) {
                        m.images.forEach(imgBase64 => {
                            userParts.push({
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: imgBase64,
                                }
                            });
                        });
                    }
                    if (userParts.length > 0) {
                        contents.push({ role: 'user', parts: userParts });
                    }
                    break;
                
                case 'assistant':
                    const modelParts: any[] = [];
                    if (m.content) {
                         modelParts.push({ text: m.content });
                    }
                    if (m.toolCalls && m.toolCalls.length > 0) {
                        m.toolCalls.forEach(tc => {
                            modelParts.push({
                                functionCall: {
                                    name: tc.name,
                                    args: tc.args,
                                }
                            });
                        });
                    }
                    if (modelParts.length > 0) {
                        contents.push({ role: 'model', parts: modelParts });
                    }
                    break;

                case 'tool':
                    if (m.name) {
                        contents.push({
                            role: 'tool',
                            parts: [{
                                functionResponse: {
                                    name: m.name,
                                    response: {
                                        result: m.content,
                                    },
                                }
                            }]
                        });
                    }
                    break;

                case 'system':
                    // Handled separately by the systemInstruction parameter
                    break;
            }
        }
        
        const systemInstruction = messages.find(m => m.role === 'system')?.content;
        const geminiTools = getToolDefinitions(tools.allowedTools);

        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ];

        const result = await ai.models.generateContentStream({
            model: modelName,
            contents,
            config: {
                ...(systemInstruction && { systemInstruction }),
                ...(geminiTools && { tools: geminiTools }),
                temperature: parameters.temperature,
                topP: parameters.top_p,
                topK: parameters.top_k,
                maxOutputTokens: parameters.num_predict,
            },
            safetySettings,
        });

        for await (const chunk of result) {
            const text = chunk.text;
            if (text) {
                yield { type: 'text', content: text };
            }

            const functionCalls = chunk.functionCalls;
            if (functionCalls) {
                for (const fc of functionCalls) {
                     yield {
                        type: 'tool_call',
                        toolCall: {
                            id: `gemini-tool-${fc.name}-${Date.now()}`, 
                            name: fc.name,
                            args: fc.args,
                        }
                    };
                }
            }
        }
    }
}

export const geminiClient = new GeminiClient();