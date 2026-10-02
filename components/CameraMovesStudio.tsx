
import React, { useState, useRef } from 'react';
import { CameraMovesState } from '../types';
import { LoadingSpinner, DollyIcon, ClapperboardIcon, VideoIcon } from './icons';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';
import { extractFramesFromVideo } from '../utils/video';

interface CameraMovesStudioProps {
    state: CameraMovesState;
    onStateUpdate: (newState: CameraMovesState) => void;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
    onAddToStoryboard: (base64: string) => void;
    hfToken?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const CAMERA_MOTIONS = [
    { label: 'Orbit', value: '1' },
    { label: 'Dolly Zoom In', value: '2' },
    { label: 'Dolly Zoom Out', value: '3' },
    { label: 'Pan Left', value: '4' },
    { label: 'Pan Right', value: '5' },
    { label: 'Tilt Up', value: '6' },
    { label: 'Tilt Down', value: '7' },
    { label: 'Crane Up', value: '8' },
    { label: 'Crane Down', value: '9' },
];

export const CameraMovesStudio: React.FC<CameraMovesStudioProps> = ({ 
    state, 
    onStateUpdate, 
    onAddAssetToGrid, 
    onAddToStoryboard,
    hfToken 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
                const base64 = result.split(',')[1];
                onStateUpdate({ ...state, sourceVideo: { base64, mimeType }, resultUrl: null });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleGenerate = async () => {
        if (!state.sourceVideo) {
            setError("Please upload an input video.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress('Connecting to ReCamMaster...');

        try {
            const videoBlob = await base64ToBlob(state.sourceVideo.base64, state.sourceVideo.mimeType);
            const client = await getGradioClient("alexnasa/ReCamMaster-ZEROGPU", { hfToken });
            
            setProgress('Running camera path simulation...');
            
            const result = await client.predict("/run", { 
				video_path: videoBlob, 		
		        text: state.prompt, 		
		        cam_type: state.cameraType, 		
		        steps: state.steps, 
            });

            if (result?.data?.[0]?.url) {
                onStateUpdate({ ...state, resultUrl: result.data[0].url });
            } else {
                throw new Error("Could not parse video URL from the model's response.");
            }
        } catch (err) {
            console.error("ReCamMaster generation error:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const handleAddToStoryboardWithThumbnail = async () => {
        if (!state.resultUrl) return;
        try {
            // This assumes the result URL is CORS-friendly or an object URL.
            // If it's a Gradio temp URL, it might fail.
            const frames = await extractFramesFromVideo(state.resultUrl, 1);
            if (frames.length > 0) {
                onAddToStoryboard(frames[0]);
            }
        } catch (e) {
            console.error("Could not extract thumbnail:", e);
            alert("Could not extract thumbnail for storyboard. This may be due to browser security restrictions on the video source.");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Camera Moves Studio <span className="text-sm font-normal text-purple-400 bg-purple-900/20 px-2 py-1 rounded ml-2 border border-purple-500/30">ReCamMaster</span></h2>
                <p className="text-neutral-400">Apply simulated camera movements to existing video clips.</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
                {/* Controls */}
                <div className="lg:col-span-1 bg-neutral-800/50 p-6 border border-neutral-700 rounded-xl flex flex-col gap-6 h-fit">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video bg-neutral-900/50 border-2 border-dashed border-neutral-700 rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-900 hover:border-neutral-500 transition-all relative overflow-hidden group"
                    >
                        {state.sourceVideo ? (
                            <video src={`data:${state.sourceVideo.mimeType};base64,${state.sourceVideo.base64}`} className="w-full h-full object-contain" />
                        ) : (
                            <div className="text-center text-neutral-500">
                                <VideoIcon className="w-8 h-8 mx-auto mb-2" />
                                <span className="text-xs font-bold uppercase tracking-wider">Upload Video</span>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" className="hidden" accept="video/*" onChange={handleUpload} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Camera Motion</label>
                        <select 
                            value={state.cameraType}
                            onChange={(e) => onStateUpdate({ ...state, cameraType: e.target.value })}
                            className="w-full bg-neutral-900 border border-neutral-600 p-3 rounded-lg text-sm text-white"
                        >
                            {CAMERA_MOTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Prompt</label>
                        <textarea 
                            value={state.prompt}
                            onChange={(e) => onStateUpdate({ ...state, prompt: e.target.value })}
                            className="w-full h-24 bg-neutral-900 border border-neutral-600 rounded p-3 text-sm"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase">Inference Steps ({state.steps})</label>
                        <input 
                            type="range" 
                            min="5" max="50" step="1" 
                            value={state.steps} 
                            onChange={e => onStateUpdate({ ...state, steps: parseInt(e.target.value) })}
                            className="w-full accent-purple-500 mt-1"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !state.sourceVideo}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-auto"
                    >
                        {isLoading ? <LoadingSpinner className="w-5 h-5" /> : <DollyIcon className="w-5 h-5" />}
                        {isLoading ? (progress || 'Processing...') : 'Generate Camera Move'}
                    </button>
                    {error && <p className="text-xs text-red-400 text-center bg-red-900/20 p-2 rounded">{error}</p>}
                </div>

                {/* Result */}
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col relative overflow-hidden min-h-[500px]">
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
                                onSaveToGrid={() => onAddAssetToGrid({ type: 'video', url: state.resultUrl! })}
                                onSaveToStoryboard={handleAddToStoryboardWithThumbnail}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
