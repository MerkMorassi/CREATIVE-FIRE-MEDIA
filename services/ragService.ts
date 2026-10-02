export interface RagContextResult {
  context: string;
  warning: string | null;
}

export interface RagTestResult {
  success: boolean;
  message: string;
}

export const fetchKnowledgeBaseContext = async (url: string, query: string): Promise<RagContextResult> => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });
        if (!response.ok) {
            const warning = `Knowledge base at ${url} returned status ${response.status}.`;
            console.warn(warning);
            return { context: '', warning };
        }
        const data = await response.json();
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
            const contextString = data.results.join('\n- ');
            const context = `- ${contextString}`;
            
            if (contextString.length < 50) {
                return { context, warning: "The retrieved context from the Knowledge Base was very brief. You may want to refine your Knowledge Base content or the prompt." };
            }

            return { context, warning: null };
        }
        return { context: '', warning: "The knowledge base was searched, but no relevant context was found for your prompt." }; 
    } catch (error) {
        console.error(`Error fetching from knowledge base at ${url}:`, error);
        const warning = `Could not connect to the knowledge base at ${url}. Proceeding with standard analysis.`;
        return { context: '', warning };
    }
};


export const testKnowledgeBase = async (url: string): Promise<RagTestResult> => {
    if (!url.trim()) {
        return { success: false, message: 'URL cannot be empty.' };
    }
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'Connection Test' }),
        });

        if (!response.ok) {
            return { success: false, message: `Connection failed. Server responded with status: ${response.status}.` };
        }

        const data = await response.json();

        if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
            return { success: true, message: `Connection successful! Test query returned ${data.results.length} result(s).` };
        } else {
            return { success: false, message: "Connection succeeded, but the response format is incorrect. It must be a JSON object with a 'results' array (e.g., {\"results\": [...]})." };
        }
    } catch (error) {
        console.error(`Error testing knowledge base at ${url}:`, error);
        if (error instanceof TypeError) { // Often a CORS or network error
             return { success: false, message: "A network error occurred. This could be a CORS issue or the server may be down." };
        }
        return { success: false, message: "Could not connect to the specified URL. Please check the address and your network connection." };
    }
};
