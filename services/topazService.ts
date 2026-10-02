
import { TopazState } from '../types.ts';

const API_BASE_URL = 'https://api.topazlabs.com/v1';
const IMAGE_V1_BASE_URL = 'https://api.topazlabs.com/image/v1';
const VIDEO_V1_BASE_URL = 'https://api.topazlabs.com/video/v1';

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const getVideoMetadata = (base64: string, mimeType: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            resolve({ width: video.videoWidth, height: video.videoHeight });
            video.remove();
        };
        video.onerror = () => {
            video.remove();
            reject(new Error("Could not load video metadata for processing."));
        };
        video.src = `data:${mimeType};base64,${base64}`;
    });
};

const formatEta = (eta: number | undefined): string => {
    if (typeof eta !== 'number') return '';
    
    // Check if ETA is likely a timestamp (e.g., > Jan 1 2021)
    const isTimestamp = eta > 1609459200; 
    let secondsRemaining = eta;

    if (isTimestamp) {
        secondsRemaining = eta - (Date.now() / 1000);
    }

    if (secondsRemaining <= 0) return '';
    
    if (secondsRemaining < 60) {
        return `${Math.round(secondsRemaining)}s`;
    }
    
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = Math.round(secondsRemaining % 60);
    return `${minutes}m ${seconds}s`;
};

