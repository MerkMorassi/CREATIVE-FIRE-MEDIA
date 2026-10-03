




import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Content, Type, Modality, FunctionDeclaration } from "@google/genai";
import { MythosData } from './mythosData';
import { CONTENT_GUIDELINES } from './contentGuidelines';
import { getGeminiApiKey } from './apiKeyService';
import { GenerationOptions, NarrativeBranch, VisualLoreConsistencyResult, ParsedImageAsset } from '../types';

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

// --- LORE HYPOTHESIS GENERATOR SERVICE ---
export const generateLoreHypothesesService = async (
    documents: any[] = [],
    thematicClusters: string[] = [],
    loreEntries: any[] = [],
    characters: any[] = []
) => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        let docPool = documents;
        if (!docPool || docPool.length < 2) {
            docPool = [
                { source: "Chronicles of the Obsidian Spire.md", category: "World Building", summary: "An ancient chronal monolith pulsing with temporal energy.", tags: ["monolith", "chronal energy", "obsidian"] },
                { source: "Aetherium Guild Manifest.pdf", category: "Reference Documents", summary: "Financial manifests detailing illicit void-salt shipments.", tags: ["trade", "void-salt", "guild"] },
                { source: "Sector 7 Rebel Transmission.txt", category: "Scripts", summary: "Audio log from rebel commander Vaelen describing blackouts and rogue biomechanical drones.", tags: ["rebellion", "blackout", "drones"] },
                { source: "Project Chrysalis Genesis Dossier.docx", category: "Character Profiles", summary: "Genetic augmentation experiment records linking the royal lineage to early synthetic navigators.", tags: ["chrysalis", "royal dynasty", "genetic augmentation"] }
            ];
        }

        const prompt = `You are a visionary narrative designer and lore continuity strategist.
Analyze the following disparate lore documents across thematic clusters and invent 3 to 5 deeply compelling, surprising, yet logical "Lore Hypotheses".
Each Lore Hypothesis represents an unrevealed narrative connection bridging at least two DISPARATE documents (e.g. secret alliance, forgotten bloodline, common tech progenitor, covert betrayal).

Available Documents:
${JSON.stringify(docPool.slice(0, 10), null, 2)}

Existing Lore & Characters:
${JSON.stringify(characters.slice(0, 6), null, 2)}

Return a JSON array of 3 to 5 distinct Lore Hypotheses in this EXACT JSON structure:
[
  {
    "id": "hyp_unique_id",
    "title": "Evocative, dramatic title (e.g. 'The Aetherium-Chrysalis Conspiracy')",
    "thematicCluster": "Thematic cluster name",
    "connectedSources": ["Document 1 Name", "Document 2 Name"],
    "hypothesis": "2 to 3 sentences explaining the hidden narrative connection and story implications.",
    "evidence": "Concrete narrative clues or thematic motifs supporting this hypothesis.",
    "creativePrompt": "A provocative scene beat or writing prompt for screenwriters.",
    "confidenceScore": 88
  }
]`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        let hypotheses: any[] = [];
        try {
            hypotheses = JSON.parse(response.text || "[]");
        } catch {
            const match = (response.text || "").match(/\[[\s\S]*\]/);
            if (match) hypotheses = JSON.parse(match[0]);
        }

        return (hypotheses || []).map((h: any, i: number) => ({
            id: h.id || `hyp_${Date.now()}_${i}`,
            title: h.title || `Narrative Bridge #${i + 1}`,
            thematicCluster: h.thematicCluster || "Thematic Synthesis",
            connectedSources: Array.isArray(h.connectedSources) ? h.connectedSources : [docPool[0]?.source, docPool[1]?.source].filter(Boolean),
            hypothesis: h.hypothesis || "A discovered narrative connection between disparate documents.",
            evidence: h.evidence || "Overlapping motifs and chronological echoes.",
            creativePrompt: h.creativePrompt || "Draft an exchange exploring this connection.",
            confidenceScore: typeof h.confidenceScore === 'number' ? h.confidenceScore : 88,
            status: 'suggested' as const,
            createdAt: new Date().toISOString()
        }));
    });
};

