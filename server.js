



const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json({ limit: '50mb' })); // Large limit for LOREPACK syncs
const PORT = process.env.PORT || 4000;

// Neural Vault: In-memory vector store (swap for ChromaDB/Pinecone in production)
let NEURAL_VAULT = [];
const VAULT_PATH = path.join(__dirname, 'neural_vault.json');
let GRAPH_VAULT = []; // For graph edges
const GRAPH_PATH = path.join(__dirname, 'graph_vault.json');

// Initialize Vault from disk if it exists
if (fs.existsSync(VAULT_PATH)) {
    try {
        NEURAL_VAULT = JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
        console.log(`[NEURAL VAULT] Restored ${NEURAL_VAULT.length} nodes from disk.`);
    } catch (e) {
        console.error("[NEURAL VAULT] Restore failed, starting fresh.");
    }
}
if (fs.existsSync(GRAPH_PATH)) {
    try {
        GRAPH_VAULT = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
        console.log(`[GRAPH VAULT] Restored ${GRAPH_VAULT.length} edges from disk.`);
    } catch (e) {
        console.error("[GRAPH VAULT] Restore failed, starting fresh.");
    }
}


// Helper: Cosine Similarity for the RAG Engine
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- RAG API ENDPOINT ---
// This is what the Automation Studio "Localhost RAG API URL" points to.
app.post('/api/rag', async (req, res) => {
    const { query, limit = 5, agentId } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        // 1. Generate embedding for the query on the server
        // FIX: Updated to use the correct `ai.models.embedContent` method instead of the deprecated `getGenerativeModel`.
        const result = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: { parts: [{ text: query }] }
        });
        const queryVector = result.embedding.values;

        // 2. Search the Neural Vault (Filtered by Agent if provided)
        const pool = agentId ? NEURAL_VAULT.filter(v => v.agentId === agentId) : NEURAL_VAULT;
        
        const scored = pool.map(node => ({
            text: node.text,
            source: node.source,
            score: cosineSimilarity(queryVector, node.vector)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .filter(n => n.score > 0.45); // Relevance threshold

        console.log(`[RAG QUERY] "${query.substring(0, 30)}..." -> Found ${scored.length} results.`);
        
        res.json({
            results: scored.map(s => s.text),
            metadata: scored.map(s => ({ source: s.source, score: s.score }))
        });

    } catch (error) {
        console.error("[RAG ERROR]", error);
        res.status(500).json({ error: "Neural Retrieval Failure" });
    }
});

