import React, { useState, useRef } from 'react';
import { ResizeState } from '../types.ts';
import { LoadingSpinner, ExpandIcon, ImageIcon } from './icons.tsx';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';

interface ResizeStudioProps {
    state: ResizeState;
    onStateUpdate: (newState: ResizeState) => void;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const COMMON_RATIOS = [
    { label: '9:16 (Story)', w: 720, h: 1280 },
    { label: '16:9 (Cinema)', w: 1280, h: 720 },
    { label: '4:5 (Portrait)', w: 800, h: 1000 },
    { label: '1:1 (Square)', w: 1024, h: 1024 },
];

export const ResizeStudio: React.FC<ResizeStudioProps> = ({ 
    state, 
    onStateUpdate, 
    onAddAssetToGrid,
    onAddToStoryboard,
    onAddToInspiration,
    hfToken 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
            const base64 = result.split(',')[1];
            onStateUpdate({ ...state, source: { base64, mimeType }, result: null });
        };
        reader.readAsDataURL(file);
    };

    const handleApplyPreset = (w: number, h: number) => {
        onStateUpdate({ ...state, width: w, height: h });
    };

    const handleDirectionChange = (dir: keyof typeof state.directions) => {
        onStateUpdate({ 
            ...state, 
            directions: { ...state.directions, [dir]: !state.directions[dir] } 
        });
    };