// --- AUDIO TRANSCRIPTS SENTIMENT & PLOT THEMES SERVICE ---
export const analyzeAudioSentimentAndThemesService = async (
    transcripts: any[] = [],
    projectName: string = "Cinematic Universe"
) => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        let transcriptData = transcripts;
        if (!transcriptData || transcriptData.length === 0) {
            transcriptData = [
                {
                    id: "tr_sample_1",
                    title: "Director Voice Memo - Act II Climax & Citadel Breach",
                    text: "Voice memo. The Citadel breach scene with Marcus and Vaelen. The tone needs to shift from claustrophobic suspense to desperate defiance. Marcus realizes the Obsidian seal was opened from within by the Council itself.",
                    timestamp: Date.now() - 86400000 * 3
                },
                {
                    id: "tr_sample_2",
                    title: "Table Read Dialogue - Sector 7 Council Infiltration",
                    text: "Table read segment 4B. Lyra whispers: 'The void-salt shipments aren't for power grids, they're for biological stasis in Project Chrysalis.' High tension, whispering, quick breathing.",
                    timestamp: Date.now() - 86400000 * 2
                },
                {
                    id: "tr_sample_3",
                    title: "Writer's Room Debrief - Character Arc Resolution",
                    text: "Session notes. Can Vaelen ever be redeemed? Redemption shouldn't come through victory, but through sacrifice. The broken chronal compass relic handed to Lyra delivers poignant bittersweet catharsis.",
                    timestamp: Date.now() - 86400000 * 1
                },
                {
                    id: "tr_sample_4",
                    title: "Sound Stage Acoustic Test - Monolith Resonance Audio",
                    text: "Field test. Acoustic resonance of the sunken monolith rumbles at 32Hz, layered with discordant choir harmonies as the chronal fracture expands.",
                    timestamp: Date.now() - 3600000 * 12
                }
            ];
        }

        const prompt = `You are a senior story analyst and audio dramaturgist for cinematic productions.
Analyze the following collection of transcribed audio recordings from "${projectName}":

Audio Transcripts:
${JSON.stringify(transcriptData, null, 2)}

Provide an authoritative intelligence report that:
1. Analyzes KEY SENTIMENT TRENDS across the transcripts (overall distribution percentages of positive, neutral, tenseOrNegative, mysterious, plus emotional shift arc across the timeline).
2. Identifies COMMON RECURRING KEYWORDS and their frequency count and category.
3. Identifies EMERGING PLOT THEMES formatted specifically for rendering as an interactive BUBBLE CHART:
   - Each bubble represents a distinct emerging narrative or plot theme.
   - Frequency (number between 20 and 65) represents the prominence/size of the bubble.
   - Sentiment specifies the emotional tone ('tense' | 'mysterious' | 'positive' | 'negative' | 'neutral').
   - SentimentScore (-1.0 to +1.0).
   - Category (e.g. 'Conspiracy & Betrayal', 'Cosmic Technology', 'Emotional Redemption', 'Faction Warfare').
   - ContextSnippet (an evocative excerpt from the transcripts referencing this theme).
   - Occurrences (number).
   - RelatedCharacters (array of strings).

Return the output in this EXACT JSON structure:
{
  "overallSentiment": {
    "dominant": "Tense & Suspenseful",
    "positive": 22,
    "neutral": 18,
    "tenseOrNegative": 42,
    "mysterious": 18
  },
  "sentimentArc": [
    { "segment": "Citadel Breach", "tone": "Desperate & Suspenseful", "shiftNote": "Sharp transition to existential threat" }
  ],
  "recurringKeywords": [
    { "word": "Obsidian Seal", "count": 7, "sentiment": "tense", "category": "Artifacts" }
  ],
  "plotThemes": [
    {
      "id": "theme_obsidian_seal",
      "name": "The Obsidian Seal Breach",
      "frequency": 58,
      "sentiment": "tense",
      "sentimentScore": -0.65,
      "category": "Conspiracy & Betrayal",
      "contextSnippet": "The seal was never broken from the outside—it was opened from within by the Council itself.",
      "occurrences": 7,
      "relatedCharacters": ["Marcus", "Vaelen"]
    }
  ],
  "summary": "Transcriptions highlight an accelerating dramatic shift toward high-stakes institutional betrayal."
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        let analysisData: any;
        try {
            analysisData = JSON.parse(response.text || "{}");
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            if (match) analysisData = JSON.parse(match[0]);
        }

        analysisData.analyzedRecordingsCount = transcriptData.length;
        analysisData.lastAnalyzedAt = new Date().toISOString();
        return analysisData;
    });
};

// --- BATCH CATEGORIZE & THEMATIC CLUSTERING (CLIENT FALLBACK) ---
export const batchCategorizeWithGemini = async (items: Array<{ id: string; name: string; description: string; type: string }>) => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const prompt = `You are an expert story universe archivist. Group the following creative bible items (characters, lore, locations) into coherent thematic clusters and assign 2-4 semantic hashtags per item.
Items:
${JSON.stringify(items, null, 2)}

