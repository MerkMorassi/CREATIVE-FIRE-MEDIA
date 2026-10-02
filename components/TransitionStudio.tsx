
import React, { useState, useRef } from 'react';
import { TransitionState, PromptTemplate } from '../types.ts';
import { LoadingSpinner, TransitionIcon, ClapperboardIcon, ChevronDownIcon, LibraryIcon } from './icons.tsx';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';

interface TransitionStudioProps {
    state: TransitionState;
    onStateUpdate: (newState: TransitionState) => void;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }, targetProjectId?: string) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string;
    projects: { id: string; name: string }[];
    activeProjectId?: string;
    promptTemplates?: PromptTemplate[];
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const ASPECT_RATIOS = [
    { label: '2.39:1 (Cinematic)', w: 1920, h: 804 },
    { label: '16:9 (Landscape)', w: 1280, h: 720 },
    { label: '9:16 (Portrait)', w: 720, h: 1280 },
    { label: '1:1 (Square)', w: 1024, h: 1024 },
    { label: '3:2 (Classic)', w: 1216, h: 816 },
    { label: 'Custom', w: 0, h: 0 } // handled manually
];

const ImageUpload: React.FC<{
    title: string;
    image: { base64: string; mimeType: string } | null;
    onUpload: (file: File) => void;
    onRemove: () => void;
}> = ({ title, image, onUpload, onRemove }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) onUpload(e.target.files[0]);
        e.target.value = '';
    };

    return (
        <div 
            onClick={() => inputRef.current?.click()}
            className="w-full h-full bg-neutral-900 border-2 border-dashed border-neutral-700 rounded-xl flex items-center justify-center cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-500 transition-all relative overflow-hidden group min-h-[250px]"
        >
            {image ? (
                <>
                    <img src={`data:${image.mimeType};base64,${image.base64}`} className="w-full h-full object-cover" />
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </>
            ) : (
                <div className="text-center text-neutral-500 group-hover:text-blue-400">
                    <span className="text-2xl font-light">+</span>
                    <p className="text-xs font-bold uppercase tracking-wider mt-1">{title}</p>
                </div>
            )}
            <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleChange} />
        </div>
    );
};

