
import React from 'react';
import { StoryboardFrame } from '../types.ts';
import { LoadingSpinner, VideoIcon } from './icons.tsx';

interface VideoGeneratorProps {
    storyboard: StoryboardFrame[];
    onGenerateVideo: (frame: StoryboardFrame) => void;
    isLoading: boolean;
    videoUrl: string | null;
    error: string | null;
    progress: string;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ storyboard, onGenerateVideo, isLoading, videoUrl, error, progress }) => {
    
    const handleGenerateClick = () => {
        if (storyboard.length > 0) {
            onGenerateVideo(storyboard[0]); // For now, generate from the first frame
        }
    };
    
    if (storyboard.length === 0) {
        return (
             <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">Video Studio</h2>
                    <p className="text-neutral-400">Turn your storyboards into animated clips.</p>
                </div>
                <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/30 text-center p-8">
                    <div className="w-16 h-16 text-neutral-700 mb-4"><VideoIcon /></div>
                    <h3 className="text-xl font-semibold text-neutral-300 mb-2">No Storyboard Frames</h3>
                    <p className="text-neutral-500">Please create a storyboard first to generate a video animatic.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Video Studio</h2>
                <p className="text-neutral-400">Turn your storyboards into animated clips.</p>
            </div>
            
            <div className="bg-neutral-800/50 p-6 rounded-lg border border-neutral-700">
                <p className="text-sm text-neutral-400 mb-4">
                    This tool will generate a video animatic from your storyboard. Currently, it creates a clip from the <strong className="text-neutral-300">first frame</strong> using its prompt and notes as instructions for camera movement.
                </p>

                {error && (
                     <div className="mb-4 bg-red-900/20 border border-red-500 p-4 text-center rounded">
                        <h3 className="text-lg font-semibold text-red-400">Video Generation Failed</h3>
                        <p className="mt-1 text-red-300 text-sm">{error}</p>
                    </div>
                )}
                
                {isLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[300px] bg-neutral-900/50 p-8 rounded-lg">
                        <LoadingSpinner />
                        <p className="mt-4 text-lg text-neutral-300 animate-pulse">{progress || 'Initializing...'}</p>
                    </div>
                )}

                {videoUrl && !isLoading && (
                    <div className="space-y-4 mb-4">
                        <video controls src={videoUrl} className="w-full bg-black rounded-lg shadow-lg" />
                        <a 
                            href={videoUrl} 
                            download={`storyboard-animatic-${Date.now()}.mp4`}
                            className="w-full block text-center bg-neutral-700 text-white font-bold py-3 px-4 hover:bg-neutral-600 transition duration-300 rounded"
                        >
                            Download Video
                        </a>
                    </div>
                )}

                {!isLoading && (
                     <button
                        onClick={handleGenerateClick}
                        disabled={isLoading}
                        className="w-full bg-neutral-700 text-white font-bold py-3 px-4 hover:bg-neutral-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center rounded"
                    >
                        {videoUrl ? 'Generate New Animatic' : 'Generate Animatic from First Frame'}
                    </button>
                )}
            </div>
        </div>
    );
};
