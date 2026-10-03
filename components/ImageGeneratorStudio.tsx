
import React, { useState } from 'react';
import { GenerationOptions, PromptTemplate, DynamicPromptList, Agent, ImageState, LoreEntry, VisualLoreConsistencyResult } from '../types.ts';
import { InputPanel } from './InputPanel.tsx';
import { ImageGrid } from './ImageGrid.tsx';
import { generateImageSDXL } from '../services/huggingFaceService.ts';
import { generateImageFromGemini, checkVisualLoreConsistencyService } from '../services/geminiService.ts';
import { refineNsfwPrompt } from '../services/dolphinService.ts';
import { blobToBase64 } from '../utils/imageUtils.ts';
import { ImageIcon } from './icons.tsx';

interface ImageGeneratorStudioProps {
    hfToken: string;
    promptTemplates: PromptTemplate[];
    dynamicPromptLists: DynamicPromptList[];
    agents: Agent[];
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string; metadata?: any }, targetProjectId?: string) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onCreateAgent: (data: Partial<Agent>) => Agent;
    lore?: LoreEntry[];
    characters?: any[];
}

const nsfwKeywords = [
    'nude', 'naked', 'nsfw', 'explicit', 'sexy', 'sex', 'porn', 'erotic', 'lust', 'seductive', 'boudoir'
];

