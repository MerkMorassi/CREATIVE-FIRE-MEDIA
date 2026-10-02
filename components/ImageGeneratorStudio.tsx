
import React, { useState } from 'react';
import { GenerationOptions, PromptTemplate, DynamicPromptList, Agent, ImageState } from '../types.ts';
import { InputPanel } from './InputPanel.tsx';
import { ImageGrid } from './ImageGrid.tsx';
import { generateImageSDXL } from '../services/huggingFaceService.ts';
import { generateImageFromGemini } from '../services/geminiService.ts';
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
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<ImageState[]>([]);
    const [lastUsedSeed, setLastUsedSeed] = useState<string | undefined>();
    const [progressMessage, setProgressMessage] = useState('');
    
    const [gridOverlay, setGridOverlay] = useState<any>('none');
    const [agentFilter, setAgentFilter] = useState('');

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
                        metadata: { ...currentOptions, seed }
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

            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
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