
import React, { useRef, useState } from 'react';
import { TopazState } from '../types.ts';
import { LoadingSpinner, MagicIcon, VideoIcon, ChevronDownIcon } from './icons.tsx';
import { BeforeAfterModal } from './BeforeAfterModal.tsx';
import { AssetActions } from './AssetActions.tsx';

interface TopazStudioProps {
    topazState: TopazState;
    isLoading: boolean;
    error: string | null;
    onStateUpdate: (newState: TopazState) => void;
    onGenerate: () => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    progress: string;
    progressPercent?: number; // Added to support visual progress bar
}

const MediaUpload: React.FC<{
    media: { base64: string; mimeType: string } | null;
    mediaType: 'image' | 'video';
    onUpload: (file: File) => void;
    onRemoveMedia: () => void;
}> = ({ media, mediaType, onUpload, onRemoveMedia }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) onUpload(file);
        event.target.value = '';
    };

    if (media) {
        return (
            <div className="relative group w-full h-full min-h-[300px] bg-black/40 rounded-xl overflow-hidden border border-neutral-700 flex items-center justify-center">
                {mediaType === 'video' ? (
                    <video 
                        src={`data:${media.mimeType};base64,${media.base64}`} 
                        className="w-full h-full object-contain max-h-[60vh]" 
                        controls
                    />
                ) : (
                    <img 
                        src={`data:${media.mimeType};base64,${media.base64}`} 
                        alt="Source" 
                        className="w-full h-full object-contain max-h-[60vh]" 
                    />
                )}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button
                        onClick={onRemoveMedia}
                        className="bg-black/60 text-white p-2 rounded-lg hover:bg-red-600 transition-colors backdrop-blur-md shadow-lg"
                        title="Remove Media"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-xl bg-neutral-800/30 cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-500 transition-all group"
        >
            <div className="flex flex-col items-center justify-center p-6 text-center transition-transform group-hover:scale-105 duration-300">
                <div className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-neutral-700 transition-colors shadow-inner border border-neutral-700/50">
                    {mediaType === 'video' ? <VideoIcon className="w-10 h-10 text-neutral-500 group-hover:text-blue-400" /> : <MagicIcon className="w-10 h-10 text-neutral-500 group-hover:text-purple-400" />}
                </div>
                <h3 className="text-xl font-bold text-neutral-300 mb-2">Upload {mediaType === 'video' ? 'Video' : 'Image'}</h3>
                <p className="text-sm text-neutral-500 max-w-xs mx-auto">Drag & drop or click to browse. Supported formats: {mediaType === 'video' ? 'MP4, MOV' : 'JPG, PNG'}</p>
            </div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept={mediaType === 'video' ? "video/*" : "image/*"} />
        </div>
    );
};

