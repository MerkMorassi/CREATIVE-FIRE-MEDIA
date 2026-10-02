
import React, { useState } from 'react';
import { FaceSwapState } from '../types.ts';
import { LoadingSpinner, DownloadIcon, AddToStoryIcon, PinIcon, SwapIcon } from './icons.tsx';
import { getGradioClient } from '../services/gradioService';

interface FaceSwapStudioProps {
    faceSwapState: FaceSwapState;
    isLoading: boolean;
    error: string | null;
    onUpload: (type: 'source' | 'face', file: File) => void;
    onRemoveImage: (type: 'source' | 'face') => void;
    onGenerate: () => void; // Legacy prop
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string; 
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const ImageUpload: React.FC<{
    type: 'source' | 'face';
    title: string;
    image: { base64: string; mimeType: string } | null;
    onUpload: (type: 'source' | 'face', file: File) => void;
    onRemoveImage: (type: 'source' | 'face') => void;
}> = ({ type, title, image, onUpload, onRemoveImage }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onUpload(type, file);
        }
        event.target.value = '';
    };

    return (
        <div className="w-full">
            <h3 className="text-lg font-semibold text-neutral-300 mb-3 text-center">{title}</h3>
            {image ? (
                <div className="relative group aspect-square rounded overflow-hidden bg-black/20">
                    <img src={`data:${image.mimeType};base64,${image.base64}`} alt={title} className="w-full h-full object-contain" />
                    <button
                        onClick={() => onRemoveImage(type)}
                        className="absolute top-2 right-2 bg-black/50 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-600"
                        aria-label={`Remove ${title}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            ) : (
                <label htmlFor={`${type}-upload`} className="aspect-square flex flex-col items-center justify-center w-full border-2 border-neutral-700 border-dashed cursor-pointer bg-neutral-900/30 hover:bg-neutral-800/50 transition rounded">
                    <div className="flex flex-col items-center justify-center text-neutral-400 p-4 text-center">
                        <svg className="w-8 h-8 mb-2" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                        <p className="text-sm">Click to upload</p>
                    </div>
                    <input id={`${type}-upload`} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                </label>
            )}
        </div>
    );
};

const ResultDisplay: React.FC<{
    resultImage: string;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
}> = ({ resultImage, onAddToStoryboard, onAddToInspiration }) => {
    const downloadImage = (base64: string) => {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64}`;
        link.download = `faceswap-result-${Date.now()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mt-8 space-y-4">
            <h3 className="text-xl font-semibold text-neutral-300 text-center">Face Swap Result</h3>
            <div className="bg-neutral-800/50 p-4 flex flex-col items-center rounded-lg border border-neutral-700">
                <img src={`data:image/jpeg;base64,${resultImage}`} alt="Face Swap Result" className="max-w-full max-h-[60vh] shadow-lg" />
                 <div className="mt-4 flex items-center gap-3">
                    <button onClick={() => downloadImage(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><DownloadIcon /> Download</button>
                    <button onClick={() => onAddToStoryboard(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><AddToStoryIcon /> Add to Storyboard</button>
                    <button onClick={() => onAddToInspiration(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><PinIcon /> Add to Inspiration</button>
                </div>
            </div>
        </div>
    );
};


export const FaceSwapStudio: React.FC<FaceSwapStudioProps> = ({ faceSwapState, isLoading: parentIsLoading, error: parentError, onUpload, onRemoveImage, onGenerate: parentOnGenerate, onAddToStoryboard, onAddToInspiration, hfToken }) => {
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [localResult, setLocalResult] = useState<string | null>(faceSwapState.result);

    const handleSwap = async () => {
        if (!faceSwapState.source || !faceSwapState.face) return;
        
        setLocalLoading(true);
        setLocalError(null);

        try {
            const sourceBlob = await base64ToBlob(faceSwapState.source.base64, faceSwapState.source.mimeType);
            const faceBlob = await base64ToBlob(faceSwapState.face.base64, faceSwapState.face.mimeType);

            // TODO: Point this to your local server (e.g. "http://localhost:7860") when GB10 is online.
            // Current Target: A standard Face Swap space like 'tonet/FaceSwap' or equivalent.
            const client = await getGradioClient("tonet/FaceSwap", { hfToken });
            
            const result = await client.predict("/predict", [
                sourceBlob,
                faceBlob,
            ]);

            if (result && result.data && result.data.length > 0) {
                // Gradio usually returns a file path or URL object
                let resultUrl = result.data[0];
                if (typeof resultUrl === 'object' && resultUrl.url) resultUrl = resultUrl.url;

                const res = await fetch(resultUrl);
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    setLocalResult(base64);
                    setLocalLoading(false);
                };
                reader.readAsDataURL(blob);
            } else {
                throw new Error("Invalid response from Face Swap API");
            }

        } catch (e) {
            console.error("Face Swap Error:", e);
            setLocalError(e instanceof Error ? e.message : "Face swap failed. Ensure Hugging Face token is set if using private space.");
            setLocalLoading(false);
        }
    };

    const isLoading = parentIsLoading || localLoading;
    const error = parentError || localError;

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Face Swap Studio</h2>
                <p className="text-neutral-400">Upload a source image (body/scene) and a face image to perform identity replacement.</p>
            </div>

            <div className="bg-neutral-800/50 p-6 border border-neutral-700 rounded-lg">
                <div className="flex flex-col md:flex-row items-start gap-6">
                    <div className="w-full md:w-2/5">
                        <ImageUpload type="source" title="Target Body/Scene" image={faceSwapState.source} onUpload={onUpload} onRemoveImage={onRemoveImage} />
                    </div>
                    <div className="w-full md:w-1/5 flex flex-col items-center justify-center pt-16">
                         <button
                            onClick={handleSwap}
                            disabled={isLoading || !faceSwapState.source || !faceSwapState.face}
                            className="w-full bg-neutral-700 text-white font-bold py-3 px-4 hover:bg-neutral-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center rounded"
                        >
                            {isLoading ? 'Swapping...' : <><SwapIcon /> Generate Face Swap</>}
                        </button>
                    </div>
                    <div className="w-full md:w-2/5">
                        <ImageUpload type="face" title="Source Face" image={faceSwapState.face} onUpload={onUpload} onRemoveImage={onRemoveImage} />
                    </div>
                </div>
            </div>
            
             {error && (
                 <div className="mt-8 bg-red-900/20 border border-red-500 p-4 text-center rounded">
                    <h3 className="text-lg font-semibold text-red-400">Generation Failed</h3>
                    <p className="mt-1 text-red-300 text-sm">{error}</p>
                </div>
            )}
            
            {isLoading && (
                <div className="mt-8 flex flex-col items-center justify-center min-h-[200px] bg-neutral-900/50 p-4 rounded border border-neutral-800">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg text-neutral-300 animate-pulse">Running identity replacement...</p>
                </div>
            )}
            
            {localResult && !isLoading && (
                 <ResultDisplay
                    resultImage={localResult}
                    onAddToStoryboard={onAddToStoryboard}
                    onAddToInspiration={onAddToInspiration}
                />
            )}
        </div>
    );
};
