



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

// --- LORE HYPOTHESIS GENERATOR ENDPOINT ---
// Uses Gemini to discover narrative connections between disparate lore documents based on thematic clusters.
app.post('/api/generate-lore-hypotheses', async (req, res) => {
    const { documents = [], thematicClusters = [], loreEntries = [], characters = [] } = req.body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Compile documents pool, falling back to foundational universe lore if documents pool is sparse
        let docPool = documents;
        if (!docPool || docPool.length < 2) {
            const fallbackLore = [
                {
                    source: "Chronicles of the Obsidian Spire.md",
                    category: "World Building",
                    summary: "An ancient monolith pulsing with chronal energy, maintained by an ascetic order sworn to silence.",
                    tags: ["monolith", "chronal energy", "obsidian", "ascetic order"]
                },
                {
                    source: "Aetherium Guild Manifest.pdf",
                    category: "Reference Documents",
                    summary: "Financial records and trade manifests detailing illicit shipments of distilled void-salt across planetary quadrants.",
                    tags: ["trade", "void-salt", "guild", "contraband"]
                },
                {
                    source: "Sector 7 Rebel Transmission.txt",
                    category: "Scripts",
                    summary: "Intercepted audio log from rebel commander Vaelen describing blackouts in the lower biosphere and rogue biomechanical drones.",
                    tags: ["rebellion", "blackout", "drones", "vaelen"]
                },
                {
                    source: "Project Chrysalis Genesis Dossier.docx",
                    category: "Character Profiles",
                    summary: "Classified genetic augmentation experiment records linking the royal lineage to early synthetically bred navigators.",
                    tags: ["chrysalis", "royal dynasty", "genetic augmentation", "navigators"]
                }
            ];
            docPool = [...(docPool || []), ...fallbackLore];
        }

        const prompt = `You are a visionary narrative designer and worldbuilding lore director for high-concept sci-fi, fantasy, and cinematic universes.
Your mission: Analyze the disparate lore documents below (which span different thematic clusters, folders, and characters) and invent 3 to 5 deeply compelling, surprising, yet logical "Lore Hypotheses".

Each Lore Hypothesis represents an unrevealed narrative connection bridging at least two DISPARATE documents:
- E.g. A secret alliance, an obscured historical catastrophe, a common technological progenitor, an undisclosed bloodline, or a covert betrayal.

Available Documents & Lore Context:
${JSON.stringify(docPool.slice(0, 12), null, 2)}

Existing Characters & Lore:
${JSON.stringify((characters || []).slice(0, 8), null, 2)}

Return a JSON array of 3 to 5 distinct Lore Hypotheses in this EXACT JSON structure:
[
  {
    "id": "hyp_unique_id",
    "title": "Evocative, dramatic title (e.g. 'The Aetherium-Chrysalis Conspiracy', 'Echoes of the Obsidian Monolith')",
    "thematicCluster": "Thematic cluster name (e.g. 'Cosmic Anomalies & Dynastic Succession', 'Forbidden Technology', 'Subterranean Insurgency')",
    "connectedSources": ["Document 1 Name", "Document 2 Name"],
    "hypothesis": "2 to 3 sentences explaining the hidden narrative bridge connecting these documents and what it implies for the story world.",
    "evidence": "Concrete narrative breadcrumbs, thematic motifs, or temporal clues in both documents that support this hypothesis.",
    "creativePrompt": "A provocative scene beat or writing prompt for the screenwriters' room to test this connection in upcoming drafts.",
    "confidenceScore": 88
  }
]`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        let hypotheses = [];
        try {
            const parsed = JSON.parse(response.text);
            hypotheses = Array.isArray(parsed) ? parsed : (parsed.hypotheses || []);
        } catch (e) {
            console.error("[LORE HYPOTHESES] JSON parse failed, extracting via regex:", e);
            const match = response.text.match(/\[[\s\S]*\]/);
            if (match) {
                hypotheses = JSON.parse(match[0]);
            }
        }

        // Ensure well-formed attributes
        const formatted = hypotheses.map((h, i) => ({
            id: h.id || `hyp_${Date.now()}_${i}`,
            title: h.title || `Narrative Link #${i + 1}`,
            thematicCluster: h.thematicCluster || "Thematic Synthesis",
            connectedSources: Array.isArray(h.connectedSources) ? h.connectedSources : [docPool[0]?.source, docPool[1]?.source].filter(Boolean),
            hypothesis: h.hypothesis || "A discovered narrative connection between disparate universe documents.",
            evidence: h.evidence || "Overlapping thematic motifs and character mentions.",
            creativePrompt: h.creativePrompt || "Draft an exchange between key figures investigating this connection.",
            confidenceScore: typeof h.confidenceScore === 'number' ? h.confidenceScore : Math.floor(Math.random() * 16) + 80,
            status: 'suggested',
            createdAt: new Date().toISOString()
        }));

        console.log(`[LORE HYPOTHESES] Generated ${formatted.length} hypotheses successfully.`);
        res.json({ hypotheses: formatted });

    } catch (error) {
        console.error("[LORE HYPOTHESIS ERROR]", error);
        res.status(500).json({ error: "Failed to generate narrative hypotheses: " + error.message });
    }
});

