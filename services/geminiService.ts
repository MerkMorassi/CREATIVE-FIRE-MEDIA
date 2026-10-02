




import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Content, Type, Modality, FunctionDeclaration } from "@google/genai";
import { MythosData } from './mythosData';
import { CONTENT_GUIDELINES } from './contentGuidelines';
import { getGeminiApiKey } from './apiKeyService';
import { GenerationOptions } from '../types';

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const getClient = () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure it in System Settings.");
    }
    return new GoogleGenAI({ apiKey });
}

export const mythosTools: FunctionDeclaration[] = [
    {
        name: 'prepareMythosImageGeneration',
        description: 'Prepares the MythOS Cinematic image generation engine with a specific, highly detailed prompt. This navigates the user to the correct studio to execute the generation.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                prompt: {
                    type: Type.STRING,
                    description: 'A detailed, comma-separated text prompt for the image generator, including subject, action, environment, and specific cinematic style keywords.'
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'generateMythosImage',
        description: 'Generates a high-quality cinematic image using the MythOS engine and displays it directly to the user in the chat. Use this when the user explicitly asks to create, make, show, or generate an image.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                prompt: {
                    type: Type.STRING,
                    description: 'A detailed, comma-separated text prompt for the image generator, describing the desired visual in cinematic terms.'
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'generateMythosVideo',
        description: 'Generates a high-quality cinematic video, animation, or clip using the MythOS engine. Use this when the user explicitly asks to create, make, show, or generate a video.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                prompt: {
                    type: Type.STRING,
                    description: 'A detailed, comma-separated text prompt for the video generator, describing the desired visual and motion in cinematic terms.'
                }
            },
            required: ['prompt']
        }
    },
    {
        name: 'list_my_media',
        description: 'List all media assets in your private gallery, showing their IDs and descriptions.',
        parameters: { type: Type.OBJECT, properties: {}, required: [] }
    },
    {
        name: 'share_media_from_gallery',
        description: "Share a media asset from your private gallery directly into the chat. Use 'list_my_media' first to find the ID.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                media_id: { type: Type.STRING, description: 'The ID of the media asset to share.' },
                caption: { type: Type.STRING, description: 'An optional caption to include with the media.' }
            },
            required: ['media_id']
        }
    },
    {
        name: 'lorepack_search',
        description: "Searches the agent's private LOREPACK (lived experience, memory) to find context relevant to a user's query. Use this to answer questions about past events, specific knowledge, or personal history.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "The user's question or topic to search for in the LOREPACK."
                }
            },
            required: ['query']
        }
    }
];