const ResultDisplay: React.FC<{
    source: { base64: string; mimeType: string };
    result: { base64: string; mimeType: string } | null;
    resultUrl?: string | null;
    mediaType: 'image' | 'video';
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    onViewFull: () => void;
}> = ({ source, result, resultUrl, mediaType, onAddToStoryboard, onAddToInspiration, onAddAssetToGrid, onViewFull }) => {
    
    if (mediaType === 'video' && resultUrl) {
        return (
            <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-end">
                    <h3 className="text-lg font-bold text-neutral-200">Enhanced Result</h3>
                    <div className="flex gap-2">
                         <AssetActions 
                            asset={{ type: 'video', url: resultUrl }}
                            onSaveToGrid={onAddAssetToGrid ? () => onAddAssetToGrid({ type: 'video', url: resultUrl }) : undefined}
                        />
                    </div>
                </div>
                <div className="bg-black/40 p-1 rounded-xl border border-neutral-700 overflow-hidden">
                    <video 
                        src={resultUrl} 
                        className="w-full max-h-[60vh] object-contain bg-black rounded-lg" 
                        controls 
                    />
                </div>
            </div>
        );
    }

    if (mediaType === 'image' && result) {
        return (
            <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-end">
                    <h3 className="text-lg font-bold text-neutral-200">Enhancement Result</h3>
                    <div className="flex gap-2">
                        <AssetActions 
                            asset={{ type: 'image', base64: result.base64, mimeType: result.mimeType }}
                            onSaveToGrid={onAddAssetToGrid ? () => onAddAssetToGrid({ type: 'image', base64: result.base64, mimeType: result.mimeType }) : undefined}
                            onSaveToStoryboard={() => onAddToStoryboard(result.base64)}
                            onSaveToInspiration={() => onAddToInspiration(result.base64)}
                        />
                    </div>
                </div>
                <div className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-700">
                    <div className="flex flex-col md:flex-row gap-4 h-[500px]">
                        <div className="w-full md:w-1/2 cursor-pointer group relative rounded-lg overflow-hidden border border-neutral-700 bg-black" onClick={onViewFull}>
                            <img src={`data:${source.mimeType};base64,${source.base64}`} alt="Original" className="w-full h-full object-contain" />
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm">ORIGINAL</div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md transform translate-y-2 group-hover:translate-y-0 transition-all">View Comparison</span>
                            </div>
                        </div>
                        <div className="w-full md:w-1/2 cursor-pointer group relative rounded-lg overflow-hidden border border-neutral-700 bg-black" onClick={onViewFull}>
                            <img src={`data:${result.mimeType};base64,${result.base64}`} alt="Result" className="w-full h-full object-contain" />
                            <div className="absolute top-2 left-2 bg-blue-600/80 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm">ENHANCED</div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md transform translate-y-2 group-hover:translate-y-0 transition-all">View Comparison</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export const TopazStudio: React.FC<TopazStudioProps> = ({ topazState, isLoading, error, onStateUpdate, onGenerate, onAddToStoryboard, onAddToInspiration, onAddAssetToGrid, progress, progressPercent }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
             const result = e.target?.result as string;
             const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
             const base64 = result.split(',')[1];
             onStateUpdate({ ...topazState, source: { base64, mimeType }, result: null, resultUrl: null });
        };
        reader.readAsDataURL(file);
    };

    const mediaType = topazState.activeMediaType || 'image';

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header removed */}
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Enhance Studio <span className="text-sm font-normal text-neutral-500 bg-neutral-800 px-2 py-1 rounded ml-2">Topaz Labs</span></h2>
                <p className="text-neutral-400">Professional-grade upscaling, sharpening, and restoration for your assets.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
                {/* Controls */}
                <div className="lg:col-span-1 bg-neutral-800/50 p-6 border border-neutral-700 rounded-xl flex flex-col gap-6 h-fit sticky top-6">
                    
                    {/* Media Type Toggle */}
                    <div className="bg-neutral-900 p-1 rounded-lg flex border border-neutral-700">
                        <button 
                            onClick={() => onStateUpdate({ ...topazState, activeMediaType: 'image', source: null, result: null, resultUrl: null })}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mediaType === 'image' ? 'bg-neutral-700 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Image Mode
                        </button>
                        <button 
                            onClick={() => onStateUpdate({ ...topazState, activeMediaType: 'video', source: null, result: null, resultUrl: null })}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mediaType === 'video' ? 'bg-neutral-700 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Video Mode
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Operation</label>
                            <div className="relative">
                                {mediaType === 'video' ? (
                                    <select 
                                        value="enhance" 
                                        disabled
                                        className="w-full bg-neutral-900 border border-neutral-600 p-3 rounded-lg text-neutral-400 appearance-none cursor-not-allowed opacity-75 text-sm"
                                    >
                                        <option value="enhance">Video Enhancement</option>
                                    </select>
                                ) : (
                                    <select 
                                        value={topazState.operation} 
                                        onChange={(e) => onStateUpdate({ ...topazState, operation: e.target.value as any })}
                                        className="w-full bg-neutral-900 border border-neutral-600 p-3 rounded-lg text-white appearance-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer text-sm font-medium"
                                    >
                                        <option value="enhance">Enhance (Upscale & Fix)</option>
                                        <option value="sharpen">Sharpen (De-blur)</option>
                                        <option value="denoise">Denoise (Clean Grain)</option>
                                        <option value="restore">Face & Photo Restore</option>
                                        <option value="lighting">Lighting Adjustment</option>
                                    </select>
                                )}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                                    <ChevronDownIcon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        {mediaType === 'video' && (
                            <div className="bg-neutral-900/50 p-4 rounded-lg border border-neutral-700 text-xs space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="font-bold text-neutral-300 uppercase tracking-wider">Active Pipeline</span>
                                </div>
                                <div className="flex justify-between border-b border-neutral-800 pb-2">
                                    <span className="text-neutral-500">Model</span>
                                    <span className="text-white font-mono">Proteus v4</span>
                                </div>
                                <div className="flex justify-between border-b border-neutral-800 pb-2">
                                    <span className="text-neutral-500">Frame Interpolation</span>
                                    <span className="text-white font-mono">Apollo v8</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">Output Encoder</span>
                                    <span className="text-white font-mono">H.265 (Main)</span>
                                </div>
                            </div>
                        )}

                        {(topazState.operation === 'enhance' || mediaType === 'video') ? (
                            <div className="bg-neutral-900/30 p-4 rounded-lg border border-neutral-700">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Upscale Factor</label>
                                    <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{topazState.parameters.scale}x</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" max="4" step="1"
                                    value={topazState.parameters.scale}
                                    onChange={(e) => onStateUpdate({ ...topazState, parameters: { ...topazState.parameters, scale: parseInt(e.target.value) } })}
                                    className="w-full accent-blue-500 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-neutral-500 mt-2 font-mono">
                                    <span>1x (Original)</span>
                                    <span>2x</span>
                                    <span>4x (Ultra)</span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-neutral-900/30 p-4 rounded-lg border border-neutral-700">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Effect Strength</label>
                                    <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">{topazState.parameters.strength}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="100" step="1"
                                    value={topazState.parameters.strength}
                                    onChange={(e) => onStateUpdate({ ...topazState, parameters: { ...topazState.parameters, strength: parseInt(e.target.value) } })}
                                    className="w-full accent-blue-500 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-neutral-500 mt-2 font-mono">
                                    <span>Subtle</span>
                                    <span>Aggressive</span>
                                </div>
                            </div>
                        )}

                        {mediaType === 'image' && ['enhance', 'sharpen', 'denoise', 'restore'].includes(topazState.operation) && (
                            <div className="bg-neutral-900/30 p-3 rounded-lg border border-neutral-700 flex items-center justify-between">
                                 <div className="flex flex-col">
                                    <span className="text-sm font-bold text-neutral-300">Face Recovery</span>
                                    <span className="text-[10px] text-neutral-500">Restore facial details automatically</span>
                                 </div>
                                 <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={topazState.faceRecovery}
                                        onChange={(e) => onStateUpdate({ ...topazState, faceRecovery: e.target.checked })}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-neutral-700">
                        <button
                            onClick={onGenerate}
                            disabled={isLoading || !topazState.source}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">Processing...</span>
                            ) : (
                                <><MagicIcon className="w-5 h-5" /> Enhance Media</>
                            )}
                        </button>
                        {error && (
                            <div className="mt-3 text-red-400 text-xs bg-red-900/20 p-3 rounded-lg border border-red-800/50 flex items-start gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                {error}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    <MediaUpload 
                        media={topazState.source} 
                        mediaType={mediaType}
                        onUpload={handleUpload} 
                        onRemoveMedia={() => onStateUpdate({ ...topazState, source: null, result: null, resultUrl: null })} 
                    />

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center p-8 bg-neutral-900/50 rounded-xl border border-neutral-800 relative overflow-hidden">
                            {/* Animated Background Gradient for processing feel */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-blue-900/10 animate-pulse pointer-events-none"></div>
                            
                            <LoadingSpinner className="w-12 h-12 text-blue-500 mb-6" />
                            
                            {/* Progress Bar Container */}
                            <div className="w-full max-w-md bg-neutral-800 h-2 rounded-full mb-4 overflow-hidden relative">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-500 ease-out relative"
                                    style={{ width: `${progressPercent || 0}%` }}
                                >
                                    {/* Shimmer effect on bar */}
                                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1.5s_infinite] skew-x-[-20deg] transform -translate-x-full"></div>
                                </div>
                            </div>
                            
                            <div className="text-center space-y-1 z-10">
                                <p className="text-xl font-bold text-neutral-200 tracking-wide">{progress}</p>
                                {progressPercent !== undefined && (
                                    <p className="text-sm font-mono text-blue-400 font-bold">{Math.round(progressPercent)}%</p>
                                )}
                                <p className="text-xs text-neutral-500 mt-2">Running on Topaz Labs Cloud Engine</p>
                            </div>
                            <style>{`
                                @keyframes shimmer {
                                    100% { transform: translateX(100%); }
                                }
                            `}</style>
                        </div>
                    )}

                    {(topazState.result || topazState.resultUrl) && topazState.source && !isLoading && (
                        <ResultDisplay 
                            source={topazState.source} 
                            result={topazState.result}
                            resultUrl={topazState.resultUrl}
                            mediaType={mediaType}
                            onAddToStoryboard={onAddToStoryboard}
                            onAddToInspiration={onAddToInspiration}
                            onAddAssetToGrid={onAddAssetToGrid}
                            onViewFull={() => setIsModalOpen(true)}
                        />
                    )}
                </div>
            </div>
             <BeforeAfterModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                beforeImage={topazState.source}
                afterImage={topazState.result ? topazState.result.base64 : null}
            />
        </div>
    );
};