// --- AUDIO TRANSCRIPT SENTIMENT & PLOT THEMES ANALYZER ENDPOINT ---
// Analyzes transcribed audio recordings for key sentiment trends, recurring keywords, and plot themes for bubble chart visualization.
app.post('/api/analyze-audio-sentiment-themes', async (req, res) => {
    const { transcripts = [], projectName = "Cinematic Universe" } = req.body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Server API Key not configured." });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Fallback sample studio voice transcripts if user hasn't recorded/transcribed audio yet
        let transcriptData = transcripts;
        if (!transcriptData || transcriptData.length === 0) {
            transcriptData = [
                {
                    id: "tr_sample_1",
                    title: "Director Voice Memo - Act II Climax & Citadel Breach",
                    text: "Voice memo October 12th. Thinking through the Citadel breach scene with Marcus and Vaelen. The tone needs to shift from claustrophobic suspense to desperate defiance. Marcus realizes the Obsidian seal was never broken from the outside—it was opened from within by the Council itself. We need heavy ominous strings, then sudden silence when the reactor initiates. The betrayal must hit like a freight train.",
                    timestamp: Date.now() - 86400000 * 3
                },
                {
                    id: "tr_sample_2",
                    title: "Table Read Dialogue - Sector 7 Council Infiltration",
                    text: "Table read segment 4B. Character Lyra whispers: 'The void-salt shipments aren't for power grids, they're for biological stasis.' Kael responds with shock: 'You mean Project Chrysalis is active?' High tension, whispering, quick breathing. We hear alarms echoing in the distance. Lyra insists on confronting the Grand Chancellor before the moon aligns with the orbital array.",
                    timestamp: Date.now() - 86400000 * 2
                },
                {
                    id: "tr_sample_3",
                    title: "Writer's Room Debrief - Character Arc Resolution",
                    text: "Session notes from the writers' room. Key question: Can Vaelen ever be redeemed after the blackout incident? Consensus is that his redemption shouldn't come through victory, but through sacrifice. The recurring motif of the broken chronal compass needs to pay off in the finale. When he hands the relic to Lyra, the emotional tone should be poignant, bittersweet, and triumphant all at once.",
                    timestamp: Date.now() - 86400000 * 1
                },
                {
                    id: "tr_sample_4",
                    title: "Sound Stage Acoustic Test - Monolith Resonance Audio",
                    text: "Field test memo. The acoustic feedback inside the soundstage simulates the resonance of the sunken monolith. Low frequency rumbles around 32Hz, layered with discordant choir harmonies. The sound designer notes this should accompany every scene where the chronal fracture begins expanding across the city skyline.",
                    timestamp: Date.now() - 3600000 * 12
                }
            ];
        }

        const prompt = `You are a senior story analyst, audio dramaturgist, and sentiment intelligence specialist for cinematic productions.
Analyze the following collection of transcribed audio recordings from the project "${projectName}":

Audio Transcripts:
${JSON.stringify(transcriptData, null, 2)}

Provide an authoritative, detailed intelligence report that:
1. Analyzes KEY SENTIMENT TRENDS across the transcripts (overall distribution percentages of positive/hopeful, neutral, tense/conflict, and mysterious/suspense, plus emotional shift arc across the timeline).
2. Identifies COMMON RECURRING KEYWORDS and their frequency count and category.
3. Identifies EMERGING PLOT THEMES formatted specifically for rendering as an interactive BUBBLE CHART:
   - Each bubble represents a distinct emerging narrative or plot theme.
   - Frequency (number between 18 and 65) represents the prominence/size of the bubble.
   - Sentiment specifies the emotional tone ('tense' | 'mysterious' | 'positive' | 'negative' | 'neutral').
   - SentimentScore (-1.0 to +1.0) specifies the valence.
   - Category (e.g. 'Conspiracy & Betrayal', 'Cosmic Technology', 'Emotional Redemption', 'Faction Warfare', 'Acoustic Lore').
   - ContextSnippet (an evocative excerpt from the transcripts referencing this theme).
   - Occurrences (estimated count of mentions/reverberations).
   - RelatedCharacters (array of characters linked to this theme).

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
    {
      "segment": "Citadel Breach & Council Betrayal",
      "tone": "Desperate & Suspenseful",
      "shiftNote": "Sharp transition from covert planning to urgent existential threat"
    },
    {
      "segment": "Sector 7 Infiltration & Void-Salt Discovery",
      "tone": "Conspiratorial & Shock",
      "shiftNote": "Revelation of Project Chrysalis escalates moral stakes"
    },
    {
      "segment": "Writers Room Resolution",
      "tone": "Bittersweet & Poignant",
      "shiftNote": "Emotional catharsis through sacrificial redemption motif"
    }
  ],
  "recurringKeywords": [
    { "word": "Obsidian Seal", "count": 7, "sentiment": "tense", "category": "Artifacts" },
    { "word": "Chrysalis", "count": 6, "sentiment": "mysterious", "category": "Conspiracies" },
    { "word": "Void-Salt", "count": 5, "sentiment": "tense", "category": "Technology" },
    { "word": "Redemption", "count": 4, "sentiment": "positive", "category": "Character Arcs" },
    { "word": "Chronal Fracture", "count": 4, "sentiment": "mysterious", "category": "Cosmic" },
    { "word": "Blackout", "count": 3, "sentiment": "negative", "category": "Plot Events" }
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
      "relatedCharacters": ["Marcus", "Vaelen", "Council"]
    },
    {
      "id": "theme_project_chrysalis",
      "name": "Project Chrysalis Awakening",
      "frequency": 48,
      "sentiment": "mysterious",
      "sentimentScore": -0.4,
      "category": "Forbidden Science",
      "contextSnippet": "Void-salt shipments aren't for power grids, they're for biological stasis in Project Chrysalis.",
      "occurrences": 6,
      "relatedCharacters": ["Lyra", "Grand Chancellor", "Kael"]
    },
    {
      "id": "theme_sacrificial_redemption",
      "name": "Sacrificial Redemption Arc",
      "frequency": 42,
      "sentiment": "positive",
      "sentimentScore": 0.7,
      "category": "Emotional Redemption",
      "contextSnippet": "His redemption shouldn't come through victory, but through sacrifice, handing the relic to Lyra.",
      "occurrences": 5,
      "relatedCharacters": ["Vaelen", "Lyra"]
    },
    {
      "id": "theme_chronal_fracture",
      "name": "Chronal Fracture Expansion",
      "frequency": 36,
      "sentiment": "mysterious",
      "sentimentScore": -0.2,
      "category": "Cosmic Anomaly",
      "contextSnippet": "Low frequency resonance at 32Hz as the chronal fracture begins expanding across the skyline.",
      "occurrences": 4,
      "relatedCharacters": ["Sound Designer", "Marcus"]
    },
    {
      "id": "theme_sector7_blackout",
      "name": "Sector 7 Sabotage & Blackout",
      "frequency": 32,
      "sentiment": "negative",
      "sentimentScore": -0.8,
      "category": "Faction Warfare",
      "contextSnippet": "Rogue biomechanical drones initiating catastrophic blackouts in the lower biosphere.",
      "occurrences": 4,
      "relatedCharacters": ["Vaelen", "Rebel Squad"]
    },
    {
      "id": "theme_broken_compass",
      "name": "The Broken Chronal Compass",
      "frequency": 28,
      "sentiment": "positive",
      "sentimentScore": 0.5,
      "category": "Narrative Motif",
      "contextSnippet": "The recurring motif of the broken chronal compass needs to pay off with bittersweet resonance.",
      "occurrences": 3,
      "relatedCharacters": ["Lyra", "Vaelen"]
    }
  ],
  "summary": "Transcriptions highlight an accelerating dramatic shift toward high-stakes institutional betrayal centered around the Obsidian Seal and Project Chrysalis, counterbalanced by emotional redemption themes."
}`;

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        let analysisData;
        try {
            analysisData = JSON.parse(response.text);
        } catch (e) {
            console.error("[AUDIO SENTIMENT ANALYZER] Failed to parse JSON, falling back to regex:", e);
            const match = response.text.match(/\{[\s\S]*\}/);
            if (match) {
                analysisData = JSON.parse(match[0]);
            } else {
                throw e;
            }
        }

        analysisData.analyzedRecordingsCount = transcriptData.length;
        analysisData.lastAnalyzedAt = new Date().toISOString();

        console.log(`[AUDIO SENTIMENT ANALYZER] Analyzed ${transcriptData.length} transcripts. Generated ${analysisData.plotThemes?.length || 0} plot theme bubbles.`);
        res.json(analysisData);

    } catch (error) {
        console.error("[AUDIO SENTIMENT ANALYZER ERROR]", error);
        res.status(500).json({ error: "Failed to analyze audio transcripts: " + error.message });
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