const apiCallWithRetry = async <T>(apiFunction: () => Promise<T>, maxRetries = 3): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiFunction();
        } catch (error: any) {
            // Don't retry if it's an auth error
            if (error.message && (error.message.includes("API Key") || error.status === 403 || error.status === 401)) {
                throw error;
            }
            if (attempt === maxRetries - 1) {
                throw error;
            }
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.warn(`[API Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error("API call failed after multiple retries.");
};

export const generateImageFromGemini = async (options: GenerationOptions): Promise<Blob> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();

        if (options.geminiModel === 'imagen-4.0-generate-001') {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: options.prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                    aspectRatio: options.aspectRatio,
                    seed: options.seed ? parseInt(options.seed) : undefined,
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const base64 = response.generatedImages[0].image.imageBytes;
                const res = await fetch('data:image/png;base64,' + base64);
                return await res.blob();
            }
            throw new Error("Imagen 4 generation failed to return an image.");
        } else { // Gemini series models (e.g. gemini-3.1-flash-lite-image, gemini-3.1-flash-image, gemini-3-pro-image, gemini-2.5-flash-image)
            const modelToUse = options.geminiModel || 'gemini-3.1-flash-lite-image';
            const response = await ai.models.generateContent({
                model: modelToUse,
                contents: { parts: [{ text: options.prompt }] },
                config: {
                    imageConfig: {
                        aspectRatio: options.aspectRatio === '2.39:1' ? '16:9' : (options.aspectRatio as any),
                    },
                    seed: options.seed ? parseInt(options.seed) : undefined,
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart && imagePart.inlineData) {
                const base64 = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType;
                const res = await fetch(`data:${mimeType};base64,${base64}`);
                return await res.blob();
            }
            throw new Error(`Gemini Image generation with ${modelToUse} failed to return an image part.`);
        }
    });
};

export interface ScribeInput {
  workingTitle: string;
  genre: string;
  theme: string;
  setting: string;
  tone: string;
  cast: string;
  beatSheet: string;
  logline: string;
  treatment: string;
  fundamentalStoryQuestions: string;
  archetypalCharacters: string;
  sceneGenerationQuestions: string;
  positiveConstraints?: string;
  negativeConstraints?: string;
  rating?: string; 
  format?: string; 
  dynamicLists?: any[];
}

export interface ScribeOutlineInput {
  title: string;
  genre: string;
  theme: string;
  setting: string;
  tone: string;
  cast: string;
  beatSheet: string;
  positiveConstraints?: string;
  negativeConstraints?: string;
  rating?: string; 
  format?: string; 
  dynamicLists?: any[];
}

export interface ScribeOutlineOutput {
  workingTitle: string;
  logline: string;
  treatment: string;
  fundamentalStoryQuestions: string[];
  archetypalCharacters: string[];
  sceneGenerationQuestions: string[];
}

const getScribeSystemPrompt = (pos?: string, neg?: string, rating?: string, format?: string, dynamicLists?: any[]) => {
    let ratingPrompt = "";
    if (rating && rating !== "none" && CONTENT_GUIDELINES.RATINGS[rating as keyof typeof CONTENT_GUIDELINES.RATINGS]) {
        const rData = CONTENT_GUIDELINES.RATINGS[rating as keyof typeof CONTENT_GUIDELINES.RATINGS];
        ratingPrompt = `
/******************************************************************************
 * CRITICAL PRODUCTION MANDATE: CONTENT RATING ${rating}
 ******************************************************************************
 ${rData.positive}
 ------------------------------------------------------------------------------
 FORBIDDEN: ${(rData as any).negative || 'None specified.'}
 *****************************************************************************/
`;
    }

    const formatPrompt = (format && format !== "none" && (CONTENT_GUIDELINES as any).FORMATS[format]) || "";

    let base = `
### ROLE
You are the MythOS Studio Screenwriter. You transform abstract blueprints into vivid, shootable screenplays.

### CRITICAL FORMATTING MANDATE: NO MARKDOWN
STRICTLY FORBIDDEN: NEVER use Markdown formatting in your output strings.
- DO NOT use hashes (#) for headers.
- DO NOT use asterisks (*) or underscores (_) for bold or italics.
- DO NOT use backticks (\`) for code blocks.
- DO NOT use markdown list symbols like - or *.

INSTEAD:
- Use ALL CAPS for headers and scene slugs.
- Use "--- SECTION NAME ---" for major divisions.
- Use simple numbering (1., 2.) for lists.
- Use plain text capitalization for emphasis.

### PRODUCTION PROTOCOLS
${ratingPrompt}
${formatPrompt}

### CREATIVE DIRECTIVES (THE "FIRE" CLAUSE)
1. **Interpretation over Adherence:** Use provided archetypes and structures as *seeds* for inspiration, not rigid laws.
2. **Subvert Expectations:** If a character is a "Hero," show their doubt. If a setting is "Sterile," find the dirt.
3. **Cinematic Style:** Prioritize visual storytelling ("Show, Don't Tell"). Use sensory details (smell, touch, sound) to ground the scene.
4. **Dialogue:** Subtext is key. Characters should rarely say exactly what they mean.

### STUDIO STANDARDS (PRIMARY OVERRIDE)
**MUST INCLUDE (User Directives):** ${pos || "Standard cinematic storytelling."}
**STRICTLY FORBIDDEN (User Directives):** ${neg || "None specified."}
`;

    if (dynamicLists && dynamicLists.length > 0) {
        base += `\n### DYNAMIC DICTIONARIES\n`;
        dynamicLists.forEach(list => {
            base += `[${list.name}]: ${list.items.join(', ')}\n`;
        });
        base += `\n**RULE:** Resolve any [BracketedTags] in the prompt by selecting a relevant item from these lists.\n`;
    }

    return base;
};

export const runScribeAgent = async (input: ScribeInput): Promise<string> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const systemInstruction = getScribeSystemPrompt(input.positiveConstraints, input.negativeConstraints, input.rating, input.format, input.dynamicLists);

        const inputBlock = `
COMMAND: WRITE SCREENPLAY SEQUENCE
TITLE: ${input.workingTitle}
GENRE: ${input.genre}
FORMAT: ${input.format}

=== CAST ===
${input.cast}

=== BEAT SHEET ===
${input.beatSheet}

TASK:
Write the screenplay scenes. 
FORMATTING RULE: STRICTLY PLAIN TEXT. NO MARKDOWN SYMBOLS (#, *, _, \`).
Use ALL CAPS for scene headers and character names.
Label as "FIRST DRAFT".
`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.1-pro-preview',
                contents: { parts: [{ text: inputBlock }] },
                config: {
                    systemInstruction,
                    maxOutputTokens: 8192,
                    temperature: 0.8,
                    safetySettings
                }
            });
            return response.text || "";
        } catch (error) {
            console.error("Scribe Agent Error:", error);
            throw error;
        }
    });
};

