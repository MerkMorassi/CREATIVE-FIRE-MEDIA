
import React, { useState } from 'react';
import { generateImageSDXL } from '../services/huggingFaceService';
import { MagicIcon, LoadingSpinner } from './icons.tsx';
import { WarningIcon } from './icons/WarningIcon';
import { AssetActions } from './AssetActions';
import { Project } from '../types.ts';

interface SimpleCinematicStudioProps {
    hfToken: string;
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string; metadata?: any }, targetProjectId?: string) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    project: Project;
}

// --- Hardcoded Generation Parameters ---
const POSITIVE_PROMPT_SUFFIX = "balanced studio lighting, professional exposure, (35mm lens:1.2), natural depth of field, storytelling lens, (eye level shot:1.0), neutral perspective, (extreme long shot:1.4), (establishing shot:1.2), wide view, masterpiece, high fidelity, highly detailed technical photography, award winning cinematography, movie still";
const NEGATIVE_PROMPT = "blurry, low quality, distortion, illustration, painting, cartoon, low resolution, bad anatomy, blurry, low quality, text, watermark, bad anatomy, deformed, sketch, cartoon, 3d render, illustration";
const WIDTH = 1536;
const HEIGHT = 640;
const GUIDANCE_SCALE = 7.5;
const NUM_INFERENCE_STEPS = 40;

export const SimpleCinematicStudio: React.FC<SimpleCinematicStudioProps> = ({
    hfToken,
    onAddAssetToGrid,
    onAddToStoryboard,
    onAddToInspiration,
    project
}) => {
    // State for user input
    const [userPrompt, setUserPrompt] = useState('');

    // State for loading, error, and the generated image
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wakingError, setWakingError] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<{ base64: string; mimeType: string } | null>(null);
    const [metadata, setMetadata] = useState<any>(null);
    const [progress, setProgress] = useState('');

    const handleGenerate = async () => {
        if (!userPrompt.trim()) {
            setError("Please enter a prompt to describe the shot.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setWakingError(null);
        setGeneratedImage(null);
        setMetadata(null);
        setProgress('Connecting to MythOS Cinematic Engine...');

        const finalPrompt = `${userPrompt.trim()}, ${POSITIVE_PROMPT_SUFFIX}`;

        try {
            const seed = Math.floor(Math.random() * 2147483647);
            setProgress('Developing cinematic shot...');

            const blob = await generateImageSDXL({
                prompt: finalPrompt,
                negative_prompt: NEGATIVE_PROMPT,
                width: WIDTH,
                height: HEIGHT,
                seed: seed,
                guidance_scale: GUIDANCE_SCALE,
                num_inference_steps: NUM_INFERENCE_STEPS,
                useSuperiorEngine: true,
            }, hfToken);

            const asset = await new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    const base64 = base64data.split(',')[1];
                    const mimeType = blob.type;
                    resolve({ base64, mimeType });
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            setGeneratedImage(asset);

            const meta = {
                engine: 'MythOS One Shot Generator',
                prompt: finalPrompt,
                user_prompt: userPrompt,
                negative_prompt: NEGATIVE_PROMPT,
                seed: seed,
                width: WIDTH,
                height: HEIGHT,
                steps: NUM_INFERENCE_STEPS,
                guidance: GUIDANCE_SCALE,
            };
            setMetadata(meta);

            // Immediately add to grid
            onAddAssetToGrid({ type: 'image', ...asset, metadata: meta }, project.id);

        } catch (e) {
            console.error("Simple Gen Error:", e);
            const msg = e instanceof Error ? e.message : "Image generation failed.";
            if (msg.includes("Hardware Sleeping")) {
                setWakingError(msg);
                setError(null);
            } else {
                setError(msg);
                setWakingError(null);
            }
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto w-full h-full flex flex-col items-center justify-center space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">One Shot Cinematic Generator</h2>
                <p className="text-neutral-400">Describe a scene, and the engine will apply a pre-defined cinematic style at a 2.39:1 aspect ratio.</p>
            </div>

            <div className="w-full bg-neutral-800/50 border border-neutral-700 rounded-xl p-8 flex flex-col items-center gap-6">
                <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Describe your cinematic shot... e.g., 'a lone astronaut standing on a desolate red planet, looking at a distant blue nebula'"
                    className="w-full h-24 bg-neutral-900 border border-neutral-600 p-4 rounded-xl text-neutral-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    disabled={isLoading}
                />
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !userPrompt.trim()}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                >
                    {isLoading ? (
                        <><LoadingSpinner className="w-6 h-6 text-white" /> {progress || 'Generating...'}</>
                    ) : (
                        <><MagicIcon className="w-6 h-6" /> Generate Shot</>
                    )}
                </button>
                
                {wakingError && (
                    <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm flex flex-col gap-3 max-w-md">
                        <div className="flex items-center gap-2">
                            <WarningIcon className="w-5 h-5 text-yellow-500" />
                            <span className="font-bold uppercase tracking-wider">GPU Core is Sleeping</span>
                        </div>
                        <p className="font-mono text-[11px] leading-tight text-yellow-300">
                            The dedicated hardware has entered sleep mode.
                        </p>
                        <ol className="text-xs list-decimal list-inside space-y-1 pl-1">
                            <li><a href="https://merkmorassi-mythos-engine.hf.space" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-white">Click here to wake the GPU</a>.</li>
                            <li>Wait ~60 seconds for it to initialize, then try again.</li>
                        </ol>
                    </div>
                )}
                {error && !wakingError && <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded border border-red-500/30 max-w-md">{error}</p>}
            </div>

            {generatedImage && !isLoading && (
                <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
                     <div className="w-full bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col relative overflow-hidden">
                        <div className="flex-grow flex items-center justify-center bg-black relative p-4">
                            <img 
                                src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`} 
                                alt="Generated Result" 
                                className="max-w-full max-h-[50vh] object-contain shadow-2xl rounded-sm" 
                            />
                        </div>
                        <div className="p-4 border-t border-accent bg-secondary/90 backdrop-blur-sm flex justify-center">
                            <AssetActions 
                                asset={{ type: 'image', base64: generatedImage.base64, mimeType: generatedImage.mimeType }}
                                onSaveToGrid={(pid) => onAddAssetToGrid({ type: 'image', ...generatedImage, metadata }, pid)}
                                onSaveToStoryboard={() => onAddToStoryboard(generatedImage.base64)}
                                onSaveToInspiration={() => onAddToInspiration(generatedImage.base64)}
                                projects={[project]}
                                activeProjectId={project.id}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
