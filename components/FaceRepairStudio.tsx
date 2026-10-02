
import React, { useState } from 'react';
import { FaceRepairState } from '../types.ts';
import { LoadingSpinner, DownloadIcon, AddToStoryIcon, PinIcon, FaceSparkleIcon } from './icons.tsx';
import { getGradioClient } from '../services/gradioService';

interface FaceRepairStudioProps {
    faceRepairState: FaceRepairState;
    isLoading: boolean;
    error: string | null;
    onUpload: (file: File) => void;
    onRemoveImage: () => void;
    onGenerate: () => void; // Legacy
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const ImageUpload: React.FC<{
    image: { base64: string; mimeType: string } | null;
    onUpload: (file: File) => void;
    onRemoveImage: () => void;
}> = ({ image, onUpload, onRemoveImage }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onUpload(file);
        }
        event.target.value = '';
    };

    if (image) {
        return (
            <div className="relative group w-full max-w-lg mx-auto rounded overflow-hidden bg-black/20">
                <img src={`data:${image.mimeType};base64,${image.base64}`} alt="Source for face repair" className="w-full h-full object-cover" />
                <button
                    onClick={onRemoveImage}
                    className="absolute top-2 right-2 bg-black/50 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-red-600"
                    aria-label="Remove Image"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
            </div>
        )
    }

    return (
        <label htmlFor="face-repair-upload" className="w-full h-[50vh] flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/30 cursor-pointer hover:bg-neutral-800/50 transition text-neutral-500">
            <div className="flex flex-col items-center justify-center p-4 text-center">
                <div className="w-16 h-16 text-neutral-700 mb-4"><FaceSparkleIcon /></div>
                <h3 className="text-xl font-semibold text-neutral-300 mb-2">Upload Image for Face Repair</h3>
                <p className="text-sm">Click here to select a file</p>
            </div>
            <input id="face-repair-upload" type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
        </label>
    );
};

const ResultDisplay: React.FC<{
    source: { base64: string; mimeType: string };
    resultImage: string;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
}> = ({ source, resultImage, onAddToStoryboard, onAddToInspiration }) => {
    const downloadImage = (base64: string) => {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64}`;
        link.download = `face-repair-result-${Date.now()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mt-8 space-y-4">
            <h3 className="text-xl font-semibold text-neutral-300 text-center">Repair Result</h3>
            <div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-700">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full md:w-1/2">
                        <h4 className="text-center text-lg font-semibold text-neutral-400 mb-2">Before</h4>
                        <img src={`data:${source.mimeType};base64,${source.base64}`} alt="Original" className="w-full shadow-lg rounded" />
                    </div>
                    <div className="w-full md:w-1/2">
                        <h4 className="text-center text-lg font-semibold text-neutral-300 mb-2">After</h4>
                        <img src={`data:image/jpeg;base64,${resultImage}`} alt="Repaired Result" className="w-full shadow-lg rounded" />
                    </div>
                </div>
                 <div className="mt-4 flex items-center justify-center gap-3">
                    <button onClick={() => downloadImage(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><DownloadIcon /> Download</button>
                    <button onClick={() => onAddToStoryboard(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><AddToStoryIcon /> Add to Storyboard</button>
                    <button onClick={() => onAddToInspiration(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><PinIcon /> Add to Inspiration</button>
                </div>
            </div>
        </div>
    );
};

export const FaceRepairStudio: React.FC<FaceRepairStudioProps> = ({ faceRepairState, isLoading: parentIsLoading, error: parentError, onUpload, onRemoveImage, onGenerate: parentOnGenerate, onAddToStoryboard, onAddToInspiration, hfToken }) => {
    const [localLoading, setLocalLoading] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [localResult, setLocalResult] = useState<string | null>(faceRepairState.result);

    const handleRepair = async () => {
        if (!faceRepairState.source) return;
        setLocalLoading(true);
        setLocalError(null);

        try {
            const blob = await base64ToBlob(faceRepairState.source.base64, faceRepairState.source.mimeType);
            
            // TODO: Point to local server (http://localhost:7860) when running CodeFormer locally.
            // Target: sczhou/CodeFormer (standard reference)
            const client = await getGradioClient("sczhou/CodeFormer", { hfToken });
            
            // CodeFormer predict params: [image, background_enhance(bool), face_upsample(bool), upscale(float)]
            const result = await client.predict("/predict", [
                blob,
                true, // Background enhance
                true, // Face upsample
                2     // Upscale factor
            ]);

            if (result && result.data && result.data.length > 0) {
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
                throw new Error("Invalid response from Restoration API");
            }

        } catch (e) {
            console.error("Face Repair Error:", e);
            setLocalError(e instanceof Error ? e.message : "Repair failed.");
            setLocalLoading(false);
        }
    };

    const isLoading = parentIsLoading || localLoading;
    const error = parentError || localError;

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Face Repair Studio</h2>
                <p className="text-neutral-400">Improve the quality of faces in your images. Fix blur, enhance details, and correct lighting.</p>
            </div>
            
            <div className="flex flex-col items-center gap-6">
                <ImageUpload image={faceRepairState.source} onUpload={onUpload} onRemoveImage={onRemoveImage} />

                {faceRepairState.source && (
                    <button
                        onClick={handleRepair}
                        disabled={isLoading}
                        className="w-full max-w-xs bg-neutral-700 text-white font-bold py-3 px-4 hover:bg-neutral-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded"
                    >
                        {isLoading ? 'Repairing...' : <><FaceSparkleIcon /> Repair Face</>}
                    </button>
                )}
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
                    <p className="mt-4 text-lg text-neutral-300 animate-pulse">Enhancing face...</p>
                </div>
            )}
            
            {localResult && faceRepairState.source && !isLoading && (
                 <ResultDisplay
                    source={faceRepairState.source}
                    resultImage={localResult}
                    onAddToStoryboard={onAddToStoryboard}
                    onAddToInspiration={onAddToInspiration}
                />
            )}
        </div>
    );
};
