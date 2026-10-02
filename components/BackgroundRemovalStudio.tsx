
import React, { useState, useRef } from 'react';
import { BackgroundRemovalState } from '../types.ts';
import { LoadingSpinner, ScissorsIcon, ImageIcon } from './icons.tsx';
import { AssetActions } from './AssetActions.tsx';
import { getGradioClient } from '../services/gradioService';

interface BackgroundRemovalStudioProps {
    state: BackgroundRemovalState;
    onStateUpdate: (newState: BackgroundRemovalState) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

export const BackgroundRemovalStudio: React.FC<BackgroundRemovalStudioProps> = ({ 
    state, 
    onStateUpdate, 
    onAddToStoryboard, 
    onAddToInspiration,
    onAddAssetToGrid,
    hfToken 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
                const base64 = result.split(',')[1];
                onStateUpdate({ ...state, source: { base64, mimeType }, result: null });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleProcess = async () => {
        if (!state.source) {
            setError("No image uploaded.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress('Initializing AI Service...');
        
        try {
            const blob = await base64ToBlob(state.source.base64, state.source.mimeType);
            
            // Connect to not-lain/background-removal space
            const client = await getGradioClient("not-lain/background-removal", { hfToken });
            
            setProgress('Removing background...');
            
            // Expected prediction signature for not-lain/background-removal: [image] -> image path
            const result = await client.predict("/predict", [blob]);

            if (result && result.data && result.data.length > 0) {
                // Usually returns [image_path] or [url]
                let resultUrl = '';
                const output = result.data[0];
                
                if (typeof output === 'string') {
                    resultUrl = output;
                } else if (output?.url) {
                    resultUrl = output.url;
                }

                if (resultUrl) {
                    // Fetch result to convert to base64
                    const response = await fetch(resultUrl);
                    const resultBlob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        const base64 = base64data.split(',')[1];
                        onStateUpdate({ 
                            ...state, 
                            result: { base64, mimeType: resultBlob.type } 
                        });
                        setIsLoading(false);
                    };
                    reader.readAsDataURL(resultBlob);
                } else {
                    throw new Error("Could not parse result from AI service.");
                }
            } else {
                throw new Error("API returned no data.");
            }

        } catch (err: any) {
            console.error("BG Removal Error:", err);
            let errorMessage = "Background removal failed.";
            if (err instanceof Error) {
                errorMessage = err.message;
                if (errorMessage.includes("Space metadata")) {
                    errorMessage = "Failed to connect to AI Service. Please check your HF Token or try again later.";
                }
            }
            setError(errorMessage);
            setIsLoading(false);
        } finally {
            setProgress('');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Background Remover (Pro)</h2>
                <p className="text-neutral-400">High-precision background removal powered by not-lain/background-removal.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow">
                {/* Input Column */}
                <div className="flex flex-col gap-6">
                    <div className="bg-neutral-800/50 p-6 border border-neutral-700 rounded-xl flex-grow flex flex-col items-center justify-center relative min-h-[400px]">
                        {state.source ? (
                            <div className="relative w-full h-full flex items-center justify-center bg-black/40 rounded-lg overflow-hidden border border-neutral-700">
                                <img 
                                    src={`data:${state.source.mimeType};base64,${state.source.base64}`} 
                                    alt="Source"
                                    className="max-w-full max-h-[500px] object-contain" 
                                />
                                <button 
                                    onClick={() => onStateUpdate({ ...state, source: null, result: null })}
                                    className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors"
                                    title="Remove Image"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ) : (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="text-center cursor-pointer p-8 border-2 border-dashed border-neutral-600 rounded-xl hover:border-neutral-400 hover:bg-neutral-800/50 transition-all w-full h-full flex flex-col items-center justify-center"
                            >
                                <div className="mb-4 p-4 bg-neutral-800 rounded-full">
                                    <ImageIcon className="w-12 h-12 text-neutral-500" />
                                </div>
                                <h3 className="text-xl font-bold text-neutral-400">Upload Image</h3>
                                <p className="text-sm text-neutral-500 mt-2">JPG, PNG, WEBP</p>
                            </div>
                        )}
                        <input 
                            ref={fileInputRef} 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleUpload} 
                        />
                    </div>
                    
                    <button
                        onClick={handleProcess}
                        disabled={isLoading || !state.source}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <><LoadingSpinner className="w-5 h-5 text-white" /> {progress || 'Processing...'}</>
                        ) : (
                            <><ScissorsIcon className="w-5 h-5" /> Remove Background</>
                        )}
                    </button>
                    
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm font-medium flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            {error}
                        </div>
                    )}
                </div>

                {/* Output Column */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col relative overflow-hidden min-h-[400px]">
                    <div className="p-4 border-b border-neutral-800 bg-neutral-800/90 backdrop-blur-sm flex justify-between items-center">
                        <h3 className="font-bold text-neutral-300">Transparent Output</h3>
                        {state.result && (
                            <div className="text-xs text-green-400 font-bold bg-green-900/30 px-2 py-1 rounded border border-green-500/30">Success</div>
                        )}
                    </div>
                    
                    <div className="flex-grow flex items-center justify-center bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-neutral-800/30 p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <LoadingSpinner className="w-12 h-12 text-blue-500" />
                                <p className="mt-4 text-neutral-400 animate-pulse font-mono text-sm">{progress}</p>
                            </div>
                        ) : state.result ? (
                            <img 
                                src={`data:${state.result.mimeType};base64,${state.result.base64}`} 
                                alt="Processed Result"
                                className="max-w-full max-h-full object-contain shadow-2xl"
                            />
                        ) : (
                            <div className="text-neutral-600 flex flex-col items-center select-none">
                                <div className="w-20 h-20 border-2 border-dashed border-neutral-700 rounded-full flex items-center justify-center mb-4">
                                    <ScissorsIcon className="w-10 h-10 opacity-30" />
                                </div>
                                <p className="text-sm font-medium opacity-50">Output will appear here</p>
                            </div>
                        )}
                    </div>

                    {state.result && !isLoading && (
                        <div className="p-4 border-t border-neutral-800 bg-neutral-800/90 backdrop-blur-sm flex justify-center">
                            <AssetActions 
                                asset={{ type: 'image', base64: state.result.base64, mimeType: state.result.mimeType }}
                                onSaveToGrid={onAddAssetToGrid ? () => onAddAssetToGrid({ type: 'image', base64: state.result!.base64, mimeType: state.result!.mimeType }) : undefined}
                                onSaveToStoryboard={() => onAddToStoryboard(state.result!.base64)}
                                onSaveToInspiration={() => onAddToInspiration(state.result!.base64)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
