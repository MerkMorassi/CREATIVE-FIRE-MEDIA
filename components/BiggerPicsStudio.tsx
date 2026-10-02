import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner, ExpandIcon } from './icons.tsx';
import { AssetActions } from './AssetActions';

interface BiggerPicsStudioProps {
    onAddAssetToGrid?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }, targetProjectId?: string) => void;
    projects: { id: string; name: string }[];
    activeProjectId?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Extract pure base64 without data: prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const BiggerPicsStudio: React.FC<BiggerPicsStudioProps> = ({
    onAddAssetToGrid,
    projects,
    activeProjectId
}) => {
    const [sourceImage, setSourceImage] = useState<{ base64: string; mimeType: string } | null>(null);
    const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
    const [upscaledBlob, setUpscaledBlob] = useState<Blob | null>(null);
    const [upscaledMeta, setUpscaledResultMeta] = useState<{ width: number; height: number; name: string } | null>(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const popupRef = useRef<Window | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const mimeType = result.split(',')[0].split(':')[1].split(';')[0];
                const base64 = result.split(',')[1];
                setSourceImage({ base64, mimeType });
                setUpscaledUrl(null);
                setUpscaledBlob(null);
                setUpscaledResultMeta(null);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpscale = () => {
        if (!sourceImage) {
            setError("Please upload an image to upscale first.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setStatusMessage('Opening Bigger Pics upscaler...');

        // 1. Open the popup without noopener
        const popup = window.open("https://bigger.pics/", "_blank");
        if (!popup) {
            setError("Popup blocked. Please allow popups for this site to use Bigger Pics upscaling.");
            setIsLoading(false);
            return;
        }
        popupRef.current = popup;

        // 2. Poll popup.closed to handle closures without outputs
        const pollTimer = setInterval(() => {
            if (popup.closed) {
                clearInterval(pollTimer);
                setIsLoading(currentIsLoading => {
                    if (currentIsLoading) {
                        setStatusMessage('');
                    }
                    return false;
                });
            }
        }, 1000);
    };

    // 3. Listen for postMessage communication
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            // Ignore messages from origins other than the bigger.pics app
            if (event.origin !== "https://app.bigger.pics") return;

            const data = event.data;

            // Trigger when bigger.pics is fully ready to receive the image payload
            if (data.type === "bigger-pics-ready" && popupRef.current && sourceImage) {
                setStatusMessage('Transferring reference layers...');
                
                // Formulate complete data URI to send
                const dataUrl = `data:${sourceImage.mimeType};base64,${sourceImage.base64}`;

                popupRef.current.postMessage({
                    type: "bigger-pics-image",
                    url: dataUrl,
                    name: "production_frame.png",
                    site: "MythOS Studio Pro",
                    format: "png"
                }, "https://app.bigger.pics");
                
                setStatusMessage('Upscaling in progress. Please return once upscaled...');
            }

            // Triggered when upscaling has successfully completed
            if (data.type === "bigger-pics-result" && data.blob) {
                setStatusMessage('Importing high resolution master...');
                try {
                    const resultBlob = data.blob as Blob;
                    const objectUrl = URL.createObjectURL(resultBlob);
                    
                    setUpscaledBlob(resultBlob);
                    setUpscaledUrl(objectUrl);
                    setUpscaledResultMeta({
                        width: data.width || 0,
                        height: data.height || 0,
                        name: data.name || "upscaled.png"
                    });

                    // Auto-pipe into project asset vault if enabled
                    if (onAddAssetToGrid) {
                        const b64 = await blobToBase64(resultBlob);
                        onAddAssetToGrid({
                            type: 'image',
                            base64: b64,
                            mimeType: resultBlob.type
                        });
                    }

                    setStatusMessage('');
                    setIsLoading(false);
                    setError(null);
                    
                    // Close popup safely
                    if (popupRef.current) {
                        popupRef.current.close();
                    }
                } catch (e) {
                    console.error("Error reading upscale results:", e);
                    setError("Failed to process upscaled result from Bigger Pics.");
                    setIsLoading(false);
                }
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [sourceImage, onAddAssetToGrid]);

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white tracking-tight uppercase">Bigger Pics Studio</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">GPU Super Resolution (4x)</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Free, high-fidelity neural image upscaling without loss of sharpness, powered by Bigger Pics popups.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
                {/* Controls */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-6 h-fit">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Source image reference</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full aspect-square max-w-md mx-auto border-2 border-dashed border-neutral-800 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-800/40 hover:border-neutral-700 transition-all text-neutral-500 hover:text-neutral-300 relative overflow-hidden"
                        >
                            {sourceImage ? (
                               <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Source Reference" className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-center p-4">
                                    <ExpandIcon className="w-8 h-8 mx-auto mb-2 text-neutral-600 animate-pulse" />
                                    <span className="text-xs font-semibold block">Upload Reference Frame</span>
                                    <span className="text-[10px] text-neutral-500 block mt-1">Supports PNG, JPEG up to 12MB</span>
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="rounded-lg bg-neutral-950 p-4 border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
                            <span className="font-bold text-neutral-200 block mb-1">💡 Neural Super Resolution Protocol</span>
                            This studio routes your reference canvas directly into the high-performance bigger.pics neural upscalers. Ad-funded execution ensures premium upscaling for free, directly integrated into your project asset grid.
                        </div>

                        <button
                            onClick={handleUpscale}
                            disabled={isLoading || !sourceImage}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                        >
                            {isLoading ? (
                                <>
                                    <LoadingSpinner className="w-4 h-4" />
                                    <span>{statusMessage || 'Connecting popup...'}</span>
                                </>
                            ) : (
                                <>
                                    <ExpandIcon className="w-4 h-4" />
                                    <span>Upscale with Bigger Pics</span>
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-950/20 p-3 rounded border border-red-500/30">{error}</p>
                    )}
                </div>

                {/* Upscale master output preview */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col relative overflow-hidden min-h-[450px]">
                    <div className="flex-grow flex flex-col items-center justify-center bg-neutral-950 relative p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center text-center">
                                <LoadingSpinner className="text-blue-500 w-8 h-8" />
                                <p className="mt-4 text-xs font-mono text-neutral-400 animate-pulse">{statusMessage}</p>
                            </div>
                        ) : upscaledUrl ? (
                            <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                                <div className="relative w-full h-full max-h-[50vh] rounded-lg overflow-hidden border border-neutral-800 bg-black">
                                    <img src={upscaledUrl} alt="Upscaled Master" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-center bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-[10px] text-neutral-400 font-mono">
                                    Dimensions: {upscaledMeta?.width}px × {upscaledMeta?.height}px · Format: PNG (Lossless)
                                </div>
                            </div>
                        ) : (
                            <div className="text-neutral-600 flex flex-col items-center select-none text-center max-w-xs">
                                <ExpandIcon className="w-12 h-12 text-neutral-800 mb-2" />
                                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Upscale output master</p>
                                <p className="text-[10px] text-neutral-600 mt-1">Upscaled high resolution masters will display here once completed. The result is automatically imported into your project grid.</p>
                            </div>
                        )}
                    </div>
                    {upscaledUrl && !isLoading && (
                        <div className="p-4 border-t border-neutral-800 bg-neutral-900/90 backdrop-blur-sm flex justify-center">
                            <AssetActions 
                                asset={{ type: 'image', url: upscaledUrl }}
                                onSaveToGrid={onAddAssetToGrid ? (pid) => onAddAssetToGrid!({ type: 'image', url: upscaledUrl! }, pid) : undefined}
                                onSaveToStoryboard={() => {}}
                                projects={projects}
                                activeProjectId={activeProjectId}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