// --- BATCH EMBEDDING API ENDPOINT ---
// Generates high-fidelity 3072-dimensional embeddings for lore mapping and semantic networking.
app.post('/api/embed-batch', async (req, res) => {
    const { texts } = req.body;
    
    if (!Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({ error: "Invalid request. Expected 'texts' array of strings." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const embedPromises = texts.map(async (text) => {
            try {
                const response = await ai.models.embedContent({
                    model: 'gemini-embedding-2-preview',
                    contents: { parts: [{ text }] },
                    config: {
                        outputDimensionality: 3072
                    }
                });
                return response.embedding.values;
            } catch (err) {
                console.error(`Failed to embed text "${text.substring(0, 30)}":`, err);
                return null;
            }
        });

        const embeddings = await Promise.all(embedPromises);
        res.json({ embeddings });
    } catch (error) {
        console.error("[EMBED BATCH ERROR]", error);
        res.status(500).json({ error: "Failed to generate batch embeddings: " + error.message });
    }
});

// --- BATCH CATEGORIZATION API ENDPOINT ---
// Scans lore and character entries, clusters them thematically using Gemini, and returns semantic tags.
app.post('/api/batch-categorize', async (req, res) => {
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invalid request. Expected 'items' array." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `You are an expert lore master and worldbuilder. 
Analyze the following list of lore entries and characters from a story universe. 
Your task is to:
1. Identify major cohesive thematic clusters (e.g. "Magic Systems", "Royal Dynasties", "Factions", "Artifacts", "Historic Wars", "Sacred Geography").
2. Group each item into one of these cohesive clusters.
3. Generate 2 to 4 highly specific semantic tags for each item to improve its queryability and structure.

Return a JSON object in this EXACT format:
{
  "mappings": {
    "ITEM_ID": {
      "cluster": "Thematic Cluster Name",
      "tags": ["tag1", "tag2", "tag3"]
    }
  }
}

Items to process:
${JSON.stringify(items, null, 2)}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const textResponse = response.text;
        const parsed = JSON.parse(textResponse);
        res.json(parsed);
    } catch (error) {
        console.error("[BATCH CATEGORIZE ERROR]", error);
        res.status(500).json({ error: "Failed to cluster and tag lore: " + error.message });
    }
});

// --- AUTOMATED DOCUMENT METADATA EXTRACTION PIPELINE ENDPOINT ---
// Generates concise summaries and key thematic tags for uploaded documents using Gemini.
app.post('/api/extract-metadata', async (req, res) => {
    const { text, filename } = req.body;
    if (!text) {
        return res.status(400).json({ error: "No text content provided." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const sampleText = text.substring(0, 12000); // 12K character safe chunking

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: `You are an expert AI knowledge engine and narrative worldbuilder. Analyze this document text (first segment of "${filename || 'Document'}").
Extract:
1. An authoritative "Executive Lore Summary" (a highly concise 1-2 sentence high-level executive worldbuilding summary of this document).
2. 3 to 6 key-thematic-tags.
3. The most suitable thematic folder category. Choose exactly one of these: "Scripts", "Character Profiles", "World Building", or "Reference Documents".

Return a JSON object in this EXACT format:
{
  "summary": "Executive Lore Summary...",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "Scripts"
}

Document sample:
${sampleText}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        summary: {
                            type: "STRING",
                            description: "A concise 1-2 sentence summary of the document."
                        },
                        tags: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "3-6 key thematic tags."
                        },
                        category: {
                            type: "STRING",
                            enum: ["Scripts", "Character Profiles", "World Building", "Reference Documents"],
                            description: "The designated thematic folder category."
                        }
                    },
                    required: ["summary", "tags", "category"]
                }
            }
        });

        const parsed = JSON.parse(response.text);
        console.log(`[PIPELINE EXTRAC] Successful metadata extraction and categorization for ${filename}`);
        res.json(parsed);
    } catch (err) {
        console.error("[EXTRACT-METADATA ERROR]", err);
        res.status(500).json({ error: "Metadata extraction failed: " + err.message });
    }
});

// --- AUTOMATED CONTRADICTION ANALYSIS ENDPOINT ---
app.post('/api/detect-contradictions', async (req, res) => {
    const { text, filename, existingContext } = req.body;
    if (!text) {
        return res.status(400).json({ error: "No text content provided." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const prompt = `You are a meticulous worldbuilding continuity editor.
Your job is to scan the following newly uploaded document for factual contradictions, logical loopholes, or timeline mismatches against the existing context of characters and lore.

Existing character profiles, lore triplets, and concepts context:
${JSON.stringify(existingContext, null, 2)}

Newly uploaded document ("${filename}") text content:
---
${text.substring(0, 15000)}
---

Identify any direct factual contradictions or logical continuity errors.
For each discrepancy found, categorize its severity as "high", "medium", or "low". Provide the exact quote/context of the conflict and a clear, objective continuity editor explanation.

Return a JSON array of discovered discrepancies in this EXACT format:
[
  {
    "severity": "high" | "medium" | "low",
    "context": "Short text quote from the new document where conflict occurs",
    "explanation": "continuity contradiction explanation, citing specifically what existing fact it violates"
  }
]

If NO contradictions are found, return an empty array: []`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        const parsed = JSON.parse(response.text);
        res.json({ discrepancies: Array.isArray(parsed) ? parsed : [] });
    } catch (error) {
        console.error("[DETECT CONTRADICTIONS ERROR]", error);
        res.status(500).json({ error: "Contradiction detection failure: " + error.message });
    }
});

// --- AUTO-TAGGING API ENDPOINT ---
// Categorizes images and videos using Gemini AI when they are added to the project or selected in ImageGrid.
app.post('/api/auto-tag', async (req, res) => {
    const { base64, url, mimeType } = req.body;
    
    if (!base64 && !url) {
        return res.status(400).json({ error: "No media base64 or URL data provided." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        let finalBase64 = base64;
        let finalMimeType = mimeType || "image/png";

        if (!finalBase64 && url) {
            console.log(`[AUTO-TAG] Resolving remote URL: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to download remote media: ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            finalBase64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type');
            if (contentType) {
                finalMimeType = contentType;
            }
        }

        const isVideo = finalMimeType.startsWith('video');
        const mediaPart = {
            inlineData: {
                mimeType: finalMimeType,
                data: finalBase64,
            },
        };
        
        const textPart = {
            text: `Analyze this ${isVideo ? 'video clip' : 'image'} and return a JSON object with a 'tags' property containing 3 to 6 highly relevant categories, styles, themes, or tags for categorizing this asset in a production asset vault. ` +
                  "Choose specific, descriptive tags like 'sci-fi', 'portrait', 'neon', 'exterior', 'cyberpunk', 'watercolor', 'concept-art', 'character-design', 'high-action', 'cinematic-lighting', etc. " +
                  "Avoid generic words like 'image', 'video', 'artwork', 'movie' or 'picture'. Provide output in JSON format with 'tags' as a list of strings."
        };

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: { parts: [mediaPart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        tags: {
                            type: "ARRAY",
                            items: {
                                type: "STRING"
                            },
                            description: "A list of 3-6 specific and descriptive categories or tags for the asset."
                        }
                    },
                    required: ["tags"]
                }
            }
        });

        console.log(`[AUTO-TAG] Generated tags response:`, response.text);
        
        let tags = [];
        try {
            const parsed = JSON.parse(response.text);
            tags = parsed.tags || [];
        } catch (pe) {
            console.error("[AUTO-TAG] JSON parsing failed, parsing manually...", pe);
            // Fallback parsing if JSON contains markdown or other noise
            const match = response.text.match(/\[([\s\S]*?)\]/);
            if (match) {
                tags = match[1].split(',').map(s => s.trim().replace(/['"']/g, '')).filter(Boolean);
            }
        }
        
        res.json({ tags });

    } catch (error) {
        console.error("[AUTO-TAG ERROR]", error);
        res.status(500).json({ error: "Failed to generate AI tags: " + error.message });
    }
});