export const processImage = async (
    apiKey: string, 
    state: TopazState,
    onProgress: (status: string, percent?: number) => void
): Promise<string> => {
    if (!apiKey) throw new Error("Topaz API Key is missing.");
    if (!state.source) throw new Error("No source image provided.");

    // 1. Create FormData
    const formData = new FormData();
    const blob = await base64ToBlob(state.source.base64, state.source.mimeType);
    formData.append('image', blob, 'input.png'); // Send as png or original ext
    
    let url = '';
    
    // 2. Determine Endpoint and Parameters based on operation
    if (state.operation === 'enhance') {
       // Use Async endpoint for better reliability with larger images/timeouts
       url = `${IMAGE_V1_BASE_URL}/enhance/async`;
       
       // Parameters matching Topaz Image V1 Enhance (Async)
       formData.append('model', 'Standard V2'); 
       formData.append('face_enhancement', state.faceRecovery ? 'true' : 'false');
       formData.append('output_format', 'png');
       
       formData.append('scale', state.parameters.scale.toString());
       
       // Extras from example
       formData.append('crop_to_fill', 'true'); 
       formData.append('subject_detection', 'Foreground'); 
       
    } else if (state.operation === 'restore') {
       // Generative Enhance / Restore using Recovery V2
       url = `${IMAGE_V1_BASE_URL}/enhance-gen/async`;
       
       formData.append('model', 'Recovery V2');
       formData.append('face_enhancement', state.faceRecovery ? 'true' : 'false');
       formData.append('output_format', 'png');
       formData.append('crop_to_fill', 'true');
       formData.append('subject_detection', 'Foreground');

    } else if (state.operation === 'sharpen') {
       // Synchronous Sharpen using Topaz Image V1
       url = `${IMAGE_V1_BASE_URL}/sharpen`;
       
       formData.append('model', 'Standard');
       formData.append('face_enhancement', state.faceRecovery ? 'true' : 'false');
       formData.append('output_format', 'png');
       formData.append('subject_detection', 'Background');

    } else {
       // Legacy/Other endpoints (Denoise, etc. typically use the general v1 API)
       
       if (state.operation === 'denoise') url = `${API_BASE_URL}/image/denoise`;
       else if (state.operation === 'lighting') url = `${API_BASE_URL}/image/lighting`;
       else url = `${API_BASE_URL}/image/enhance`; // Fallback

       formData.append('strength', (state.parameters.strength / 100).toString());
       
       if (['denoise'].includes(state.operation)) {
           formData.append('face_recovery', state.faceRecovery ? 'true' : 'false');
       }
    }
    
    // 3. Initiate Request
    onProgress(`Uploading image for ${state.operation}...`, 10);
    
    const headers: Record<string, string> = {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
    };

    try {
        const createRes = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Topaz API Error (${createRes.status}): ${errText}`);
        }

        const createData = await createRes.json();
        
        // Handle Synchronous Response (Direct URL)
        if (createData.output_url) {
            onProgress('Downloading result...', 100);
            return await fetchResult(createData.output_url);
        }

        // Handle Asynchronous Response (Process ID)
        const processId = createData.process_id || createData.id;
        if (!processId) {
            throw new Error("API did not return a process ID or output URL.");
        }

        // 4. Poll for status
        let attempts = 0;
        const maxAttempts = 300; 
        
        // Simulated progress for async image tasks (starts at 20%)
        let simulatedProgress = 20;

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;

            const statusRes = await fetch(`${API_BASE_URL}/requests/${processId}`, {
                headers: { 'X-API-Key': apiKey }
            });
            
            if (!statusRes.ok) continue; 
            
            const statusData = await statusRes.json();
            
            if (statusData.status === 'failed') {
                throw new Error(`Topaz Processing Failed: ${statusData.error || 'Unknown error'}`);
            }
            
            if (statusData.status === 'completed' || statusData.status === 'success') {
                if (statusData.output_url) {
                    onProgress('Downloading result...', 100);
                    return await fetchResult(statusData.output_url);
                }
            }
            
            const statusMsg = statusData.status || 'running';
            const etaString = formatEta(statusData.eta);
            const etaDisplay = etaString ? ` (ETA: ${etaString})` : '';
            
            // Slowly increment simulated progress while running
            if (simulatedProgress < 90) {
                simulatedProgress += (90 - simulatedProgress) * 0.05; // Asymptotic approach to 90
            }

            onProgress(`Processing... (${statusMsg})${etaDisplay}`, Math.floor(simulatedProgress));
        }

        throw new Error("Processing timed out.");

    } catch (error) {
        console.error("Topaz Service Error:", error);
        throw error;
    }
};

export const processVideo = async (
    apiKey: string, 
    state: TopazState,
    onProgress: (status: string, percent?: number) => void
): Promise<string> => {
    if (!apiKey) throw new Error("Topaz API Key is missing.");
    if (!state.source) throw new Error("No source video provided.");

    // 1. Get Metadata for Dimensions
    onProgress('Extracting video metadata...', 5);
    const { width, height } = await getVideoMetadata(state.source.base64, state.source.mimeType);
    const scale = state.parameters.scale || 1;
    const outputWidth = Math.round(width * scale);
    const outputHeight = Math.round(height * scale);

    // 2. Create FormData
    const formData = new FormData();
    const blob = await base64ToBlob(state.source.base64, state.source.mimeType);
    formData.append('video', blob, 'input_video.mp4');
    
    // 3. Set Parameters based on Playground defaults
    formData.append('output_width', outputWidth.toString());
    formData.append('output_height', outputHeight.toString());
    
    // Recommended Models from Playground
    formData.append('enhancement_model', 'prob-4'); // Proteus v4
    formData.append('frame_interpolation_model', 'apo-8'); // Apollo v8
    
    // Output Settings
    formData.append('video_encoder', 'h265');
    formData.append('video_profile', 'main');
    formData.append('audio_transfer', 'copy');
    
    // Defaults from playground
    formData.append('slow_motion_rate', '1'); 

    onProgress(`Uploading video for enhancement (Proteus/Apollo)...`, 10);
    
    // Using Video V1 Endpoint
    const createRes = await fetch(`${VIDEO_V1_BASE_URL}/enhance`, {
        method: 'POST',
        headers: {
            'X-API-Key': apiKey
        },
        body: formData
    });

    if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Topaz Video API Error: ${createRes.status} - ${errText}`);
    }

    const createData = await createRes.json();
    const processId = createData.process_id || createData.id;

    if (!processId) {
        throw new Error("API did not return a process ID.");
    }

    // 4. Poll for status (Video takes longer)
    onProgress('Processing video (this may take several minutes)...', 15);
    let attempts = 0;
    const maxAttempts = 900; // 30 minutes approx (2s interval)
    
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        const statusRes = await fetch(`${API_BASE_URL}/requests/${processId}`, {
            headers: { 'X-API-Key': apiKey }
        });
        
        if (!statusRes.ok) continue; 
        
        const statusData = await statusRes.json();
        
        if (statusData.status === 'failed') {
            throw new Error(`Topaz Video Processing Failed: ${statusData.error || 'Unknown error'}`);
        }
        
        if (statusData.status === 'completed' || statusData.status === 'success') {
            if (statusData.output_url) {
                onProgress('Video processing complete.', 100);
                return statusData.output_url; 
            }
        }
        
        const percent = statusData.percent;
        const percentStr = percent ? ` ${percent}%` : '';
        const etaString = formatEta(statusData.eta);
        const etaDisplay = etaString ? ` (ETA: ${etaString})` : '';
        
        onProgress(`Processing video...${percentStr}${etaDisplay}`, typeof percent === 'number' ? percent : undefined);
    }

    throw new Error("Video processing timed out.");
};

const fetchResult = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
