
import { getEmbeddings } from './geminiService';

export const chunkText = (text: string, targetSize = 600): string[] => {
  const chunks: string[] = [];
  let index = 0;
  
  while (index < text.length) {
      let limit = Math.min(index + targetSize, text.length);
      if (limit >= text.length) {
          chunks.push(text.slice(index));
          break;
      }
      
      let splitIndex = -1;
      const searchStart = Math.max(index, limit - 100);
      
      // Try to split at paragraph or sentence
      splitIndex = text.lastIndexOf('\n', limit);
      if (splitIndex < searchStart) {
          const match = text.slice(searchStart, limit).match(/[.!?](\s|$)/);
          if (match && match.index !== undefined) {
               splitIndex = searchStart + match.index + 1;
          }
      }
      
      // Fallback to space
      if (splitIndex < searchStart) {
          splitIndex = text.lastIndexOf(' ', limit);
      }
      
      // Fallback to hard limit
      if (splitIndex <= index) {
          splitIndex = limit;
      }

      const chunk = text.slice(index, splitIndex).trim();
      if (chunk.length > 0) chunks.push(chunk);
      index = splitIndex;
  }
  return chunks;
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    nA += a[i] * a[i];
    nB += b[i] * b[i];
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB)) || 0;
};

export const generateEmbeddingsForChunks = async (chunks: string[]): Promise<{ text: string, vector: number[] }[]> => {
    // We process in small batches to avoid hitting API limits aggressively if needed, 
    // though the SDK handles basic requests. 
    // For text-embedding-004, we can do batch embedding if the SDK supports it, 
    // but the current genai-js usually does one content payload.
    // We'll map them.
    
    const results = [];
    for (const chunk of chunks) {
        // Rate limit safe guard (simple pause)
        await new Promise(r => setTimeout(r, 50)); 
        const vector = await getEmbeddings(chunk);
        if (vector) {
            results.push({ text: chunk, vector });
        }
    }
    return results;
};
