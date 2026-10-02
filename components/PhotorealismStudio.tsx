
import React, { useState } from 'react';
import { PhotorealismState } from '../types.ts';
import { LoadingSpinner, ChevronDownIcon, PhotoRealismIcon, ClearIcon } from './icons.tsx';
import { AssetActions } from './AssetActions.tsx';
import { getGradioClient } from '../services/gradioService';

interface PhotorealismStudioProps {
    photorealismState: PhotorealismState;
    isLoading: boolean;
    error: string | null;
    onUpload: (file: File) => void;
    onRemoveImage: () => void;
    onGenerate: () => void; // Legacy, we handle locally
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onPromptChange: (prompt: string, negativePrompt: string) => void;
    hfToken?: string;
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
}

const base64ToBlob = async (base64: string, mimeType: string): Promise<Blob> => {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return await res.blob();
};

const ASPECT_RATIOS = [
    { label: '16:9', width: 1344, height: 768, name: 'Cinema' },
    { label: '21:9', width: 1536, height: 640, name: 'Ultrawide' },
    { label: '3:2', width: 1216, height: 832, name: 'Photo' },
    { label: '1:1', width: 1024, height: 1024, name: 'Square' },
    { label: '4:5', width: 896, height: 1152, name: 'Portrait' },
    { label: '9:16', width: 768, height: 1344, name: 'Vertical' },
];

