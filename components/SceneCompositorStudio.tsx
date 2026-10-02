
import React, { useState } from 'react';
import { SceneCompositorState } from '../types.ts';
import { LoadingSpinner, DownloadIcon, AddToStoryIcon, PinIcon, LayersIcon } from './icons.tsx';
import { getGradioClient } from '../services/gradioService';

interface SceneCompositorStudioProps {
    sceneState: SceneCompositorState;
    isLoading: boolean;
    error: string | null;
    onUpload: (type: 'background' | 'character', file: File) => void;
    onRemoveImage: (type: 'background' | 'character') => void;
    onGenerate: () => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken: string;
    onUpdateImage: (type: 'background' | 'character', base64: string, mimeType: string) => void;
}

const ImageUpload: React.FC<{
    type: 'background' | 'character';
    title: string;
    description: string;
    image: { base64: string; mimeType: string } | null;
    onUpload: (type: 'background' | 'character', file: File) => void;
    onRemoveImage: (type: 'background' | 'character') => void;
    onRemoveBackground?: () => void;
    isRemovingBg?: boolean;
}> = ({ type, title, description, image, onUpload, onRemoveImage, onRemoveBackground, isRemovingBg }) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onUpload(type, file);
        }
        event.target.value = '';
    };

    return (
        <div className="w-full">
            <h3 className="text-lg font-semibold text-neutral-300 mb-1 text-center">{title}</h3>
            <p className="text-xs text-neutral-500 mb-3 text-center">{description}</p>
            {image ? (
                <div className="relative group bg-black/20 rounded overflow-hidden flex flex-col">
                    <div className="aspect-video relative">
                        <img src={`data:${image.mimeType};base64,${image.base64}`} alt={title} className="w-full h-full object-contain" />
                        <button
                            onClick={() => onRemoveImage(type)}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                            aria-label={`Remove ${title}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                    </div>
                    {onRemoveBackground && (
                        <div className="p-2 bg-neutral-900/50 border-t border-neutral-700">
                            <button 
                                onClick={onRemoveBackground}
                                disabled={isRemovingBg}
                                className="w-full text-xs font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 py-1.5 rounded transition-colors flex items-center justify-center gap-2"
                            >
                                {isRemovingBg ? <LoadingSpinner className="w-3 h-3" /> : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                )}
                                Remove Background
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <label htmlFor={`${type}-upload`} className="aspect-video flex flex-col items-center justify-center w-full border-2 border-neutral-700 border-dashed cursor-pointer bg-neutral-900/30 hover:bg-neutral-800/50 transition rounded">
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
        link.download = `composite-result-${Date.now()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="mt-8 space-y-4">
            <h3 className="text-xl font-semibold text-neutral-300 text-center">Composite Result</h3>
            <div className="bg-neutral-800/50 p-4 flex flex-col items-center rounded-lg border border-neutral-700">
                <img src={`data:image/jpeg;base64,${resultImage}`} alt="Composite Result" className="max-w-full max-h-[60vh] shadow-lg" />
                 <div className="mt-4 flex items-center gap-3">
                    <button onClick={() => downloadImage(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><DownloadIcon /> Download</button>
                    <button onClick={() => onAddToStoryboard(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><AddToStoryIcon /> Add to Storyboard</button>
                    <button onClick={() => onAddToInspiration(resultImage)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded"><PinIcon /> Add to Inspiration</button>
                </div>
            </div>
        </div>
    );
};


export const SceneCompositorStudio: React.FC<SceneCompositorStudioProps> = ({ sceneState, isLoading, error, onUpload, onRemoveImage, onGenerate, onAddToStoryboard, onAddToInspiration, hfToken, onUpdateImage }) => {
    const [isRemovingBg, setIsRemovingBg] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleRemoveBackground = async () => {
        if (!sceneState.character) return;
        
        setIsRemovingBg(true);
        setLocalError(null);

        try {
            const blob = await (await fetch(`data:${sceneState.character.mimeType};base64,${sceneState.character.base64}`)).blob();
            
            // Switch to BiRefNet (ZhengPeng7/BiRefNet_demo)
            const client = await getGradioClient("ZhengPeng7/BiRefNet_demo", { hfToken });
            
            // BiRefNet takes [image]
            const result = await client.predict("/predict", [blob]);

            if (result && result.data && (result.data as any[]).length > 0) {
                // Returns [image, mask] usually. The image (index 0) has the alpha channel.
                const resultData = (result.data as any[])[0];
                let resultUrl = '';
                if (typeof resultData === 'object' && resultData.url) {
                    resultUrl = resultData.url;
                } else if (typeof resultData === 'string') {
                    resultUrl = resultData;
                }

                if (resultUrl) {
                    const response = await fetch(resultUrl);
                    const resultBlob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        const base64 = base64data.split(',')[1];
                        // BiRefNet returns PNG with alpha
                        onUpdateImage('character', base64, 'image/png');
                        setIsRemovingBg(false);
                    };
                    reader.readAsDataURL(resultBlob);
                } else {
                    throw new Error("API returned invalid data.");
                }
            } else {
                throw new Error("No data returned from background removal service.");
            }

        } catch (err) {
            console.error("Background Removal Error:", err);
            let errMsg = err instanceof Error ? err.message : "Failed to remove background.";
            if (errMsg.includes("Space metadata")) {
                errMsg = "Failed to connect to AI Service. Please try again or check your HF Token.";
            }
            setLocalError(errMsg);
            setIsRemovingBg(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            {/* Header removed */}
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Compositor Studio</h2>
                <p className="text-neutral-400">"Green screen" a character into a scene. Upload a background image and a foreground/character image to combine them.</p>
            </div>

            <div className="bg-neutral-800/50 p-6 border border-neutral-700 rounded-lg">
                <div className="flex flex-col md:flex-row items-start gap-6">
                    <div className="w-full md:w-1/2">
                        <ImageUpload 
                            type="background" 
                            title="Background / Scene" 
                            description="The main environment." 
                            image={sceneState.background} 
                            onUpload={onUpload} 
                            onRemoveImage={onRemoveImage} 
                        />
                    </div>
                    <div className="w-full md:w-1/2">
                        <ImageUpload 
                            type="character" 
                            title="Character / Foreground" 
                            description="The character or object to add." 
                            image={sceneState.character} 
                            onUpload={onUpload} 
                            onRemoveImage={onRemoveImage}
                            onRemoveBackground={handleRemoveBackground}
                            isRemovingBg={isRemovingBg}
                        />
                    </div>
                </div>

                 <div className="mt-6">
                     <button
                        onClick={onGenerate}
                        disabled={isLoading || !sceneState.background || !sceneState.character || isRemovingBg}
                        className="w-full bg-neutral-700 text-white font-bold py-3 px-4 hover:bg-neutral-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center rounded"
                    >
                        {isLoading ? 'Compositing...' : <><LayersIcon /> Generate Composite</>}
                    </button>
                </div>
            </div>
            
             {(error || localError) && (
                 <div className="mt-8 bg-red-900/20 border border-red-500 p-4 text-center rounded">
                    <h3 className="text-lg font-semibold text-red-400">Error</h3>
                    <p className="mt-1 text-red-300 text-sm">{error || localError}</p>
                </div>
            )}
            
            {isLoading && (
                <div className="mt-8 flex flex-col items-center justify-center min-h-[200px] bg-neutral-900/50 p-4 rounded border border-neutral-800">
                    <LoadingSpinner />
                    <p className="mt-4 text-lg text-neutral-300 animate-pulse">Placing character in scene...</p>
                </div>
            )}
            
            {sceneState.result && !isLoading && (
                 <ResultDisplay
                    resultImage={sceneState.result}
                    onAddToStoryboard={onAddToStoryboard}
                    onAddToInspiration={onAddToInspiration}
                />
            )}
        </div>
    );
};