export const ImageGeneratorStudio: React.FC<ImageGeneratorStudioProps> = ({
    hfToken,
    promptTemplates,
    dynamicPromptLists,
    agents,
    onAddAssetToGrid,
    onAddToStoryboard,
    onAddToInspiration,
    onCreateAgent,
    lore = [],
    characters = [],
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<ImageState[]>([]);
    const [lastUsedSeed, setLastUsedSeed] = useState<string | undefined>();
    const [progressMessage, setProgressMessage] = useState('');
    
    const [gridOverlay, setGridOverlay] = useState<any>('none');
    const [agentFilter, setAgentFilter] = useState('');

    // Visual Lore Consistency State
    const [loreCheckResult, setLoreCheckResult] = useState<VisualLoreConsistencyResult | null>(null);
    const [isCheckingLore, setIsCheckingLore] = useState(false);
    const [appliedFixMessage, setAppliedFixMessage] = useState<string | null>(null);

    const handleGenerate = async (options: GenerationOptions) => {
        setIsLoading(true);
        setError(null);
        setGeneratedImages([]);
        setProgressMessage('Initializing generation...');

        try {
            const imagePromises: Promise<ImageState>[] = [];
            const numImages = options.numImages > 0 ? options.numImages : 1;
            
            let finalPrompt = options.prompt;
            let finalEngine = options.engine;
            
            const isNsfw = nsfwKeywords.some(kw => options.prompt.toLowerCase().includes(kw));
            if (isNsfw) {
                setProgressMessage('NSFW prompt detected. Refining with Dolphin...');
                finalEngine = 'mythos_sdxl';
                finalPrompt = await refineNsfwPrompt(options.prompt, hfToken);
            }

            // Cross-reference prompt with visual lore bible & character profiles
            setProgressMessage('Cross-referencing prompt against visual lore bible...');
            let loreConsistency: VisualLoreConsistencyResult | null = null;
            try {
                loreConsistency = await checkVisualLoreConsistencyService({
                    prompt: finalPrompt,
                    lore,
                    characters
                });
                setLoreCheckResult(loreConsistency);
            } catch (lcErr) {
                console.warn("Visual lore check error:", lcErr);
            }

            for (let i = 0; i < numImages; i++) {
                const seed = options.seed ? parseInt(options.seed, 10) + i : Math.floor(Math.random() * 2147483647);
                if (i === 0) setLastUsedSeed(String(seed));

                const currentOptions: GenerationOptions = { ...options, prompt: finalPrompt, seed: String(seed) };

                const generationPromise = (async () => {
                    setProgressMessage(`Generating image ${i + 1} of ${numImages}...`);
                    let blob: Blob;
                    if (finalEngine === 'mythos_sdxl') {
                        const { width, height } = ((ar: string) => {
                            switch(ar) {
                                case '16:9': return { width: 1024, height: 576 };
                                case '9:16': return { width: 576, height: 1024 };
                                case '1:1': return { width: 1024, height: 1024 };
                                case '2.39:1': return { width: 1536, height: 640 };
                                default: return { width: 1024, height: 1024 };
                            }
                        })(currentOptions.aspectRatio);

                        blob = await generateImageSDXL({
                            prompt: currentOptions.prompt,
                            negative_prompt: currentOptions.negativePrompt,
                            width,
                            height,
                            seed,
                            guidance_scale: currentOptions.guidanceScale,
                            useSuperiorEngine: true,
                        }, hfToken);
                    } else { // gemini
                        blob = await generateImageFromGemini(currentOptions);
                    }
                    
                    const base64 = await blobToBase64(blob);
                    const newImage: ImageState = {
                        id: `img_${Date.now()}_${i}`,
                        type: 'image',
                        base64,
                        mimeType: blob.type,
                        isUpscaling: false,
                        metadata: { 
                            ...currentOptions, 
                            seed,
                            loreConsistency: loreConsistency || undefined
                        }
                    };
                    return newImage;
                })();

                imagePromises.push(generationPromise);
            }

            setProgressMessage(`Downloading ${numImages} generated images...`);
            const newImages = await Promise.all(imagePromises);
            setGeneratedImages(newImages);
            newImages.forEach(img => onAddAssetToGrid(img));

        } catch (e) {
            console.error("Image Generation Error:", e);
            setError(e instanceof Error ? e.message : "An unknown error occurred during image generation.");
        } finally {
            setIsLoading(false);
            setProgressMessage('');
        }
    };

    return (
        <div className="flex h-full w-full bg-primary overflow-hidden">
            <div className="w-full md:w-96 flex-shrink-0 bg-secondary/50 p-6 border-r border-accent overflow-y-auto custom-scrollbar">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-brand/20 rounded-lg text-brand"><ImageIcon className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Image Studio</h2>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Advanced Generation Controls</p>
                    </div>
                </div>
                <InputPanel
                    onGenerate={handleGenerate}
                    isLoading={isLoading}
                    lastUsedSeed={lastUsedSeed}
                    promptTemplates={promptTemplates}
                    dynamicPromptLists={dynamicPromptLists}
                    preparedOptions={null}
                    onPreparationComplete={() => {}}
                />
            </div>

            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar space-y-6">
                {/* Visual Lore Consistency Cross-Reference Banner & Inspector */}
                {loreCheckResult && (
                    <div className={`p-4 rounded-xl border backdrop-blur-md transition-all shadow-xl ${
                        loreCheckResult.status === 'deviated'
                            ? 'bg-gradient-to-r from-red-950/70 via-black/80 to-red-950/70 border-red-500/70'
                            : 'bg-emerald-950/40 border-emerald-500/40'
                    }`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">
                                    {loreCheckResult.status === 'deviated' ? '⚠️' : '✓'}
                                </span>
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider font-mono text-white flex items-center gap-2">
                                        <span>Visual Lore Cross-Reference:</span>
                                        <span className={loreCheckResult.status === 'deviated' ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                                            {loreCheckResult.status === 'deviated'
                                                ? `Flagged (${loreCheckResult.deviations.length} Deviations Detected)`
                                                : `Verified (${loreCheckResult.confidenceScore}% Lore Consistent)`}
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-neutral-400 mt-0.5">
                                        {loreCheckResult.explanation}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setLoreCheckResult(null)}
                                className="text-[10px] text-neutral-500 hover:text-white uppercase font-bold tracking-wider cursor-pointer self-end sm:self-auto"
                            >
                                Dismiss
                            </button>
                        </div>

                        {/* Deviations List */}
                        {loreCheckResult.deviations && loreCheckResult.deviations.length > 0 && (
                            <div className="mt-3 space-y-2">
                                <span className="text-[10px] font-black uppercase text-red-400 font-mono tracking-wider block">
                                    Flagged Visual Contradictions Against Creative Bible:
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {loreCheckResult.deviations.map((d, dIdx) => (
                                        <div key={dIdx} className="bg-black/50 border border-red-900/50 p-2.5 rounded-lg text-xs space-y-1">
                                            <div className="flex justify-between items-center text-[10px] font-mono">
                                                <span className="text-white font-bold">{d.entity}</span>
                                                <span className={`px-1 rounded uppercase font-black text-[8px] ${
                                                    d.severity === 'critical' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400'
                                                }`}>
                                                    {d.severity}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-neutral-300">
                                                <strong className="text-red-400">Prompt:</strong> "{d.promptConflict}"
                                            </div>
                                            <div className="text-[11px] text-neutral-400">
                                                <strong className="text-green-400">Lore Bible:</strong> {d.expectedLore}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {loreCheckResult.suggestedCorrection && (
                                    <div className="mt-3 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <div className="text-xs">
                                            <span className="text-[10px] font-bold text-neutral-400 uppercase block font-mono">
                                                Suggested Lore-Aligned Prompt:
                                            </span>
                                            <p className="text-xs text-neutral-300 italic max-w-xl font-mono truncate">
                                                "{loreCheckResult.suggestedCorrection}"
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(loreCheckResult.suggestedCorrection);
                                                setAppliedFixMessage("Copied aligned prompt to clipboard!");
                                                setTimeout(() => setAppliedFixMessage(null), 3000);
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all shrink-0 cursor-pointer shadow-md"
                                        >
                                            Copy Aligned Prompt
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {appliedFixMessage && (
                            <div className="mt-2 text-xs font-bold text-emerald-400 font-mono animate-fade-in">
                                ✓ {appliedFixMessage}
                            </div>
                        )}
                    </div>
                )}

                 <ImageGrid
                    images={generatedImages}
                    isLoading={isLoading}
                    error={error}
                    progressMessage={progressMessage}
                    onViewImage={() => {}} // This grid is for display only
                    gridOverlay={gridOverlay}
                    onGridOverlayChange={setGridOverlay}
                    onEditImage={() => {}} 
                    onAddToStoryboard={onAddToStoryboard}
                    onAddToInspiration={onAddToInspiration}
                    onUpscaleImage={() => {}}
                    agents={agents}
                    onAssignAgentToImage={() => {}}
                    onCreateAgent={onCreateAgent}
                    agentFilter={agentFilter}
                    onAgentFilterChange={setAgentFilter}
                    awaitingExternalGeneration={false}
                />
                 {generatedImages.length === 0 && !isLoading && !error && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-neutral-600">
                        <ImageIcon className="w-16 h-16 mb-4" />
                        <h3 className="text-lg font-bold">Generation Results</h3>
                        <p className="text-sm">Your generated images will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};