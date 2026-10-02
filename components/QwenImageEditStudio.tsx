
import React, { useState, useRef } from 'react';
import { QwenImageEditState } from '../types.ts';
import { LoadingSpinner, ImageIcon, MagicIcon, ChevronDownIcon, EditIcon } from './icons.tsx';
import { AssetActions } from './AssetActions.tsx';
import { getGradioClient } from '../services/gradioService';

interface QwenImageEditStudioProps {
    state: QwenImageEditState;
    onStateUpdate: (newState: QwenImageEditState) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const ImageSlot: React.FC<{
    index: number;
    image: { base64: string; mimeType: string } | null;
    onUpload: (index: number, file: File) => void;
    onRemove: (index: number) => void;
}> = ({ index, image, onUpload, onRemove }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(index, file);
        }
        e.target.value = '';
    };

    return (
        <div 
            className="relative aspect-square bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors group"
            onClick={() => !image && inputRef.current?.click()}
        >
            {image ? (
                <>
                    <img 
                        src={`data:${image.mimeType};base64,${image.base64}`} 
                        className="w-full h-full object-contain" 
                        alt={`Slot ${index + 1}`} 
                    />
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove Image"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                    <div className="absolute bottom-0 left-0 bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white rounded-tr-lg">Img {index + 1}</div>
                </>
            ) : (
                <div className="text-neutral-600 flex flex-col items-center group-hover:text-blue-400">
                    <span className="text-2xl font-light">+</span>
                    <span className="text-[10px] uppercase font-bold">Img {index + 1}</span>
                </div>
            )}
            <input 
                ref={inputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleChange} 
            />
        </div>
    );
};

