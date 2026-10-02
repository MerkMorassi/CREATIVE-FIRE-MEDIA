
import React, { useRef, useState } from 'react';
import { BlenderImage } from '../types.ts';
import { LoadingSpinner, DownloadIcon, AddToStoryIcon, PinIcon, BlenderIcon } from './icons.tsx';
import { getGradioClient } from '../services/gradioService';

interface BlenderStudioProps {
    sourceImages: BlenderImage[];
    resultImage: string | null;
    isLoading: boolean;
    error: string | null;
    onUpload: (files: FileList) => void;
    onRemoveImage: (id: string) => void;
    onGenerate: () => void; // Legacy
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string): Promise<Blob> => {
    // Assuming jpeg for simplicity in blender context, or detect from mime if stored in blender image type
    const res = await fetch(`data:image/jpeg;base64,${base64}`);
    return await res.blob();
};

const ResultDisplay: React.FC<{
    resultImage: string;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
}> = ({ resultImage, onAddToStoryboard, onAddToInspiration }) => {

    const downloadImage = (base64: string) => {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64}`;
        link.download = `blender-result-${Date.now()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mt-8 space-y-4">
            <h3 className="text-xl font-semibold text-neutral-300 text-center">Blender Result</h3>
            <div className="bg-neutral-800/50 p-4 flex flex-col items-center rounded-lg border border-neutral-700">
                <img src={`data:image/jpeg;base64,${resultImage}`} alt="Blender Result" className="max-w-full max-h-[60vh] shadow-lg" />
                <div className="mt-4 flex items-center gap-3">
                    <button onClick={() => downloadImage(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><DownloadIcon /> Download</button>
                    <button onClick={() => onAddToStoryboard(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><AddToStoryIcon /> Add to Storyboard</button>
                    <button onClick={() => onAddToInspiration(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><PinIcon /> Add to Inspiration</button>
                </div>
            </div>
        </div>
    );
};


export const BlenderStudio: React.FC<BlenderStudioProps> = ({ sourceImages, resultImage: parentResult, isLoading: parentIsLoading, error: parentError, onUpload, onRemoveImage, onGenerate, onAddToStoryboard, onAddToInspiration, hfToken }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [localResult, setLocalResult] = useState<string | null>(parentResult);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            onUpload(event.target.files);
        }
        event.target.value = ''; // Reset
    };

    const handleBlend = async () => {
        if (sourceImages.length === 0) return;
        setLocalLoading(true);
        setLocalError(null);

        try {
            // Prepare inputs: Standard Image Mixer usually takes 1-5 images
            const inputs = await Promise.all(sourceImages.map(img => base64ToBlob(img.base64)));
            
            // TODO: Point to local server (http://localhost:7860) when Image Mixer is running locally.
            // Target: lambda-labs/image-mixer-demo (standard ref) takes 5 images + 5 strengths
            
            const client = await getGradioClient("lambda-labs/image-mixer-demo", { hfToken });
            
            // Construct args: [img1, strength1, img2, strength2, ... prompt, negative, cfg, steps, seed]
            const args = [];
            for (let i = 0; i < 5; i++) {
                if (i < inputs.length) {
                    args.push(inputs[i]); // Image
                    args.push(1.0);       // Strength default
                } else {
                    args.push(null);
                    args.push(1.0);
                }
            }
            
            // Add prompt args
            args.push(""); // Prompt
            args.push("blurry, low quality"); // Negative
            args.push(5.0); // CFG
            args.push(30); // Steps
            args.push(42); // Seed
            
            const result = await client.predict("/predict", args);

            if (result && result.data && result.data.length > 0) {
                // Usually returns [image]
                let resultUrl = result.data[0];
                if (typeof resultUrl === 'object' && resultUrl.url) resultUrl = resultUrl.url;

                const res = await fetch(resultUrl);
                const resBlob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    setLocalResult(base64);
                    setLocalLoading(false);
                };
                reader.readAsDataURL(resBlob);
            } else {
                throw new Error("Invalid response from Image Mixer API");
            }

        } catch (e) {
            console.error("Blender Error:", e);
            setLocalError(e instanceof Error ? e.message : "Blending failed.");
            setLocalLoading(false);
        }
    };

    const isLoading = parentIsLoading || localLoading;
    const error = parentError || localError;
    const resultToDisplay = localResult || parentResult;
    
    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Blender Studio</h2>
                <p className="text-neutral-400">Upload multiple images (concepts, styles, or faces) and the AI will blend their features into a single, new composition.</p>
            </div>

            <div className="bg-neutral-800/50 p-6 border border-neutral-700 rounded-lg">
                <h3 className="text-lg font-semibold text-neutral-300 mb-4">Source Images (Max 5)</h3>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 mb-6">
                    {sourceImages.map(img => (
                        <div key={img.id} className="relative group aspect-square rounded overflow-hidden">
                            <img src={`data:image/jpeg;base64,${img.base64}`} alt="Source" className="w-full h-full object-cover"/>
                            <button
                                onClick={() => onRemoveImage(img.id)}
                                className="absolute top-1 right-1 bg-black/50 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                aria-label="Remove image"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    ))}
                     <label htmlFor="blender-upload" className="aspect-square flex flex-col items-center justify-center w-full border-2 border-neutral-700 border-dashed cursor-pointer bg-neutral-900/30 hover:bg-neutral-800/50 transition rounded text-neutral-500 hover:text-neutral-300">
                        <div className="flex flex-col items-center justify-center">
                           <div className="w-8 h-8 mb-2"><BlenderIcon /></div>
                           <span className="text-xs">Add Images</span>
                        </div>
                        <input id="blender-upload" type="file" className="hidden" onChange={handleFileChange} multiple accept="image/*"/>
                    </label>
                </div>

                 <button
                    onClick={handleBlend}
                    disabled={isLoading || sourceImages.length < 1}
                    className="w-full bg-neutral-700 text-white font-bold py-3 px-4 hover:bg-neutral-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center rounded"
                >
                    {isLoading ? 'Blending...' : `Generate Blend (${sourceImages.length} images)`}
                </button>
            </div>

             {error && (
                 <div className="mt-6 bg-red-900/20 border border-red-500 p-4 text-center rounded">
                    <h3 className="text-lg font-semibold text-red-400">Generation Failed</h3>
                    <p className="mt-1 text-red-300 text-sm">{error}</p>
                </div>
            )}
            
            {isLoading && (
                <div className="mt-6 flex flex-col items-center justify-center min-h-[200px] bg-neutral-900/50 p-4 rounded border border-neutral-800">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg text-neutral-300 animate-pulse">Blending features...</p>
                </div>
            )}

            {resultToDisplay && !isLoading && (
                <ResultDisplay 
                    resultImage={resultToDisplay}
                    onAddToStoryboard={onAddToStoryboard}
                    onAddToInspiration={onAddToInspiration}
                />
            )}
        </div>
    );
};
