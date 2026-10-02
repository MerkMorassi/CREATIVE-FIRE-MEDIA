import React, { useState, useRef } from 'react';
import { GenerativeVideoState } from '../types';
import { LoadingSpinner, ClapperboardIcon, WarningIcon } from './icons';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';

interface GenerativeVideoStudioProps {
    hfToken: string;
    videoState: GenerativeVideoState;
    onStateUpdate: (newState: GenerativeVideoState) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }, targetProjectId?: string) => void;
    projects: { id: string; name: string }[];
    activeProjectId?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

export const GenerativeVideoStudio: React.FC<GenerativeVideoStudioProps> = ({ 
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
        setProgress('Connecting to SVD...');
        onStateUpdate({ ...videoState, resultUrl: null });

        try {
            const inputImageBlob = await base64ToBlob(videoState.image.base64, videoState.image.mimeType);
            
            const payload = { 
                image: inputImageBlob,
                motion_bucket_id: videoState.motionBucketId,
                noise_aug_strength: 0.02, // Default value from SVD spaces
                steps: videoState.steps,
                cfg_scale: videoState.cfgScale,
                seed: videoState.randomizeSeed ? Math.floor(Math.random() * 2147483647) : videoState.seed,
            };

            setProgress('Generating video with Stable Video Diffusion...');
            const client = await getGradioClient("stabilityai/stable-video-diffusion-img2vid-xt", { hfToken });
            const result = await client.predict("/video_generation", payload);

            if (result?.data?.[0]?.video?.url) {
                let videoUrl = result.data[0].video.url;
                onStateUpdate({ ...videoState, resultUrl: videoUrl });
            } else {
                throw new Error("Could not parse video URL from SVD response.");
            }

        } catch (err) {
            console.error("SVD generation error:", err);
            setError(err instanceof Error ? err.message : "Unknown error occurred.");
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header */}
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Video Creator <span className="text-sm font-normal text-neutral-500 bg-surface px-2 py-1 rounded ml-2">Stable Video Diffusion</span></h2>
                <p className="text-neutral-400">Animate a single image using the standard SVD model.</p>
            </div>
            {!hfToken && (
                <div className="flex items-center gap-2 text-yellow-500 text-sm bg-yellow-900/20 px-3 py-1.5 rounded border border-yellow-500/30">
                    <WarningIcon className="w-4 h-4" />
                    <span>Hugging Face Token missing. Configure in Settings.</span>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
                {/* Controls Column */}
                <div className="bg-surface p-6 border border-accent rounded-lg space-y-6 h-fit">
                    <div 
                        onClick={() => imageInputRef.current?.click()}
                        className="w-full aspect-video border-2 border-dashed border-accent rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary/50 hover:border-neutral-500 transition-all text-neutral-500 hover:text-neutral-300"
                    >
                        {videoState.image ? (
                           <img src={`data:${videoState.image.mimeType};base64,${videoState.image.base64}`} alt="Reference" className="w-full h-full object-contain" />
                        ) : (
                            <><span className="text-sm font-medium">Upload Start Frame</span></>
                        )}
                         <input type="file" ref={imageInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-400">Motion ({videoState.motionBucketId})</label>
                            <input type="range" min="1" max="255" value={videoState.motionBucketId} onChange={(e) => onStateUpdate({ ...videoState, motionBucketId: parseInt(e.target.value)})} className="w-full accent-brand" />
                        </div>
                         <div className="space-y-1">
                            <label className="text-xs text-neutral-400">CFG Scale ({videoState.cfgScale})</label>
                            <input type="range" min="0" max="10" step="0.1" value={videoState.cfgScale} onChange={(e) => onStateUpdate({ ...videoState, cfgScale: parseFloat(e.target.value)})} className="w-full accent-brand" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-neutral-400">Steps ({videoState.steps})</label>
                            <input type="range" min="10" max="50" step="1" value={videoState.steps} onChange={(e) => onStateUpdate({ ...videoState, steps: parseInt(e.target.value)})} className="w-full accent-brand" />
                        </div>
                    </div>
                    
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !videoState.image}
                        className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? ( <><LoadingSpinner className="w-5 h-5"/> {progress || 'Generating...'}</> ) : ( <><ClapperboardIcon /> Generate Video</> )}
                    </button>
                    {error && <p className="text-sm text-red-400 p-3 rounded border border-red-500/30">{error}</p>}
                </div>

                {/* Preview Column */}
                <div className="bg-secondary/30 border border-accent rounded-lg flex flex-col relative overflow-hidden min-h-[500px]">
                    <div className="flex-grow flex items-center justify-center bg-primary relative">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <LoadingSpinner />
                                <p className="mt-4 text-neutral-400 animate-pulse font-mono text-sm">{progress}</p>
                            </div>
                        ) : videoState.resultUrl ? (
                            <video src={videoState.resultUrl} controls autoPlay loop className="w-full h-full max-h-[70vh] object-contain" crossOrigin="anonymous" />
                        ) : (
                            <div className="text-neutral-600 flex flex-col items-center select-none">
                                <ClapperboardIcon />
                                <p className="mt-2 text-sm font-medium">Video Preview</p>
                            </div>
                        )}
                    </div>
                    {videoState.resultUrl && !isLoading && (
                        <div className="p-4 border-t border-accent bg-secondary/90 backdrop-blur-sm flex justify-center">
                            <AssetActions 
                                asset={{ type: 'video', url: videoState.resultUrl }}
                                onSaveToGrid={onAddAssetToGrid ? (pid) => onAddAssetToGrid!({ type: 'video', url: videoState.resultUrl! }, pid) : undefined}
                                onSaveToStoryboard={() => {}}
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