export const PhotorealismStudio: React.FC<PhotorealismStudioProps> = ({ 
    photorealismState, 
    onPromptChange, 
    onAddToStoryboard, 
    onAddToInspiration, 
    onAddAssetToGrid,
    hfToken 
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(photorealismState.result);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [progress, setProgress] = useState<string>('');
    const [seed, setSeed] = useState<number>(-1);
    const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]); // Default 16:9

    const { prompt, negativePrompt } = photorealismState;

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onPromptChange(e.target.value, negativePrompt);
    };

    const handleNegativePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onPromptChange(prompt, e.target.value);
    };

    const handleClear = () => {
        onPromptChange('', '');
        setResult(null);
        setError(null);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a text prompt.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setResult(null);
        setProgress('Initializing UHD Generator...');

        try {
            // Target the openfree/ultpixgen space
            const client = await getGradioClient("openfree/ultpixgen", { hfToken });
            
            setProgress(`Generating ${selectedRatio.label} High-Fidelity Image...`);
            
            const apiResult = await client.predict("/predict", [
                prompt,                 // param_0: Prompt
                negativePrompt || "blurry, low quality, watermark, text, ugly, distorted",   // param_1: Negative Prompt
                seed === -1 ? Math.floor(Math.random() * 2147483647) : seed, // param_2: Seed
                selectedRatio.width,    // param_3: Width
                selectedRatio.height,   // param_4: Height
                7,                      // param_5: Guidance Scale
                50,                     // param_6: Inference Steps
            ]);

            if (apiResult && apiResult.data && apiResult.data.length > 0) {
                // The result is usually a file path or URL object
                let output = apiResult.data[0];
                let imageUrl = '';

                if (typeof output === 'string') {
                    imageUrl = output;
                } else if (output?.url) {
                    imageUrl = output.url;
                } else if (output?.image?.url) {
                    imageUrl = output.image.url;
                }

                if (imageUrl) {
                    setProgress('Downloading UHD result...');
                    const res = await fetch(imageUrl);
                    const blob = await res.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        setResult(base64);
                        setIsLoading(false);
                    };
                    reader.readAsDataURL(blob);
                } else {
                    throw new Error("Could not parse image from response.");
                }
            } else {
                throw new Error("API returned no data.");
            }

        } catch (err) {
            console.error("UHD Generation Error:", err);
            setError(err instanceof Error ? err.message : "Generation failed. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            {/* Header removed */}
            <div className="flex-shrink-0 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">UHD Image Generator <span className="text-sm font-normal text-orange-500 bg-orange-900/20 px-2 py-1 rounded ml-2 border border-orange-500/30">4K+ Resolution</span></h2>
                    <p className="text-neutral-400">Generate massive, ultra-high-definition images from text. Ideal for final production assets and detailed backgrounds.</p>
                </div>
            </div>

            <div className="flex-grow flex flex-col lg:flex-row gap-8">
                {/* Controls Area */}
                <div className="w-full lg:w-1/3 space-y-6 bg-neutral-800/30 p-6 rounded-xl border border-neutral-700 h-fit">
                    
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-white uppercase tracking-wider bg-blue-600 px-2 py-0.5 rounded-md shadow-sm">Text Prompt</label>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={handlePromptChange}
                            placeholder="A majestic mountain landscape with snow, cinematic lighting, 8k resolution, highly detailed..."
                            className="w-full h-40 bg-neutral-900/80 border border-neutral-600 p-4 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-neutral-200 text-base shadow-inner transition-all placeholder-neutral-600"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">Aspect Ratio</label>
                        <div className="grid grid-cols-3 gap-2">
                            {ASPECT_RATIOS.map((ratio) => (
                                <button
                                    key={ratio.label}
                                    onClick={() => setSelectedRatio(ratio)}
                                    className={`px-2 py-2 rounded-lg text-xs font-bold transition-all border ${
                                        selectedRatio.label === ratio.label
                                            ? 'bg-orange-600 border-orange-500 text-white shadow-md'
                                            : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                                    }`}
                                >
                                    {ratio.label}
                                    <span className="block text-[9px] font-normal opacity-70 mt-0.5">{ratio.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !prompt.trim()}
                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-95"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2"><LoadingSpinner className="w-5 h-5 text-white" /> Generating...</span>
                            ) : (
                                "Generate Image"
                            )}
                        </button>
                        <button
                            onClick={handleClear}
                            className="px-4 py-3.5 bg-neutral-700 hover:bg-neutral-600 text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
                            title="Clear Prompt"
                        >
                            Clear
                        </button>
                    </div>

                    {/* Advanced Settings Accordion */}
                    <div className="border-t border-neutral-700 pt-4">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center justify-between w-full text-left text-xs font-bold text-neutral-400 hover:text-white uppercase tracking-wider transition-colors"
                        >
                            <span>Advanced Settings</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-4 space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 mb-1">Negative Prompt</label>
                                    <textarea
                                        value={negativePrompt}
                                        onChange={handleNegativePromptChange}
                                        placeholder="blurry, low quality, watermark, text, ugly..."
                                        className="w-full h-24 bg-neutral-900 border border-neutral-700 p-3 rounded-lg focus:ring-1 focus:ring-orange-500 outline-none resize-none text-neutral-400 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 mb-1">Seed</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={seed}
                                            onChange={(e) => setSeed(parseInt(e.target.value))}
                                            placeholder="-1 for random"
                                            className="w-full bg-neutral-900 border border-neutral-700 p-2 rounded-lg text-sm text-neutral-300 outline-none"
                                        />
                                        <button 
                                            onClick={() => setSeed(-1)}
                                            className="px-3 bg-neutral-700 text-neutral-300 rounded-lg text-xs font-bold hover:bg-neutral-600 transition-colors whitespace-nowrap"
                                        >
                                            Random (-1)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-sm">
                            <strong className="block mb-1">Generation Error</strong>
                            {error}
                        </div>
                    )}
                </div>

                {/* Result Area */}
                <div className="w-full lg:w-2/3 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col overflow-hidden relative min-h-[500px]">
                    <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-800/50">
                        <div className="flex items-center gap-2">
                            <PhotoRealismIcon className="w-5 h-5 text-orange-500" />
                            <span className="font-bold text-neutral-200 text-sm">Generated Image ({selectedRatio.width}x{selectedRatio.height} Base)</span>
                        </div>
                        {result && (
                            <div className="flex gap-2">
                                <AssetActions 
                                    asset={{ type: 'image', base64: result, mimeType: 'image/jpeg' }}
                                    onSaveToGrid={onAddAssetToGrid ? () => onAddAssetToGrid({ type: 'image', base64: result, mimeType: 'image/jpeg' }) : undefined}
                                    onSaveToStoryboard={() => onAddToStoryboard(result)}
                                    onSaveToInspiration={() => onAddToInspiration(result)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex-grow flex items-center justify-center bg-black/50 relative p-8">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <LoadingSpinner className="w-12 h-12 text-orange-500" />
                                <p className="mt-6 text-orange-400 animate-pulse font-mono text-lg">{progress}</p>
                                <p className="mt-2 text-neutral-500 text-sm">Accessing 5K rendering engine...</p>
                            </div>
                        ) : result ? (
                            <img 
                                src={`data:image/jpeg;base64,${result}`} 
                                alt="UHD Generated Result" 
                                className="max-w-full max-h-[70vh] object-contain shadow-2xl rounded-lg ring-1 ring-white/10" 
                            />
                        ) : (
                            <div className="text-neutral-600 flex flex-col items-center select-none opacity-50">
                                <div className="w-24 h-24 border-2 border-dashed border-neutral-700 rounded-2xl flex items-center justify-center mb-4">
                                    <PhotoRealismIcon className="w-10 h-10" />
                                </div>
                                <p className="text-lg font-medium">Ready to Generate</p>
                                <p className="text-sm">Enter a prompt to create a 5K Ultra HD image.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
