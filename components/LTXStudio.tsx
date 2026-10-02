
import React, { useState, useRef } from 'react';
import { LTXStudioState } from '../types';
import { LoadingSpinner, ClapperboardIcon, ChevronDownIcon, CameraLensIcon, WarningIcon } from './icons';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';

interface LTXStudioProps {
    hfToken: string;
    videoState: LTXStudioState;
    onStateUpdate: (newState: LTXStudioState) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }, targetProjectId?: string) => void;
    projects: { id: string; name: string }[];
    activeProjectId?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

export const LTXStudio: React.FC<LTXStudioProps> = ({ 
    hfToken,
    videoState, 
    onStateUpdate, 
    onAddToStoryboard, 
    onAddAssetToGrid,
    projects,
    activeProjectId
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const [showAdvanced, setShowAdvanced] = useState(true);
    
    const imageInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
                const base64 = result.split(',')[1];
                onStateUpdate({ ...videoState, image: { base64, mimeType } });
            };
        }
        event.target.value = '';
    };

    const handleGenerate = async () => {
        if (!videoState.image) {
            setError("Please upload an input image.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress('Initializing LTX-2 Distilled...');
        onStateUpdate({ ...videoState, resultUrl: null });

        try {
            const inputImageBlob = await base64ToBlob(videoState.image.base64, videoState.image.mimeType);
            const finalPrompt = videoState.prompt || "make this image come alive, cinematic motion, smooth animation";

            const payload = { 
                input_image: inputImageBlob, 
                prompt: finalPrompt,
                duration: videoState.duration || 3,
                enhance_prompt: videoState.enhancePrompt ?? true,
                seed: videoState.randomizeSeed ? -1 : (videoState.seed || 42),
                randomize_seed: videoState.randomizeSeed,
                height: videoState.height || 512,
                width: videoState.width || 768,
            };

            setProgress('Generating video with LTX-2...');
            const client = await getGradioClient("merkmorassi/ltx-2-distilled", { hfToken });
            const result = await client.predict("/generate_video", payload);

            if (result?.data?.[0]) {
                let videoUrl = result.data[0];
                if (typeof videoUrl === 'object' && videoUrl.url) videoUrl = videoUrl.url;
                
                const usedSeed = result.data[1];

                onStateUpdate({ 
                    ...videoState, 
                    resultUrl: videoUrl,
                    seed: videoState.randomizeSeed ? usedSeed : videoState.seed 
                });
            } else {
                throw new Error("Could not parse video URL from response.");
            }

        } catch (err) {
            console.error("LTX-2 generation error:", err);
            let errorMessage = "An unknown error occurred.";
            if (err instanceof Error) {
                errorMessage = err.message;
                // Provide more specific feedback for common Gradio issues.
                if (errorMessage.includes("Space is sleeping")) {
                    errorMessage = "The AI service is sleeping. Please wait 60 seconds for it to wake up and try again.";
                } else if (errorMessage.includes("Space metadata could not be loaded") || errorMessage.includes("403")) {
                    errorMessage = "Access denied. This may be due to Hugging Face throttling or an invalid token. Please check your account status and API key in Settings.";
                }
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">LTX Studio <span className="text-sm font-normal text-neutral-500 bg-surface px-2 py-1 rounded ml-2">LTX-2 Distilled</span></h2>
                <p className="text-neutral-400">Generate high-quality video and audio from a single start frame.</p>
            </div>
            {!hfToken && (
                <div className="flex items-center gap-2 text-yellow-500 text-sm bg-yellow-900/20 px-3 py-1.5 rounded border border-yellow-500/30">
                    <WarningIcon className="w-4 h-4" />
                    <span>Hugging Face Token missing. Configure in Settings.</span>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-surface p-6 border border-accent rounded-lg space-y-6 h-fit">
                    
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Input Image *</label>
                        <div onClick={() => imageInputRef.current?.click()} className="w-full aspect-video border-2 border-dashed border-accent rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/50 hover:border-neutral-500 transition-all text-neutral-500 hover:text-neutral-300">
                             {videoState.image ? (
                                <img src={`data:${videoState.image.mimeType};base64,${videoState.image.base64}`} alt="Reference" className="w-full h-full object-contain" />
                            ) : (
                                <><span className="text-sm font-medium">Upload Start Frame</span></>
                            )}
                            <input type="file" ref={imageInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Prompt</label>
                        <textarea
                            value={videoState.prompt}
                            onChange={(e) => onStateUpdate({ ...videoState, prompt: e.target.value })}
                            placeholder="Describe the motion..."
                            className="w-full h-24 bg-secondary border border-accent p-3 rounded-lg text-sm"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 mb-1">Duration: {videoState.duration}s</label>
                        <input type="range" min="1" max="10" step="0.5" value={videoState.duration} onChange={(e) => onStateUpdate({ ...videoState, duration: parseFloat(e.target.value) })} className="w-full accent-brand" />
                    </div>

                    <div className="pt-2 border-t border-accent">
                        <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider w-full justify-between">
                            <span>Advanced Settings</span>
                            <ChevronDownIcon className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="space-y-4 animate-fade-in bg-secondary/50 p-3 rounded-lg border border-accent/50">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Width</label>
                                    <input 
                                        type="number" 
                                        value={videoState.width || 768} 
                                        onChange={(e) => onStateUpdate({ ...videoState, width: parseInt(e.target.value) || 768 })}
                                        className="w-full bg-secondary border border-accent p-2 rounded text-xs text-neutral-200" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Height</label>
                                    <input 
                                        type="number" 
                                        value={videoState.height || 512} 
                                        onChange={(e) => onStateUpdate({ ...videoState, height: parseInt(e.target.value) || 512 })}
                                        className="w-full bg-secondary border border-accent p-2 rounded text-xs text-neutral-200" 
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-neutral-300">Enhance Prompt</label>
                                <input 
                                    type="checkbox" 
                                    checked={videoState.enhancePrompt ?? true} 
                                    onChange={(e) => onStateUpdate({ ...videoState, enhancePrompt: e.target.checked })} 
                                    className="accent-brand rounded" 
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-neutral-400 uppercase">Seed</label>
                                    <label className="text-xs text-neutral-400 flex items-center gap-1 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={videoState.randomizeSeed} 
                                            onChange={(e) => onStateUpdate({ ...videoState, randomizeSeed: e.target.checked })} 
                                            className="accent-brand" 
                                        />
                                        Randomize
                                    </label>
                                </div>
                                {!videoState.randomizeSeed && (
                                    <input 
                                        type="number" 
                                        value={videoState.seed} 
                                        onChange={(e) => onStateUpdate({ ...videoState, seed: parseInt(e.target.value) || 0 })} 
                                        className="w-full bg-secondary border border-accent p-2 rounded text-xs text-neutral-200" 
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !videoState.image}
                        className="w-full py-3 bg-brand hover:bg-brand-hover disabled:bg-neutral-800 disabled:text-neutral-600 font-bold rounded-lg text-white text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
                    >
                        {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <ClapperboardIcon className="w-5 h-5" />}
                        {isLoading ? 'Generating Video...' : 'Generate Video'}
                    </button>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-start gap-2">
                            <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* Right Column: Video Output */}
                <div className="lg:col-span-2 bg-surface p-6 border border-accent rounded-lg flex flex-col justify-between min-h-[400px]">
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-accent/50 rounded-lg p-4 bg-secondary/30 relative">
                        {isLoading ? (
                            <div className="flex flex-col items-center gap-3 text-center">
                                <LoadingSpinner className="w-10 h-10 text-brand" />
                                <span className="text-sm font-medium text-neutral-300">{progress || 'Processing with LTX-2...'}</span>
                                <span className="text-xs text-neutral-500">This may take up to a minute depending on GPU load.</span>
                            </div>
                        ) : videoState.resultUrl ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                                <video 
                                    src={videoState.resultUrl} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="max-h-[500px] w-auto rounded-lg shadow-2xl border border-accent" 
                                />
                            </div>
                        ) : (
                            <div className="text-center text-neutral-500 space-y-2">
                                <CameraLensIcon className="w-12 h-12 mx-auto text-neutral-600" />
                                <p className="text-sm">Generated LTX-2 video will appear here.</p>
                            </div>
                        )}
                    </div>

                    {videoState.resultUrl && (
                        <div className="mt-4 pt-4 border-t border-accent flex justify-end">
                            <AssetActions
                                asset={{ type: 'video', url: videoState.resultUrl }}
                                onSaveToGrid={onAddAssetToGrid ? (pid) => onAddAssetToGrid({ type: 'video', url: videoState.resultUrl! }, pid) : undefined}
                                projects={projects}
                                activeProjectId={activeProjectId}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
                                    