    const handleGenerate = async () => {
        if (!state.source) {
            setError("Please upload a source image.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress("Initializing Resizer...");
        
        try {
            const imgBlob = await base64ToBlob(state.source.base64, state.source.mimeType);
            // FIX: Update Gradio client to point to the new merkmorassi/mythos-image-outpaint space.
            const client = await getGradioClient("merkmorassi/mythos-image-outpaint", { hfToken });
            
            setProgress("Outpainting image...");
            
            // FIX: Update the payload to a named object format as specified in the new API documentation for the /infer endpoint.
            const payload = {
                image: imgBlob,
                width: state.width,
                height: state.height,
                overlap_percentage: state.overlap,
                num_inference_steps: state.steps,
                resize_option: "Full",
                custom_resize_percentage: 100, // Hardcoded as per the new API's default behavior for "Full" resize.
                prompt_input: state.prompt,
                alignment: state.alignment,
                overlap_left: state.directions.left,
                overlap_right: state.directions.right,
                overlap_top: state.directions.top,
                overlap_bottom: state.directions.bottom,
            };
            
            const result = await client.predict("/infer", payload);

            if (result && result.data && result.data.length > 0) {
                const output = result.data[0];
                let imageUrl = '';
                
                if (typeof output === 'string') imageUrl = output;
                else if (output?.url) imageUrl = output.url;

                if (imageUrl) {
                    const res = await fetch(imageUrl);
                    const blob = await res.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        onStateUpdate({ 
                            ...state, 
                            result: { base64, mimeType: blob.type } 
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
            console.error("Resize/Outpaint Error:", err);
            setError(err instanceof Error ? err.message : "Outpainting failed.");
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header removed */}
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Resize Studio <span className="text-sm font-normal text-neutral-500 bg-neutral-800 px-2 py-1 rounded ml-2">Outpainting</span></h2>
                <p className="text-neutral-400">Expand your images to new aspect ratios using content-aware AI outpainting.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inputs Column */}
                <div className="lg:col-span-1 space-y-6 bg-neutral-800/30 p-4 rounded-xl border border-neutral-700 h-fit">
                    
                    {/* Image Upload */}
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video bg-neutral-900/50 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-900 hover:border-neutral-500 transition-all relative overflow-hidden group"
                    >
                        {state.source ? (
                            <img src={`data:${state.source.mimeType};base64,${state.source.base64}`} className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-center text-neutral-500">
                                <span className="text-2xl">+</span>
                                <p className="text-xs mt-1">Upload Source Image</p>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                    </div>

                    {/* Dimensions */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Target Ratio Presets</label>
                            <div className="grid grid-cols-2 gap-2">
                                {COMMON_RATIOS.map(r => (
                                    <button 
                                        key={r.label}
                                        onClick={() => handleApplyPreset(r.w, r.h)}
                                        className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded border border-neutral-700 transition-colors"
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Width</label>
                                <input 
                                    type="number" 
                                    value={state.width}
                                    onChange={(e) => onStateUpdate({ ...state, width: parseInt(e.target.value) })}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded p-2 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Height</label>
                                <input 
                                    type="number" 
                                    value={state.height}
                                    onChange={(e) => onStateUpdate({ ...state, height: parseInt(e.target.value) })}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded p-2 text-sm text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Direction & Alignment */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Outpaint Directions</label>
                        <div className="grid grid-cols-3 gap-2 justify-items-center bg-neutral-900/50 p-2 rounded border border-neutral-700">
                            <div></div>
                            <label className="flex flex-col items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={state.directions.top} onChange={() => handleDirectionChange('top')} />
                                <span className="text-[10px] text-neutral-400">TOP</span>
                            </label>
                            <div></div>
                            
                            <label className="flex flex-col items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={state.directions.left} onChange={() => handleDirectionChange('left')} />
                                <span className="text-[10px] text-neutral-400">LEFT</span>
                            </label>
                            <div className="flex items-center justify-center">
                                <div className="w-8 h-8 bg-neutral-800 rounded flex items-center justify-center border border-neutral-600">
                                    <div className="w-4 h-4 bg-neutral-500"></div>
                                </div>
                            </div>
                            <label className="flex flex-col items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={state.directions.right} onChange={() => handleDirectionChange('right')} />
                                <span className="text-[10px] text-neutral-400">RIGHT</span>
                            </label>

                            <div></div>
                            <label className="flex flex-col items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={state.directions.bottom} onChange={() => handleDirectionChange('bottom')} />
                                <span className="text-[10px] text-neutral-400">BOTTOM</span>
                            </label>
                            <div></div>
                        </div>
                    </div>

                    {/* Prompt & Config */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Prompt (Optional)</label>
                            <textarea 
                                value={state.prompt} 
                                onChange={(e) => onStateUpdate({ ...state, prompt: e.target.value })}
                                className="w-full bg-neutral-900 border border-neutral-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
                                placeholder="Describe the extended area (e.g. 'forest background')..."
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Alignment</label>
                                <select 
                                    value={state.alignment}
                                    onChange={(e) => onStateUpdate({ ...state, alignment: e.target.value as any })}
                                    className="w-full bg-neutral-900 border border-neutral-600 rounded p-2 text-sm text-white"
                                >
                                    <option value="Middle">Middle</option>
                                    <option value="Left">Left</option>
                                    <option value="Right">Right</option>
                                    <option value="Top">Top</option>
                                    <option value="Bottom">Bottom</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Mask Overlap (%)</label>
                                <input 
                                    type="range" min="1" max="50"
                                    value={state.overlap}
                                    onChange={(e) => onStateUpdate({ ...state, overlap: parseInt(e.target.value) })}
                                    className="w-full accent-blue-500"
                                />
                                <span className="text-xs text-right block text-neutral-500">{state.overlap}%</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <><LoadingSpinner className="w-4 h-4 text-white" /> Processing...</>
                        ) : (
                            <><ExpandIcon className="w-4 h-4" /> Resize / Outpaint</>
                        )}
                    </button>
                    {error && <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-500/30">{error}</div>}
                </div>

                {/* Result Column */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-3 border-b border-neutral-800 bg-neutral-800/50 flex justify-between items-center">
                        <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Result Image</h3>
                        {state.result && (
                            <AssetActions 
                                asset={{ type: 'image', base64: state.result.base64, mimeType: state.result.mimeType }}
                                onSaveToGrid={() => onAddAssetToGrid({ type: 'image', base64: state.result!.base64, mimeType: state.result!.mimeType })}
                                onSaveToStoryboard={() => onAddToStoryboard(state.result!.base64)}
                                onSaveToInspiration={() => onAddToInspiration(state.result!.base64)}
                            />
                        )}
                    </div>
                    <div className="flex-grow flex items-center justify-center bg-black relative p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <LoadingSpinner className="w-8 h-8 text-blue-500" />
                                <p className="mt-2 text-xs text-neutral-400 animate-pulse">{progress}</p>
                            </div>
                        ) : state.result ? (
                            <img src={`data:${state.result.mimeType};base64,${state.result.base64}`} className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-center text-neutral-600">
                                <ImageIcon className="w-12 h-12 mx-auto mb-2 text-neutral-700" />
                                <p className="text-sm font-medium">Result will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};