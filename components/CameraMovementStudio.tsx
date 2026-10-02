
import React, { useState, useRef, useEffect } from 'react';
import { CameraMovementState } from '../types.ts';
import { LoadingSpinner, DollyIcon, ClapperboardIcon, ChevronDownIcon, CameraLensIcon, ImageIcon } from './icons.tsx';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';
import { getCameraDollyUrl } from '../services/apiKeyService';

interface CameraMovementStudioProps {
    state: CameraMovementState;
    onStateUpdate: (newState: CameraMovementState) => void;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }, targetProjectId?: string) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const MOVEMENT_PRESETS = [
    { label: "Jib Down (Reveal)", value: "Jib-down camera move, smooth vertical descent, cinematic reveal." },
    { label: "Jib Up (Ascent)", value: "Jib-up camera move, smooth vertical ascent, cinematic reveal." },
    { label: "Dolly Left (Slide)", value: "Dolly-left camera move, sliding left in an open space, revealing a stationary car, off-frame left elements enter the shot, cinematic parallax" },
    { label: "Dolly Right (Slide)", value: "Dolly-right camera move in an open space, sliding right, cinematic parallax." },
    { label: "Dolly In (Zoom)", value: "Slow dolly-in toward a face, gentle zoom-in, cinematic parallax." },
    { label: "Static (Locked)", value: "Static camera, locked-off shot, no camera movement." }
];