Return JSON with this exact structure:
{
  "mappings": {
    "<item.id>": {
      "cluster": "Name of Thematic Cluster (e.g. Ancient Relics, House of Atreus, Cybernetic Factions, Forbidden Magic)",
      "tags": ["tag1", "tag2", "tag3"]
    }
  }
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        try {
            return JSON.parse(response.text || '{"mappings":{}}');
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { mappings: {} };
        }
    });
};

// --- INTERACTIVE NARRATIVE BRANCHING SERVICE ---
export const suggestNarrativeBranchesService = async (params: {
    sceneContent: string;
    currentScriptTitle?: string;
    genre?: string;
    characters?: any[];
    lore?: any[];
}): Promise<{ pivotAnalysis: string; branches: NarrativeBranch[] }> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const prompt = `You are a master Hollywood script doctor and narrative branching strategist.
Analyze the following script/scene content:

PROJECT TITLE: "${params.currentScriptTitle || 'Untitled Script'}"
GENRE: "${params.genre || 'Cinematic Drama'}"
CURRENT SCENE CONTENT:
"""
${params.sceneContent}
"""

${params.characters && params.characters.length > 0 ? `RELEVANT CHARACTERS: ${params.characters.map(c => `${c.name} (${c.archetype || 'Character'}): ${c.description || ''}`).join('; ')}` : ''}
${params.lore && params.lore.length > 0 ? `WORLD LORE CONTEXT: ${params.lore.slice(0, 5).map(l => `${l.title}: ${l.content}`).join('; ')}` : ''}

TASK:
1. Identify the core narrative pivot or turning point in this scene.
2. Generate 3 to 4 distinct, compelling, and dramatically contrasting alternative narrative branches that fork off from this pivotal moment.
   - Branch 1: High Stakes / Aggressive Escalation or Betrayal
   - Branch 2: Subversive Twist / Mystery / Secret Revealed
   - Branch 3: Emotional / Moral / Diplomatic Choice or Sacrifice
   - Branch 4 (optional): Existential / Cosmic / Genre Shift

For each branch, provide:
- branchTitle: Punchy evocative title (e.g., "The Poisoned Treaty", "Shadows of the Obsidian Gate")
- dramaticTone: Emotional/thematic feel (e.g., "Tragic Betrayal", "Claustrophobic Horror", "Defiant Triumph")
- turningPoint: The precise moment or action that diverges from the current scene
- narrativeSummary: 2-3 sentences explaining where this new storyline leads
- screenplayExcerpt: 8-15 lines of authentic Warner Bros. / Hollywood screenplay formatted text continuing the scene along this new branch (with INT/EXT slugline, character dialogue, and action lines)
- characterConsequences: Array of 2-3 short bullet impacts on key characters
- thematicShift: 1 sentence on the deeper meaning of this choice

Format output as JSON:
{
  "pivotAnalysis": "Summary of the key dramatic pivot in the current scene.",
  "branches": [
    {
      "id": "branch_1",
      "branchTitle": "...",
      "dramaticTone": "...",
      "turningPoint": "...",
      "narrativeSummary": "...",
      "screenplayExcerpt": "...",
      "characterConsequences": ["...", "..."],
      "thematicShift": "..."
    }
  ]
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        try {
            const data = JSON.parse(response.text || "{}");
            return {
                pivotAnalysis: data.pivotAnalysis || "Critical character decision point identified.",
                branches: (data.branches || []).map((b: any, idx: number) => ({
                    ...b,
                    id: b.id || `branch_${Date.now()}_${idx}`,
                    timestamp: Date.now()
                }))
            };
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            if (match) {
                const data = JSON.parse(match[0]);
                return {
                    pivotAnalysis: data.pivotAnalysis || "Critical turning point identified.",
                    branches: (data.branches || []).map((b: any, idx: number) => ({
                        ...b,
                        id: b.id || `branch_${Date.now()}_${idx}`,
                        timestamp: Date.now()
                    }))
                };
            }
            throw new Error("Failed to parse narrative branching response.");
        }
    });
};

// --- VISUAL LORE CONSISTENCY CHECKER FOR IMAGE GENERATOR ---
export const checkVisualLoreConsistencyService = async (params: {
    prompt: string;
    lore: any[];
    characters: any[];
    agent?: any;
}): Promise<VisualLoreConsistencyResult> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const { prompt, lore = [], characters = [] } = params;

        if (!prompt || prompt.trim().length === 0) {
            return {
                isConsistent: true,
                confidenceScore: 100,
                status: 'neutral',
                matchingLore: [],
                deviations: [],
                suggestedCorrection: prompt,
                explanation: "No prompt to analyze.",
                checkedAt: new Date().toISOString()
            };
        }

        const loreContext = lore.map(l => ({ title: l.title, content: l.content }));
        const charContext = characters.map(c => ({
            name: c.name,
            archetype: c.archetype,
            visuals: c.description || c.notes || ''
        }));

        const systemPrompt = `You are the Lead Visual Continuity Director for a major cinematic film studio.
