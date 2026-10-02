
import React, { useState, useRef } from 'react';
import { CompositeState } from '../types.ts';
import { LoadingSpinner, PuzzleIcon, ClapperboardIcon, ChevronDownIcon, ImageIcon, LayersIcon, DownloadIcon, AddToStoryIcon, PinIcon, GridIcon } from './icons.tsx';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';

interface CompositeStudioProps {
    state: CompositeState;
    onStateUpdate: (newState: CompositeState) => void;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string;
}

const TASKS = [
    { value: 'ip', label: 'Image Prompt' },
    { value: 'style', label: 'Style Transfer' },
    { value: 'id', label: 'Identity (Face)' },
    { value: 'structure', label: 'Structure' },
];

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

export const CompositeStudio: React.FC<CompositeStudioProps> = ({ 
    state, 
    onStateUpdate, 
    onAddAssetToGrid,
    onAddToStoryboard,
    onAddToInspiration,
    hfToken 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    
    const fileInputRef1 = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);

    const handleUpload = (index: 1 | 2, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
            const base64 = result.split(',')[1];
            if (index === 1) {
                onStateUpdate({ ...state, refImage1: { base64, mimeType } });
            } else {
                onStateUpdate({ ...state, refImage2: { base64, mimeType } });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerateImage = async () => {
        if (!state.refImage1 || !state.refImage2) {
            setError("Both reference images are required.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress("Initializing DreamO...");
        
        try {
            const ref1Blob = await base64ToBlob(state.refImage1.base64, state.refImage1.mimeType);
            const ref2Blob = await base64ToBlob(state.refImage2.base64, state.refImage2.mimeType);
            
            const client = await getGradioClient("openfree/DreamO-video", { hfToken });
            
            setProgress("Generating composite image...");
            
            const result = await client.predict("/generate_image", { 
                ref_image1: ref1Blob, 
                ref_image2: ref2Blob, 		
                ref_task1: state.task1, 		
                ref_task2: state.task2, 		
                prompt: state.prompt, 		
                seed: state.randomizeSeed ? -1 : state.seed, 		
                width: state.width, 		
                height: state.height, 		
                ref_res: 512, 		
                num_steps: 12, 		
                guidance: 3.5, 		
                true_cfg: 1, 		
                cfg_start_step: 0, 		
                cfg_end_step: 0, 		
                neg_prompt: state.negativePrompt, 		
                neg_guidance: 3.5, 		
                first_step_guidance: 0, 
            });

            if (result && result.data) {
                const outputImage = result.data[0];
                let imageUrl = '';
                
                if (typeof outputImage === 'string') {
                    imageUrl = outputImage;
                } else if (outputImage?.url) {
                    imageUrl = outputImage.url;
                }

                if (imageUrl) {
                    const res = await fetch(imageUrl);
                    const blob = await res.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        onStateUpdate({ 
                            ...state, 
                            resultImage: { base64, mimeType: blob.type },
                            resultVideoUrl: null
                        });
                        setIsLoading(false);
                    };
                    reader.readAsDataURL(blob);
                } else {
                    throw new Error("Could not parse output image.");
                }
            } else {
                throw new Error("API returned no data.");
            }

        } catch (err) {
            console.error("DreamO Image Error:", err);
            setError(err instanceof Error ? err.message : "Image generation failed.");
            setIsLoading(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!state.resultImage) return;
        
        setIsVideoLoading(true);
        setError(null);
        setProgress("Generating video motion...");
        
        try {
            const imgBlob = await base64ToBlob(state.resultImage.base64, state.resultImage.mimeType);
            const client = await getGradioClient("openfree/DreamO-video", { hfToken });
            
            const result = await client.predict("/on_click_generate_video", { 
                img: imgBlob, 
            });

            if (result && result.data && result.data.length > 0) {
                const output = result.data[0];
                let videoUrl = '';
                if (typeof output === 'string') videoUrl = output;
                else if (output?.url) videoUrl = output.url;
                else if (output?.video?.url) videoUrl = output.video.url;

                if (videoUrl) {
                    onStateUpdate({ ...state, resultVideoUrl: videoUrl });
                } else {
                    throw new Error("Could not parse output video.");
                }
            }
        } catch (err) {
            console.error("DreamO Video Error:", err);
            setError(err instanceof Error ? err.message : "Video generation failed.");
        } finally {
            setIsVideoLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Composite Studio <span className="text-sm font-normal text-neutral-500 bg-neutral-800 px-2 py-1 rounded ml-2">DreamO</span></h2>
                <p className="text-neutral-400">Fuse concepts, styles, and identities from multiple reference images into a cohesive new visual.</p>
            </div>

            {/* Main Workspace - 3 Equal Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow min-h-0 items-start">
                
                {/* Reference 1 Box */}
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl flex flex-col shadow-lg overflow-hidden h-full">
                    <div className="h-14 px-4 border-b border-neutral-700 bg-neutral-900/30 flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-bold text-blue-300 uppercase tracking-wider">Reference 1</h3>
                        <select 
                            value={state.task1} 
                            onChange={(e) => onStateUpdate({ ...state, task1: e.target.value as any })}
                            className="bg-neutral-900 border border-neutral-600 text-[10px] uppercase font-bold rounded p-1 text-white focus:ring-1 focus:ring-blue-500 outline-none max-w-[120px]"
                        >
                            {TASKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="p-4 flex flex-col justify-start bg-neutral-900/20 flex-grow">
                        <div 
                            onClick={() => fileInputRef1.current?.click()}
                            className="w-full aspect-square bg-neutral-900 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-800 transition-all relative overflow-hidden group"
                        >
                            {state.refImage1 ? (
                                <img src={`data:${state.refImage1.mimeType};base64,${state.refImage1.base64}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center text-neutral-500 group-hover:text-blue-400 transition-colors">
                                    <div className="w-12 h-12 border-2 border-current rounded-full flex items-center justify-center mx-auto mb-2 text-2xl font-light">+</div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Upload Source</p>
                                </div>
                            )}
                            <input ref={fileInputRef1} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(1, e.target.files[0])} />
                        </div>
                    </div>
                    <div className="h-16 px-4 border-t border-neutral-700 bg-neutral-900/30 flex items-center justify-center shrink-0">
                        <p className="text-[10px] text-neutral-500 text-center">Drag & Drop or Click to Upload</p>
                    </div>
                </div>

                {/* Reference 2 Box */}
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl flex flex-col shadow-lg overflow-hidden h-full">
                    <div className="h-14 px-4 border-b border-neutral-700 bg-neutral-900/30 flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-bold text-purple-300 uppercase tracking-wider">Reference 2</h3>
                        <select 
                            value={state.task2} 
                            onChange={(e) => onStateUpdate({ ...state, task2: e.target.value as any })}
                            className="bg-neutral-900 border border-neutral-600 text-[10px] uppercase font-bold rounded p-1 text-white focus:ring-1 focus:ring-purple-500 outline-none max-w-[120px]"
                        >
                            {TASKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="p-4 flex flex-col justify-start bg-neutral-900/20 flex-grow">
                        <div 
                            onClick={() => fileInputRef2.current?.click()}
                            className="w-full aspect-square bg-neutral-900 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-800 transition-all relative overflow-hidden group"
                        >
                            {state.refImage2 ? (
                                <img src={`data:${state.refImage2.mimeType};base64,${state.refImage2.base64}`} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center text-neutral-500 group-hover:text-purple-400 transition-colors">
                                    <div className="w-12 h-12 border-2 border-current rounded-full flex items-center justify-center mx-auto mb-2 text-2xl font-light">+</div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Upload Source</p>
                                </div>
                            )}
                            <input ref={fileInputRef2} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(2, e.target.files[0])} />
                        </div>
                    </div>
                    <div className="h-16 px-4 border-t border-neutral-700 bg-neutral-900/30 flex justify-between items-center shrink-0">
                       <p className="text-[10px] text-neutral-500">Inputs Ready</p>
                       <div className={`w-2 h-2 rounded-full ${state.refImage1 && state.refImage2 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                </div>

                {/* Result Box */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col shadow-xl overflow-hidden relative h-full">
                    <div className="h-14 px-4 border-b border-neutral-800 bg-black/40 flex justify-between items-center shrink-0">
                        <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider">Composite Result</h3>
                        {isLoading && <LoadingSpinner className="w-4 h-4 text-green-500" />}
                    </div>
                    
                    <div className="p-4 flex flex-col justify-start bg-black/20 flex-grow">
                        <div className="w-full aspect-square bg-black rounded-lg flex items-center justify-center relative overflow-hidden border border-neutral-800 group">
                            {state.resultImage ? (
                                <img src={`data:${state.resultImage.mimeType};base64,${state.resultImage.base64}`} className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-neutral-700 flex flex-col items-center">
                                    <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-40">Preview</span>
                                </div>
                            )}
                            
                            {/* Hover Overlay for Quick Actions */}
                            {state.resultImage && !isLoading && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                    <button 
                                        onClick={() => onAddAssetToGrid({ type: 'image', base64: state.resultImage!.base64, mimeType: state.resultImage!.mimeType })} 
                                        className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 text-white shadow-lg" title="Save to Grid"
                                    >
                                        <GridIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-4 border-t border-neutral-800 bg-neutral-900 space-y-3 shrink-0">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={state.prompt} 
                                onChange={(e) => onStateUpdate({ ...state, prompt: e.target.value })}
                                placeholder="Optional prompt override..."
                                className="flex-grow bg-black border border-neutral-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                            />
                            <button
                                onClick={handleGenerateImage}
                                disabled={isLoading || !state.refImage1 || !state.refImage2}
                                className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded text-xs uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Busy' : 'Fuse'}
                            </button>
                        </div>
                        
                        {/* Explicit Save Buttons Row */}
                        {state.resultImage && (
                            <div className="flex justify-between items-center pt-2 border-t border-neutral-800">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Save To:</span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onAddAssetToGrid({ type: 'image', base64: state.resultImage!.base64, mimeType: state.resultImage!.mimeType })}
                                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-300 hover:text-white transition-colors"
                                        title="Project Gallery"
                                    >
                                        <GridIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => onAddToStoryboard(state.resultImage!.base64)}
                                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-300 hover:text-white transition-colors"
                                        title="Storyboard"
                                    >
                                        <AddToStoryIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => onAddToInspiration(state.resultImage!.base64)}
                                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-300 hover:text-white transition-colors"
                                        title="Inspiration"
                                    >
                                        <PinIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-[10px] text-red-400 truncate">{error}</p>}
                        {progress && <p className="text-[10px] text-green-400 animate-pulse">{progress}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
