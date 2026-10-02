import React, { useState, useRef } from 'react';
import { DubbingState } from '../types';
import { LoadingSpinner, VideoIcon, SpeakerIcon, ClapperboardIcon } from './icons';
import { AssetActions } from './AssetActions';
import { getGradioClient } from '../services/gradioService';
import { extractFramesFromVideo } from '../utils/video';

interface DubbingStudioProps {
    state: DubbingState;
    onStateUpdate: (newState: DubbingState) => void;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }, targetProjectId?: string) => void;
    onAddToStoryboard: (base64: string) => void;
    hfToken?: string;
    projects: { id: string; name: string }[];
    activeProjectId?: string;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const MediaUpload: React.FC<{
    title: string;
    type: 'video' | 'audio';
    media: { base64: string; mimeType: string } | null;
    onUpload: (file: File) => void;
    onRemove: () => void;
}> = ({ title, type, media, onUpload, onRemove }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) onUpload(e.target.files[0]);
        e.target.value = '';
    };

    return (
        <div 
            onClick={() => inputRef.current?.click()}
            className="w-full h-full bg-neutral-900 border-2 border-dashed border-neutral-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-800/50 hover:border-neutral-500 transition-all relative overflow-hidden group min-h-[300px]"
        >
            {media ? (
                <>
                    {type === 'video' ? (
                        <video src={`data:${media.mimeType};base64,${media.base64}`} className="w-full h-full object-contain" controls />
                    ) : (
                        <audio src={`data:${media.mimeType};base64,${media.base64}`} className="w-full" controls />
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </>
            ) : (
                <div className="text-center text-neutral-500 group-hover:text-blue-400">
                    {type === 'video' ? <VideoIcon className="w-12 h-12 mx-auto mb-2" /> : <SpeakerIcon className="w-12 h-12 mx-auto mb-2" />}
                    <p className="text-sm font-bold uppercase tracking-wider">{title}</p>
                </div>
            )}
            <input ref={inputRef} type="file" className="hidden" accept={`${type}/*`} onChange={handleChange} />
        </div>
    );
};

export const DubbingStudio: React.FC<DubbingStudioProps> = ({ state, onStateUpdate, onAddAssetToGrid, onAddToStoryboard, hfToken, projects, activeProjectId }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleUpload = (type: 'video' | 'audio', file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
            const base64 = result.split(',')[1];
            if (type === 'video') {
                onStateUpdate({ ...state, sourceVideo: { base64, mimeType } });
            } else {
                onStateUpdate({ ...state, sourceAudio: { base64, mimeType } });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleGenerate = async () => {
        if (!state.sourceVideo || !state.sourceAudio) {
            setError("Both a source video and a dub audio file are required.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgress('Connecting to Mythos Dubbing Studio...');
        onStateUpdate({ ...state, resultUrl: null });

        try {
            const videoBlob = await base64ToBlob(state.sourceVideo.base64, state.sourceVideo.mimeType);
            const audioBlob = await base64ToBlob(state.sourceAudio.base64, state.sourceAudio.mimeType);

            const client = await getGradioClient("merkmorassi/mythos-dubbing-studio", { hfToken });
            setProgress('Performing lip-sync operation...');

            const result = await client.predict("/main", {
                video_path: videoBlob,
                audio_path: audioBlob,
            });

            if (result?.data?.[0]?.url) {
                onStateUpdate({ ...state, resultUrl: result.data[0].url });
            } else {
                throw new Error("Could not parse the resulting video from the LatentSync model's response.");
            }
        } catch (err) {
            console.error("Dubbing generation error:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred during the lip-sync process.");
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };
    
    const handleAddToStoryboardWithThumbnail = async () => {
        if (!state.resultUrl) return;
        try {
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
            <div>
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Dubbing Studio <span className="text-sm font-normal text-neutral-500 bg-surface px-2 py-1 rounded ml-2">LatentSync</span></h2>
                <p className="text-neutral-400">Generate lip-synced videos by combining a source video with a new audio track.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow">
                {/* Inputs Column */}
                <div className="flex flex-col gap-6">
                    <MediaUpload title="Upload Source Video" type="video" media={state.sourceVideo} onUpload={(f) => handleUpload('video', f)} onRemove={() => onStateUpdate({...state, sourceVideo: null})} />
                    <MediaUpload title="Upload Dub Audio" type="audio" media={state.sourceAudio} onUpload={(f) => handleUpload('audio', f)} onRemove={() => onStateUpdate({...state, sourceAudio: null})} />
                </div>
                
                {/* Result Column */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col relative overflow-hidden min-h-[500px]">
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
                                onSaveToStoryboard={handleAddToStoryboardWithThumbnail}
                                projects={projects}
                                activeProjectId={activeProjectId}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-shrink-0 pt-4 border-t border-neutral-800">
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !state.sourceVideo || !state.sourceAudio}
                    className="w-full max-w-md mx-auto py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                >
                    {isLoading ? <LoadingSpinner className="w-6 h-6" /> : <SpeakerIcon className="w-6 h-6" />}
                    {isLoading ? (progress || 'Generating...') : 'Generate Dub'}
                </button>
                {error && <p className="text-sm text-red-400 text-center mt-4">{error}</p>}
            </div>
        </div>
    );
};