export const TransitionStudio: React.FC<TransitionStudioProps> = ({ 
    state, 
    onStateUpdate, 
    onAddAssetToGrid, 
    onAddToStoryboard, 
    onAddToInspiration,
    hfToken,
    projects,
    activeProjectId,
    promptTemplates = []
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleUpload = (type: 'start' | 'end', file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
            const base64 = result.split(',')[1];
            if (type === 'start') {
                onStateUpdate({ ...state, startImage: { base64, mimeType } });
            } else {
                onStateUpdate({ ...state, endImage: { base64, mimeType } });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleResolutionPreset = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            onStateUpdate({ ...state, width, height });
        }
    };

    const applyTemplate = (templateId: string) => {
        const template = promptTemplates.find(t => t.id === templateId);
        if (template) {
            onStateUpdate({
                ...state,
                prompt: template.positivePrompt ? `${template.positivePrompt}, ${state.prompt}` : state.prompt,
                negativePrompt: template.negativePrompt ? `${template.negativePrompt}, ${state.negativePrompt}` : state.negativePrompt
            });
        }
    };

    const handleGenerate = async () => {
        if (!state.startImage || !state.endImage) {
            setError("Both Start and End frames are required.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress('Connecting to LTX-2 Neural Engine...');
        onStateUpdate({ ...state, resultUrl: null });

        try {
            const startBlob = await base64ToBlob(state.startImage.base64, state.startImage.mimeType);
            const endBlob = await base64ToBlob(state.endImage.base64, state.endImage.mimeType);

            // Connect to LTX-2 Space
            const client = await getGradioClient("linoyts/ltx-2-first-last-frame", { hfToken });
            
            setProgress('Interpolating frames (Standard Mode)...');
            
            // Named parameters for LTX-2 First-Last Frame API
            const result = await client.predict("/generate_video", { 
                start_frame: startBlob,
                prompt: state.prompt || "Smooth cinematic transition between keyframes with natural motion and consistent lighting",
                end_frame_upload: endBlob,
                end_frame_generated: null, // We prefer uploaded end frame
                strength_start: state.strengthStart ?? 1.0,
                strength_end: state.strengthEnd ?? 0.9,
                duration: state.duration ?? 5,
                enhance_prompt: state.enhancePrompt ?? true,
                negative_prompt: state.negativePrompt,
                seed: state.randomizeSeed ? -1 : (state.seed || 42),
                randomize_seed: state.randomizeSeed,
                num_inference_steps: state.steps ?? 20,
                cfg_guidance_scale: state.guidanceScale ?? 3,
                height: state.height ?? 512,
                width: state.width ?? 768,
            });

            if (result?.data?.[0]) {
                let videoUrl = result.data[0];
                if (typeof videoUrl === 'object' && videoUrl.url) videoUrl = videoUrl.url;
                
                // data[1] is prompt used, data[2] is seed used
                const usedSeed = result.data[2];

                onStateUpdate({ 
                    ...state, 
                    resultUrl: videoUrl,
                    seed: state.randomizeSeed ? usedSeed : state.seed 
                });
            } else {
                throw new Error("Could not parse video output from the model.");
            }
        } catch (err) {
            console.error("Transition generation error:", err);
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
            <div className="flex-shrink-0 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">Transition Studio <span className="text-sm font-normal text-blue-400 bg-blue-900/20 px-2 py-1 rounded ml-2 border border-blue-500/30">LTX-2</span></h2>
                    <p className="text-neutral-400">Generate a video that smoothly transitions between a start and end frame using keyframe interpolation.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1 text-xs">
                        <span className="text-neutral-500 uppercase font-bold tracking-wider mr-2">Target Res</span>
                        <span className="text-white font-mono">{state.width}x{state.height}</span>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
                <ImageUpload title="Start Frame" image={state.startImage} onUpload={(f) => handleUpload('start', f)} onRemove={() => onStateUpdate({...state, startImage: null})} />
                
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-6 flex flex-col gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Transition Prompt</label>
                            <div className="relative group">
                                <select 
                                    onChange={(e) => applyTemplate(e.target.value)} 
                                    defaultValue="" 
                                    className="appearance-none bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[10px] text-blue-400 font-bold outline-none cursor-pointer hover:border-blue-500 pr-6"
                                >
                                    <option value="" disabled>Apply Style...</option>
                                    {promptTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <LibraryIcon className="w-3 h-3 text-blue-400 absolute right-2 top-1.5 pointer-events-none" />
                            </div>
                        </div>
                        <textarea 
                            value={state.prompt}
                            onChange={(e) => onStateUpdate({ ...state, prompt: e.target.value })}
                            placeholder="Describe the transition (e.g. Smooth cinematic zoom...)"
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
                            <div className="mt-4 space-y-4 bg-neutral-900/50 p-3 rounded-lg border border-neutral-700/50">
                                
                                {/* Resolution Presets */}
                                <div>
                                    <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider mb-2 block">Aspect Ratio</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {ASPECT_RATIOS.map((preset) => (
                                            <button
                                                key={preset.label}
                                                onClick={() => handleResolutionPreset(preset.w, preset.h)}
                                                className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-colors ${
                                                    state.width === preset.w && state.height === preset.h
                                                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                                                        : 'bg-neutral-800 border-neutral-600 text-neutral-400 hover:text-white hover:border-neutral-500'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <textarea 
                                    value={state.negativePrompt}
                                    onChange={(e) => onStateUpdate({ ...state, negativePrompt: e.target.value })}
                                    placeholder="Negative prompt..."
                                    className="w-full h-16 bg-neutral-800 border border-neutral-600 rounded p-2 text-xs"
                                />
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-neutral-500">Duration ({state.duration}s)</label>
                                        <input type="range" min="1" max="10" step="0.5" value={state.duration} onChange={e => onStateUpdate({...state, duration: parseFloat(e.target.value)})} className="w-full accent-blue-500" />
                                    </div>
                                     <div>
                                        <label className="text-[10px] text-neutral-500">Steps ({state.steps})</label>
                                        <input type="range" min="10" max="50" step="1" value={state.steps} onChange={e => onStateUpdate({...state, steps: parseInt(e.target.value)})} className="w-full accent-blue-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-neutral-500">Start Strength: {state.strengthStart}</label>
                                        <input type="range" min="0" max="1" step="0.05" value={state.strengthStart ?? 1} onChange={e => onStateUpdate({...state, strengthStart: parseFloat(e.target.value)})} className="w-full accent-green-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-neutral-500">End Strength: {state.strengthEnd}</label>
                                        <input type="range" min="0" max="1" step="0.05" value={state.strengthEnd ?? 0.9} onChange={e => onStateUpdate({...state, strengthEnd: parseFloat(e.target.value)})} className="w-full accent-green-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-neutral-500">Width</label>
                                        <input type="number" value={state.width} onChange={e => onStateUpdate({...state, width: parseInt(e.target.value)})} className="w-full bg-neutral-800 border border-neutral-600 rounded p-1 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-neutral-500">Height</label>
                                        <input type="number" value={state.height} onChange={e => onStateUpdate({...state, height: parseInt(e.target.value)})} className="w-full bg-neutral-800 border border-neutral-600 rounded p-1 text-xs" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={state.enhancePrompt ?? true} onChange={e => onStateUpdate({...state, enhancePrompt: e.target.checked})} id="enhance" className="accent-blue-500" />
                                    <label htmlFor="enhance" className="text-xs text-neutral-400">Enhance Prompt (AI)</label>
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
                        disabled={isLoading || !state.startImage || !state.endImage}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
                    >
                        {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <TransitionIcon className="w-5 h-5" />}
                        {isLoading ? (progress || 'Generating...') : 'Generate Transition'}
                    </button>
                    {error && <p className="text-xs text-red-400 text-center bg-red-900/20 p-2 rounded">{error}</p>}
                </div>
                
                <ImageUpload title="End Frame" image={state.endImage} onUpload={(f) => handleUpload('end', f)} onRemove={() => onStateUpdate({...state, endImage: null})} />
            </div>

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
                            <ClapperboardIcon className="w-16 h-16 mx-auto mb-2" />
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
                            projects={projects}
                            activeProjectId={activeProjectId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