export const runScribeOutlineAgent = async (input: ScribeOutlineInput): Promise<ScribeOutlineOutput> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const systemInstruction = getScribeSystemPrompt(input.positiveConstraints, input.negativeConstraints, input.rating, input.format, input.dynamicLists);

        const inputBlock = `
COMMAND: GENERATE STORY OUTLINE (JSON)
RAW BLUEPRINT:
TITLE: ${input.title}
GENRE: ${input.genre}
BEATS: ${input.beatSheet}

TASK:
Filter this raw blueprint through the STUDIO STANDARDS and RATING MANDATE.
OUTPUT RULE: STRICTLY PLAIN TEXT in all string fields. NO MARKDOWN SYMBOLS (#, *, _, \`).

OUTPUT FORMAT: JSON Schema.
`;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: { parts: [{ text: inputBlock }] },
                config: {
                    maxOutputTokens: 4096,
                    systemInstruction,
                    temperature: 0.7,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            workingTitle: { type: Type.STRING },
                            logline: { type: Type.STRING },
                            treatment: { type: Type.STRING },
                            fundamentalStoryQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            archetypalCharacters: { type: Type.ARRAY, items: { type: Type.STRING } },
                            sceneGenerationQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        },
                        required: ["workingTitle", "logline", "treatment", "fundamentalStoryQuestions", "archetypalCharacters", "sceneGenerationQuestions"]
                    },
                    safetySettings
                }
            });
            return JSON.parse(response.text.trim());
        } catch (error) {
            console.error("Scribe Outline Error:", error);
            throw error;
        }
    });
};

export const extractTripletsFromText = async (text: string): Promise<{s: string, r: string, o: string}[]> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const prompt = `
          CONTEXT: ${text}
          TASK: Extract narrative relationships as triplets (Subject, Relation, Object).
          FOCUS: Identify core entities and how they connect.
          OUTPUT FORMAT: [{"s": "Subject", "r": "Relation", "o": "Object"}]
          SYSTEM: Respond with ONLY the JSON array. No explanations, no markdown.
        `;
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                s: { type: Type.STRING },
                                r: { type: Type.STRING },
                                o: { type: Type.STRING },
                            },
                            required: ['s', 'r', 'o']
                        }
                    },
                    safetySettings
                }
            });

            if (response.text) {
                return JSON.parse(response.text.trim());
            }
            return [];
        } catch (error) {
            console.error("Triplet Extraction Error:", error);
            return []; // Return empty on failure to avoid crashing the whole process
        }
    });
};


export const fetchModels = async () => [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (General Text & Quick Reasoning)' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (Complex Reasoning, Scripting, Coding)' },
    { id: 'gemma-4-27b-it', name: 'Gemma 4 27B IT (Open Weights Flagship Reasoning)' },
    { id: 'gemma-4-9b-it', name: 'Gemma 4 9B IT (Efficient & Fast Local Inference)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (High-Speed Lightweight Text)' },
    { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image (High-Quality Cinematic Imagery)' },
    { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash Lite Image (Fast Concept Design Imagery)' },
    { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image (Advanced Vision & Photorealism)' },
    { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Pro (Cinematic Full High-Definition Video)' },
    { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite (Fast Kinetic Motion Video)' },
    { id: 'lyria-3-pro-preview', name: 'Lyria 3 Pro (Full-Length Music Synthesis & Orchestration)' },
    { id: 'lyria-3-clip-preview', name: 'Lyria 3 Clip (Short Clips & Musical Atmosphere Stings)' },
    { id: 'gemini-3.8-flash-tts', name: 'Gemini 3.8 Speech Synthesis (Voice Design, Podcasting, Screenplays)' },
    { id: 'gemini-3.8-flash-lite-tts', name: 'Gemini 3.8 Speech Synthesis Lite (Fast & Efficient TTS)' },
    { id: 'gemini-3.5-transcribe', name: 'Gemini 3.5 Transcribe (Static Audio-to-Text Transcription)' },
    { id: 'gemini-3.8-live', name: 'Gemini 3.8 Live (Ultra Low-Latency Voice-to-Voice)' },
    { id: 'gemini-3.8-live-extended-thinking', name: 'Gemini 3.8 Live with Extended Thinking (Reasoning Voice)' },
    { id: 'gemini-3.5-transcribe-live', name: 'Gemini 3.5 Transcribe Live (Real-Time Audio-to-Text translation)' },
    { id: 'text-embedding-004', name: 'Text Embedding 004 (High-Density Vector Embeddings)' }
];

export const getEmbeddings = async (text: string) => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        try {
            const response = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: { parts: [{ text }] }
            });
            if (response.embedding && response.embedding.values) {
                return response.embedding.values;
            }
            console.warn("Embedding response missing values:", response);
            return null;
        } catch (e) {
            console.error("Embedding generation failed:", e);
            throw e;
        }
    });
};

export const generateText = async (prompt: string) => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [{ parts: [{ text: prompt }] }]
        });
        return response.text || "";
    });
};

export const generateSpeech = async (text: string, voice: string, rate: number) => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                    speakingRate: rate
                }
            }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    });
};

export const createChat = (systemPrompt?: string, history?: Content[], tools?: any[]) => {
    const ai = getClient();
    return ai.chats.create({ 
        model: 'gemini-3.1-pro-preview', 
        history, 
        config: { 
            systemInstruction: systemPrompt,
            safetySettings,
            tools: tools ? [{ functionDeclarations: tools }] : undefined
        } 
    });
};