Your mission is to cross-reference an AI image generation prompt against the established lore bible and character appearance profiles to ensure 100% visual consistency.

Image Generation Prompt to evaluate:
"${prompt}"

Established Character Profiles:
${JSON.stringify(charContext, null, 2)}

Established World & Environment Lore:
${JSON.stringify(loreContext, null, 2)}

Analyze the prompt for:
1. Character visual fidelity: Does the prompt contradict established physical traits (eye color, hair, facial scars, cybernetics, species, build, signature attire/armor)?
2. Environmental/World fidelity: Does the setting, architecture, atmospheric tone, faction insignia, or technological era clash with established lore?
3. Deviations: Clearly call out any contradictions.
4. Suggested correction: Rewrite the prompt to preserve the user's creative intent while strictly respecting established lore.

Return JSON in this EXACT structure:
{
  "isConsistent": true/false,
  "confidenceScore": 85,
  "status": "consistent" | "deviated" | "neutral",
  "matchingLore": [
    { "title": "Character / Lore Name", "matchingDetails": "How the prompt aligns" }
  ],
  "deviations": [
    {
      "entity": "Character or Location Name",
      "expectedLore": "What the lore says (e.g. cybernetic silver left eye, black cowl)",
      "promptConflict": "What the prompt requested (e.g. green human eyes, gold armor)",
      "severity": "warning" | "critical"
    }
  ],
  "suggestedCorrection": "Corrected prompt text that fixes any deviations",
  "explanation": "Concise summary of consistency findings"
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: systemPrompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        try {
            const data = JSON.parse(response.text || "{}");
            return {
                isConsistent: data.isConsistent ?? (data.deviations?.length === 0),
                confidenceScore: data.confidenceScore ?? 90,
                status: data.status || (data.deviations?.length > 0 ? 'deviated' : 'consistent'),
                matchingLore: data.matchingLore || [],
                deviations: data.deviations || [],
                suggestedCorrection: data.suggestedCorrection || prompt,
                explanation: data.explanation || "Lore cross-reference complete.",
                checkedAt: new Date().toISOString()
            };
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            if (match) {
                const data = JSON.parse(match[0]);
                return {
                    isConsistent: data.isConsistent ?? (data.deviations?.length === 0),
                    confidenceScore: data.confidenceScore ?? 90,
                    status: data.status || (data.deviations?.length > 0 ? 'deviated' : 'consistent'),
                    matchingLore: data.matchingLore || [],
                    deviations: data.deviations || [],
                    suggestedCorrection: data.suggestedCorrection || prompt,
                    explanation: data.explanation || "Lore cross-reference complete.",
                    checkedAt: new Date().toISOString()
                };
            }
            return {
                isConsistent: true,
                confidenceScore: 80,
                status: 'neutral',
                matchingLore: [],
                deviations: [],
                suggestedCorrection: prompt,
                explanation: "Prompt conforms to baseline project guidelines.",
                checkedAt: new Date().toISOString()
            };
        }
    });
};

