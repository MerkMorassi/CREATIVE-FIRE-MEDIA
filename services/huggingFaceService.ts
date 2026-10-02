
import { HfInference } from "@huggingface/inference";
import { getCinematicCoreUrl } from './apiKeyService';
import { getGradioClient } from './gradioService';

// --- MYTHOS PROPRIETARY DOCKER CONFIGURATION ---
// Root technical subdomain for the merkmorassi hardware.
const CINEMATIC_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

export interface SDXLParams {
  prompt: string;
  negative_prompt?: string;
  num_inference_steps?: number;
  guidance_scale?: number;
  width?: number;
  height?: number;
  seed?: number;
  useSuperiorEngine?: boolean;
}

/**
 * Primary Generation Function
 * Direct-links to the merkmorassi hardware cluster or uses standard HF Inference as a fallback.
 */
export const generateImageSDXL = async (
  params: SDXLParams,
  hfToken: string,
): Promise<Blob> => {
  
  if (!hfToken || hfToken.trim() === '') {
      throw new Error("Handshake Failed: Hugging Face Token is missing. Access Settings to restore link.");
  }

  // --- PROPRIETARY HARDWARE CORE PATH ---
  if (params.useSuperiorEngine) {
    const CINEMATIC_CORE_URL = getCinematicCoreUrl();
    if (!CINEMATIC_CORE_URL) {
        throw new Error("MythOS Cinematic Core URL is not configured in System Settings.");
    }

    const payload = {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || "blurry, low quality, text, watermark, bad anatomy",
        seed: params.seed === undefined ? -1 : params.seed, // -1 is a common convention for random seed in Gradio spaces
        width: params.width || 1024,
        height: params.height || 1024,
        guidance_scale: params.guidance_scale || 7.5,
        num_inference_steps: params.num_inference_steps || 40
    };

    try {
        console.log(`[MythOS] Connecting to GPU Core via Gradio Client: ${CINEMATIC_CORE_URL}...`);
        const client = await getGradioClient(CINEMATIC_CORE_URL, { hfToken });
        
        // Probe for the correct API endpoint name, as it can vary.
        const endpointsToTry = ["/generate_image", "/predict", "/infer", "/generate", "/run"];
        let result: any = null;
        let lastEndpointError: any = null;

        for (const endpoint of endpointsToTry) {
            try {
                console.log(`[MythOS] Probing endpoint: ${endpoint}`);
                result = await client.predict(endpoint, payload);
                if (result?.data) {
                    console.log(`[MythOS] Success at endpoint: ${endpoint}`);
                    break; // Found a working endpoint
                }
            } catch (e: any) {
                lastEndpointError = e;
                if (e.message && (e.message.includes("Not a valid endpoint") || e.message.includes("404"))) {
                    console.warn(`[MythOS] Endpoint ${endpoint} not found, trying next...`);
                    continue; // This is an expected error during probing, so we continue.
                }
                // If it's a different error (e.g., auth, processing timeout), we should stop and throw it.
                throw e;
            }
        }

        if (!result || !result.data) {
             throw new Error(`Could not find a valid API endpoint on the space. Tried: ${endpointsToTry.join(', ')}. Last error: ${lastEndpointError?.message}`);
        }
        
        // Gradio client returns data in `result.data`. For images, it's often an array with one element.
        if (result.data[0]) {
            const output = result.data[0];
            let imageUrl = '';
            
            // Handle various possible Gradio output formats
            if (typeof output === 'string' && output.startsWith('http')) {
                imageUrl = output;
            } else if (output?.url) {
                imageUrl = output.url;
            } else if (output?.image?.url) {
                 imageUrl = output.image.url;
            } else {
                 throw new Error("Gradio client returned an unexpected data format for the image.");
            }

            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to download the generated image from: ${imageUrl}`);
            }
            return imageResponse.blob();

        } else {
            throw new Error("MythOS Core returned no data in the response.");
        }
    } catch (err) {
        // Re-throw the error with more context
        console.error("[MythOS Core] Gradio Client Error:", err);
        const msg = err instanceof Error ? err.message : "An unknown error occurred with the Cinematic Core.";
        if (msg.includes("Space is sleeping")) {
            throw new Error("Hardware Sleeping. Visit the space URL to wake the GPU, then try again.");
        }
        // This makes the original error more specific.
        if (msg.includes("Could not find a valid API endpoint")) {
             throw new Error("Space Path Not Found (404). The Docker container is not listening on known API routes.");
        }
        throw new Error(msg);
    }
  }

  // --- STANDARD FALLBACK (Official HF Inference API) ---
  console.log("[MythOS] Using Standard HF Inference Fallback.");
  try {
    const hf = new HfInference(hfToken);
    return await hf.textToImage({
        model: CINEMATIC_MODEL,
        inputs: params.prompt,
        parameters: {
            negative_prompt: params.negative_prompt,
            width: params.width || 1024,
            height: params.height || 1024,
            num_inference_steps: params.num_inference_steps || 30,
            guidance_scale: params.guidance_scale || 7.5,
            seed: params.seed,
        },
        headers: { "X-Wait-For-Model": "true" } 
    });
  } catch (err) {
    console.error("Standard HF Inference Error:", err);
    throw new Error("Standard neural link failed. The model may be loading or an invalid HF token was provided.");
  }
};
    