export const QwenImageEditStudio: React.FC<QwenImageEditStudioProps> = ({ 
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
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleImageUpload = (index: number, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
            const base64 = result.split(',')[1];
            const newImages = [...state.images];
            newImages[index] = { base64, mimeType };
            onStateUpdate({ ...state, images: newImages, result: null });
        };
        reader.readAsDataURL(file);
    };

    const handleImageRemove = (index: number) => {
        const newImages = [...state.images];
        newImages[index] = null;
        onStateUpdate({ ...state, images: newImages });
    };

    const handleReset = () => {
        onStateUpdate({
            images: [null, null, null, null, null, null],
            result: null,
            prompt: '',
            negativePrompt: '',
            cfgScale: 4.0,
            seed: 0,
            randomizeSeed: true,
            width: 1024,
            height: 1024,
            steps: 25
        });
    };

    const handleGenerate = async () => {
        const validImages = state.images.filter(img => img !== null);
        if (validImages.length < 2) {
            setError("Please upload at least 2 images for composition.");
            return;
        }
        if (!state.prompt.trim()) {
            setError("Please provide an editing prompt.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress('Connecting to MICo...');
        
        try {
            // Prepare inputs. The API expects 6 slots; fill empties with null (which becomes null in API call usually)
            // But we need to check how client handles null for files. Usually undefined or null works.
            // We'll map base64 to blobs for all 6 slots.
            const imageBlobs = await Promise.all(state.images.map(async (img) => {
                if (img) return await base64ToBlob(img.base64, img.mimeType);
                return null;
            }));

            const client = await getGradioClient("kr-cen/Qwen-Image-MICo", { hfToken });
            
            setProgress('Composing images...');
            
            // Expected prediction signature:
            // img1-6, prompt, neg_prompt, cfg, seed, width, height, steps
            const payload = [
                ...imageBlobs, // 6 images
                state.prompt,
                state.negativePrompt,
                state.cfgScale,
                state.randomizeSeed ? -1 : state.seed, // Using -1 for random usually, or handle seed logic locally
                state.width,
                state.height,
                state.steps
            ];

            // If local randomization is preferred:
            if (state.randomizeSeed) {
                payload[9] = Math.floor(Math.random() * 2147483647); // seed index
            }

            const result = await client.predict("/inference", payload);

            if (result && result.data && result.data.length > 0) {
                let resultUrl = '';
                const output = result.data[0]; // Image is usually first output
                
                if (typeof output === 'string') resultUrl = output;
                else if (output?.url) resultUrl = output.url;
                else if (output?.image?.url) resultUrl = output.image.url;

                if (resultUrl) {
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
                    throw new Error("Could not parse result image.");
                }
            } else {
                throw new Error("API returned no data.");
            }

        } catch (err: any) {
            console.error("MICo Error:", err);
            let errorMessage = "Composition failed.";
            if (err instanceof Error) {
                errorMessage = err.message;
                if (errorMessage.includes("Space metadata")) {
                    errorMessage = "Failed to connect to AI Service. Please check your HF Token.";
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
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">MICo <span className="text-sm font-normal text-neutral-500 bg-neutral-800 px-2 py-1 rounded ml-2">Qwen Multi-Image</span></h2>
                <p className="text-neutral-400">Compose and edit up to 6 reference images into a coherent scene.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
                {/* Controls Column */}
                <div className="lg:col-span-1 flex flex-col gap-6 bg-neutral-800/50 p-6 rounded-xl border border-neutral-700 h-fit">
                    
                    {/* Image Grid */}
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Reference Images (Min 2)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {state.images.map((img, idx) => (
                                <ImageSlot 
                                    key={idx} 
                                    index={idx} 
                                    image={img} 
                                    onUpload={handleImageUpload} 
                                    onRemove={handleImageRemove} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Prompts */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Editing Prompt</label>
                            <textarea
                                value={state.prompt}
                                onChange={(e) => onStateUpdate({ ...state, prompt: e.target.value })}
                                placeholder="Describe the scene. Use 'image 1', 'image 2' to refer to subjects..."
                                className="w-full h-32 bg-neutral-900 border border-neutral-600 rounded p-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={handleReset}
                            className="flex-1 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-bold uppercase rounded-lg transition-colors"
                        >
                            Reset
                        </button>
                    </div>

                    {/* Advanced Settings */}
                    <div className="border-t border-neutral-700 pt-4">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center justify-between w-full text-left text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
                        >
                            <span>Advanced Settings</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-4 space-y-4 bg-neutral-900/50 p-4 rounded-lg animate-fade-in">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Negative Prompt</label>
                                    <textarea
                                        value={state.negativePrompt}
                                        onChange={(e) => onStateUpdate({ ...state, negativePrompt: e.target.value })}
                                        className="w-full h-16 bg-neutral-800 border border-neutral-600 rounded p-2 text-xs"
                                        placeholder="blurry, low quality..."
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">CFG Scale</label>
                                        <input 
                                            type="number" step="0.1"
                                            value={state.cfgScale}
                                            onChange={(e) => onStateUpdate({ ...state, cfgScale: parseFloat(e.target.value) })}
                                            className="w-full bg-neutral-800 border border-neutral-600 rounded p-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Steps</label>
                                        <input 
                                            type="number" step="1"
                                            value={state.steps}
                                            onChange={(e) => onStateUpdate({ ...state, steps: parseInt(e.target.value) })}
                                            className="w-full bg-neutral-800 border border-neutral-600 rounded p-1.5 text-xs text-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Width</label>
                                        <input 
                                            type="number" step="64"
                                            value={state.width}
                                            onChange={(e) => onStateUpdate({ ...state, width: parseInt(e.target.value) })}
                                            className="w-full bg-neutral-800 border border-neutral-600 rounded p-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Height</label>
                                        <input 
                                            type="number" step="64"
                                            value={state.height}
                                            onChange={(e) => onStateUpdate({ ...state, height: parseInt(e.target.value) })}
                                            className="w-full bg-neutral-800 border border-neutral-600 rounded p-1.5 text-xs text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Seed</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            value={state.seed}
                                            onChange={(e) => onStateUpdate({ ...state, seed: parseInt(e.target.value), randomizeSeed: false })}
                                            className="w-full bg-neutral-800 border border-neutral-600 rounded p-1.5 text-xs text-white"
                                            disabled={state.randomizeSeed}
                                        />
                                        <label className="flex items-center gap-1 text-[10px] text-neutral-400 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={state.randomizeSeed} 
                                                onChange={(e) => onStateUpdate({ ...state, randomizeSeed: e.target.checked })}
                                            /> Rnd
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
                    >
                        {isLoading ? (
                            <><LoadingSpinner className="w-5 h-5 text-white" /> {progress || 'Processing...'}</>
                        ) : (
                            <><EditIcon className="w-5 h-5" /> Generate Composition</>
                        )}
                    </button>
                    
                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-xs font-medium">
                            {error}
                        </div>
                    )}
                </div>

                {/* Result Column */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col relative overflow-hidden min-h-[500px]">
                    <div className="p-4 border-b border-neutral-800 bg-neutral-800/90 backdrop-blur-sm flex justify-between items-center">
                        <h3 className="font-bold text-neutral-300">Composite Result</h3>
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
                                alt="Composition Result"
                                className="max-w-full max-h-full object-contain shadow-2xl"
                            />
                        ) : (
                            <div className="text-neutral-600 flex flex-col items-center select-none">
                                <div className="w-20 h-20 border-2 border-dashed border-neutral-700 rounded-full flex items-center justify-center mb-4">
                                    <MagicIcon className="w-10 h-10 opacity-30" />
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