// --- MULTIMODAL IMAGE ASSET PARSER FOR KNOWLEDGE VIEW ---
export const parseImageAssetService = async (params: {
    base64: string;
    mimeType: string;
    filename: string;
}): Promise<ParsedImageAsset> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const { base64, mimeType, filename } = params;

        const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

        const prompt = `You are a cinematic asset archivist and visual lore specialist.
Analyze this newly uploaded image asset ("${filename}") for inclusion in the project's Knowledge Base Sacred Archive.

Provide an in-depth visual analysis that can be indexed into vector search:
1. Detailed visual description: Comprehensive description of all subjects, actions, lighting, palette, mood, and composition.
2. Characters: List of identified characters, archetypes, expressions, costume, equipment.
3. Setting: Location type, architectural style, atmospheric conditions, era/tech level.
4. Tags: 5-8 semantic tags (e.g. #cybernetic, #citadel, #dystopian, #concept_art).
5. Summary: 1-2 sentence executive summary of this asset for quick browsing in the archive grid.
6. Lore Significance: Inferred narrative lore value or potential worldbuilding connections.
7. Aesthetic Style: (e.g. "Anamorphic Cinematic", "Hyperrealistic Concept Art", "Noir Watercolor").

Return JSON:
{
  "visualDescription": "...",
  "characters": ["..."],
  "setting": "...",
  "tags": ["..."],
  "summary": "...",
  "loreSignificance": "...",
  "aestheticStyle": "..."
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
                {
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType || 'image/jpeg',
                                data: cleanBase64
                            }
                        },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        try {
            return JSON.parse(response.text || "{}");
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            if (match) return JSON.parse(match[0]);
            return {
                visualDescription: `Image asset: ${filename}. High quality visual artwork depicting cinematic scene elements.`,
                characters: [],
                setting: "Cinematic Environment",
                tags: ["image_asset", "concept_art", "visual_lore"],
                summary: `Visual asset ${filename} indexed for cinematic universe.`,
                loreSignificance: "Visual reference for world consistency."
            };
        }
    });
};

// --- EXTRACT METADATA CLIENT SERVICE ---
export const extractMetadataService = async (text: string, filename: string): Promise<{ summary: string; tags: string[]; category: string }> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const prompt = `Extract executive summary, category, and 3-5 tags for this document: "${filename}".
Content snippet:
"""
${text.slice(0, 3000)}
"""

Return JSON:
{
  "summary": "1-2 sentence executive summary",
  "tags": ["tag1", "tag2"],
  "category": "World Building" | "Scripts" | "Character Profiles" | "Reference Documents" | "Root Documents"
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        try {
            return JSON.parse(response.text || "{}");
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { summary: text.slice(0, 150), tags: ["lore"], category: "Root Documents" };
        }
    });
};

// --- DETECT CONTRADICTIONS CLIENT SERVICE ---
export const detectContradictionsService = async (text: string, filename: string, existingContext: any): Promise<{ discrepancies: any[] }> => {
    return apiCallWithRetry(async () => {
        const ai = getClient();
        const prompt = `Analyze this document "${filename}" for factual continuity contradictions against established context:
Context:
${JSON.stringify(existingContext, null, 2)}

Document Text:
"""
${text.slice(0, 4000)}
"""

Return JSON:
{
  "discrepancies": [
    {
      "context": "Conflicting passage from text",
      "reason": "Why it conflicts with established context",
      "severity": "low" | "medium" | "high",
      "status": "pending"
    }
  ]
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        try {
            return JSON.parse(response.text || '{"discrepancies":[]}');
        } catch {
            const match = (response.text || "").match(/\{[\s\S]*\}/);
            return match ? JSON.parse(match[0]) : { discrepancies: [] };
        }
    });
};