export const CameraMovementStudio: React.FC<CameraMovementStudioProps> = ({ 
    state, 
    onStateUpdate, 
    onAddAssetToGrid, 
    onAddToStoryboard, 
    onAddToInspiration,
    hfToken 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Initial default state setup if needed
    useEffect(() => {
        if (!state.movementType) {
            onStateUpdate({
                ...state,
                movementType: MOVEMENT_PRESETS[4].value, // Default to Dolly In
                prompt: MOVEMENT_PRESETS[4].value,
                guidanceScale: 3,
                steps: 50
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
                const base64 = result.split(',')[1];
                onStateUpdate({ ...state, source: { base64, mimeType }, resultUrl: null });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value;
        onStateUpdate({
            ...state,
            movementType: selectedValue,
            prompt: selectedValue // Auto-fill prompt with preset
        });
    };

    const handleGenerate = async () => {
        if (!state.source) {
            setError("Please upload a start frame.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress('Initializing LTX-2 Camera Control...');
        onStateUpdate({ ...state, resultUrl: null });

        try {
            const imgBlob = await base64ToBlob(state.source.base64, state.source.mimeType);
            
            const cameraDollyEndpoint = getCameraDollyUrl();
            if (!cameraDollyEndpoint) {
                throw new Error("Camera Dolly (LTX) URL is not configured in System Settings.");
            }
            const client = await getGradioClient(cameraDollyEndpoint, { hfToken });
            
            setProgress('Generating camera move...');
            
            // Expected prediction signature based on typical I2V spaces:
            // [image, prompt, negative_prompt, seed, randomize_seed, guidance_scale, num_inference_steps]
            
            const result = await client.predict("/predict", [
                imgBlob,                // input_image
                state.prompt,           // prompt
                state.negativePrompt || "blurry, low quality, distortion, morphing",   // negative_prompt
                state.randomizeSeed ? Math.floor(Math.random() * 1000000) : state.seed, // seed
                state.randomizeSeed,    // randomize_seed (boolean)
                state.guidanceScale,    // guidance_scale
                state.steps,            // num_inference_steps
            ]);

            if (result?.data?.[0]?.url) {
                // Some spaces return [video_path, seed]
                onStateUpdate({ 
                    ...state, 
                    resultUrl: result.data[0].url
                });
            } else if (result?.data?.[0]?.video?.url) {
                 onStateUpdate({ 
                    ...state, 
                    resultUrl: result.data[0].video.url
                });
            } else {
                throw new Error("Could not parse video URL from the model's response.");
            }
        } catch (err) {
            console.error("Camera movement generation error:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };
    
    const extractThumbnail = (callback: (base64: string) => void) => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            callback(canvas.toDataURL('image/jpeg').split(',')[1]);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Camera Dolly Studio <span className="text-sm font-normal text-blue-400 bg-blue-900/20 px-2 py-1 rounded ml-2 border border-blue-500/30">LTX-2</span></h2>
                <p className="text-neutral-400">Apply professional camera movements to static images using the LTX-2 Distilled LoRA.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
                {/* Input Column */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full min-h-[300px] bg-neutral-900 border-2 border-dashed border-neutral-700 rounded-xl flex items-center justify-center cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-500 transition-all relative overflow-hidden group"
                >
                    {state.source ? (
                        <>
                            <img src={`data:${state.source.mimeType};base64,${state.source.base64}`} className="w-full h-full object-contain" />
                            <button 
                                onClick={(e) => { e.stopPropagation(); onStateUpdate({...state, source: null}); }}
                                className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </>
                    ) : (
                        <div className="text-center text-neutral-500 group-hover:text-blue-400">
                            <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-xs font-bold uppercase tracking-wider">Upload Start Frame</p>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                </div>
                
                {/* Controls Column */}
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6 flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Director's Call (Movement)</label>
                        <select 
                            value={state.movementType}
                            onChange={handlePresetChange}
                            className="w-full bg-neutral-900 border border-neutral-600 p-3 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                        >
                            {MOVEMENT_PRESETS.map((p, i) => (
                                <option key={i} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Refine Prompt</label>
                        <textarea 
                            value={state.prompt}
                            onChange={(e) => onStateUpdate({ ...state, prompt: e.target.value })}
                            placeholder="Prompt..."
                            className="w-full h-24 bg-neutral-900 border border-neutral-600 rounded p-3 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                        />
                    </div>
                    
                    {/* Advanced Settings */}
                    <div className="border-t border-neutral-700 pt-4">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center justify-between w-full text-left text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider"
                        >
                            <span>Advanced Settings</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-4 space-y-3 bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/50">
                                <textarea 
                                    value={state.negativePrompt}
                                    onChange={(e) => onStateUpdate({ ...state, negativePrompt: e.target.value })}
                                    placeholder="Negative prompt..."
                                    className="w-full h-16 bg-neutral-800 border border-neutral-600 rounded p-2 text-xs"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                     <div>
                                        <label className="text-[10px] text-neutral-500">Steps ({state.steps})</label>
                                        <input type="range" min="20" max="60" step="1" value={state.steps} onChange={e => onStateUpdate({...state, steps: parseInt(e.target.value)})} className="w-full accent-blue-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-neutral-500">Guidance ({state.guidanceScale})</label>
                                        <input type="range" min="1" max="10" step="0.5" value={state.guidanceScale} onChange={e => onStateUpdate({...state, guidanceScale: parseFloat(e.target.value)})} className="w-full accent-blue-500" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-neutral-500">Seed</label>
                                    <div className="flex gap-2">
                                        <input type="number" value={state.seed} onChange={e => onStateUpdate({...state, seed: parseInt(e.target.value), randomizeSeed: false})} className="w-full bg-neutral-800 border border-neutral-600 rounded p-1 text-xs" disabled={state.randomizeSeed}/>
                                        <label className="flex items-center gap-1 text-[10px] text-neutral-400"><input type="checkbox" checked={state.randomizeSeed} onChange={e => onStateUpdate({...state, randomizeSeed: e.target.checked})}/> Random</label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !state.source}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
                    >
                        {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <DollyIcon className="w-5 h-5" />}
                        {isLoading ? (progress || 'Action...') : 'Generate Shot'}
                    </button>
                    {error && <p className="text-xs text-red-400 text-center bg-red-900/20 p-2 rounded">{error}</p>}
                </div>
                
                {/* Result Column */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col relative overflow-hidden min-h-[400px]">
                    <div className="p-4 border-b border-neutral-800 bg-neutral-800/50 flex justify-between items-center">
                        <h3 className="font-bold text-neutral-300">Result Video</h3>
                    </div>
                    <div className="flex-grow flex items-center justify-center bg-black p-4">
                        {isLoading ? (
                            <div className="text-center text-neutral-400">
                                <LoadingSpinner className="w-12 h-12 mx-auto mb-4" />
                                <p>{progress}</p>
                            </div>
                        ) : state.resultUrl ? (
                            <video ref={videoRef} src={state.resultUrl} controls autoPlay loop className="max-w-full max-h-full" crossOrigin="anonymous" />
                        ) : (
                            <div className="text-neutral-600 text-center">
                                <ClapperboardIcon className="w-16 h-16 mx-auto mb-2 opacity-20" />
                                <p>Result will appear here</p>
                            </div>
                        )}
                    </div>
                     {state.resultUrl && !isLoading && (
                        <div className="p-4 border-t border-neutral-800 bg-neutral-800/50 flex justify-center">
                            <AssetActions 
                                asset={{ type: 'video', url: state.resultUrl }}
                                onSaveToGrid={(pid) => onAddAssetToGrid({ type: 'video', url: state.resultUrl! }, pid)}
                                onSaveToStoryboard={() => extractThumbnail(onAddToStoryboard)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};