// --- MUSIC API PROXY ENDPOINTS ---
app.post('/api/music/create', async (req, res) => {
    const clientApiKey = req.headers['x-music-api-key'];
    const authHeader = clientApiKey && clientApiKey.trim() !== '' 
        ? `Bearer ${clientApiKey.trim()}` 
        : 'Bearer f8410b24a4ad4cae2a4b76dd5684c250';
    try {
        const response = await fetch('https://api.musicapi.ai/api/v1/sonic/create', {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("[MUSIC API CREATE ERROR]", error);
        res.status(500).json({ error: "Failed to initiate music generation task with musicapi.ai" });
    }
});

app.get('/api/music/task/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const clientApiKey = req.headers['x-music-api-key'];
    const authHeader = clientApiKey && clientApiKey.trim() !== '' 
        ? `Bearer ${clientApiKey.trim()}` 
        : 'Bearer f8410b24a4ad4cae2a4b76dd5684c250';
    try {
        const response = await fetch(`https://api.musicapi.ai/api/v1/sonic/task/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        });
        
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("[MUSIC API TASK ERROR]", error);
        res.status(500).json({ error: `Failed to fetch status for music task ${taskId}` });
    }
});

// --- COREPACK / LOREPACK SYNC ENDPOINT ---
// Endpoint to receive LOREPACKS exported from the browser for permanent studio storage.
app.post('/api/sync', (req, res) => {
    const { nodes, overwrite = false } = req.body; 

    if (!Array.isArray(nodes)) {
        return res.status(400).json({ error: "Invalid LorePack format. Expected 'nodes' array." });
    }

    const newVectors = nodes.filter(n => n.type === 'vector');
    const newEdges = nodes.filter(n => n.type === 'edge');

    if (overwrite) {
        NEURAL_VAULT = newVectors;
        GRAPH_VAULT = newEdges;
    } else {
        NEURAL_VAULT.push(...newVectors);
        GRAPH_VAULT.push(...newEdges);
    }
    
    // Deduplication logic could be added here if needed
    
    fs.writeFileSync(VAULT_PATH, JSON.stringify(NEURAL_VAULT, null, 2), 'utf8');
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(GRAPH_VAULT, null, 2), 'utf8');
    
    console.log(`[SYNC] Ingested ${newVectors.length} vectors and ${newEdges.length} edges. Vault sizes: [Vectors: ${NEURAL_VAULT.length}, Edges: ${GRAPH_VAULT.length}]`);
    
    res.json({ success: true, vaultSize: NEURAL_VAULT.length + GRAPH_VAULT.length });
});

// --- AUDIO TRANSCRIPTION API ENDPOINT ---
// Transcribes uploaded or recorded audio/video, or downloads from a shared link, using gemini-3.5-transcribe.
app.post('/api/transcribe', async (req, res) => {
    let { base64, mimeType, url, prompt = "Transcribe this audio.", action = "transcribe" } = req.body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured. Please add it to your secrets panel." });
    }

    try {
        // If a URL is provided and base64 is not, download the file
        if (url && !base64) {
            console.log(`[TRANSCRIBE] Fetching remote audio/video from URL: ${url}`);
            const fetchRes = await fetch(url);
            if (!fetchRes.ok) {
                throw new Error(`Failed to fetch media from link. Status: ${fetchRes.status}`);
            }
            const contentType = fetchRes.headers.get('content-type');
            if (contentType) {
                mimeType = contentType;
            }
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            base64 = buffer.toString('base64');
            console.log(`[TRANSCRIBE] Fetched and encoded remote file. Size: ${buffer.length} bytes, Mime: ${mimeType}`);
        }

        if (!base64) {
            return res.status(400).json({ error: "No audio/video payload or link URL provided." });
        }

        // Clean up data URL prefixes
        if (base64.includes(';base64,')) {
            const parts = base64.split(';base64,');
            mimeType = parts[0].split(':')[1];
            base64 = parts[1];
        }

        if (!mimeType) {
            mimeType = "audio/mp3"; // Generic fallback
        }

        console.log(`[TRANSCRIBE] Initiating transcription with gemini-3.5-transcribe. Action: ${action}, Mime: ${mimeType}`);
        const ai = new GoogleGenAI({ apiKey });

        const mediaPart = {
            inlineData: {
                mimeType: mimeType,
                data: base64,
            },
        };

        // Expand capabilities based on the requested analysis type
        let finalPrompt = prompt;
        if (action === "summary") {
            finalPrompt = `${prompt}\n\nPlease generate a concise, structured summary of this transcription at the top, capturing the key context, speaker tones, and main theme, followed by the complete transcript.`;
        } else if (action === "takeaways") {
            finalPrompt = `${prompt}\n\nPlease extract and display a list of key takeaways, main action items, and crucial decisions made, followed by the transcript.`;
        } else if (action === "chapters") {
            finalPrompt = `${prompt}\n\nPlease organize the transcription into separate chapters/sections with descriptive headings and relative estimated time segments.`;
        }

        const response = await ai.models.generateContent({
            model: "gemini-3.5-transcribe",
            contents: { parts: [mediaPart, { text: finalPrompt }] }
        });

        res.json({
            text: response.text,
            mimeType,
            action
        });

    } catch (error) {
        console.error("[TRANSCRIBE ERROR]", error);
        res.status(500).json({ error: error.message || "Failed to process audio transcription." });
    }
});

// Priority: Serve static files from 'dist' folder (standard Vite output)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Fallback: Static files from the root
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  const ext = path.extname(req.path);
  if (['.tsx', '.ts', '.jsx'].includes(ext)) {
    res.setHeader('Content-Type', 'application/javascript');
  }
  next();
});

// SPA Support
app.get('*', (req, res) => {
  const productionIndex = path.join(distPath, 'index.html');
  if (fs.existsSync(productionIndex)) {
    res.sendFile(productionIndex);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`
  --------------------------------------------------
  MYTHOS STUDIO SERVER ONLINE
  Port: ${PORT}
  Neural Vault Status: ACTIVE (${NEURAL_VAULT.length} nodes)
  Graph Vault Status: ACTIVE (${GRAPH_VAULT.length} edges)
  RAG API: http://localhost:${PORT}/api/rag
  Sync API: http://localhost:${PORT}/api/sync
  --------------------------------------------------
  `);
});