
import React, { useState } from 'react';
import { DownloadIcon, AddToStoryIcon, PinIcon, GridIcon } from './icons';

interface AssetActionsProps {
    asset: {
        type: 'image' | 'video';
        base64?: string;
        url?: string;
        mimeType?: string;
    };
    onSaveToGrid?: (targetProjectId: string) => void;
    onSaveToStoryboard?: () => void;
    onSaveToInspiration?: () => void;
    projects?: { id: string; name: string }[];
    activeProjectId?: string;
    className?: string;
}

export const AssetActions: React.FC<AssetActionsProps> = ({ 
    asset, 
    onSaveToGrid, 
    onSaveToStoryboard, 
    onSaveToInspiration,
    projects = [],
    activeProjectId,
    className = ""
}) => {
    const [feedback, setFeedback] = useState<string | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || (projects[0]?.id) || 'unassigned');

    const showFeedback = (msg: string) => {
        setFeedback(msg);
        setTimeout(() => setFeedback(null), 2000);
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        if (asset.type === 'video' && asset.url) {
            link.href = asset.url;
            link.download = `video-asset-${Date.now()}.mp4`;
            link.target = '_blank'; // Needed for some cross-origin setups
        } else if (asset.type === 'image' && asset.base64) {
            link.href = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
            link.download = `image-asset-${Date.now()}.jpeg`;
        } else {
            console.error("Invalid asset format for download");
            return;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showFeedback("Downloaded");
    };

    const wrapAction = (action: (() => void) | undefined, msg: string) => {
        if (!action) return undefined;
        return () => {
            action();
            showFeedback(msg);
        };
    };

    const handleSaveToGrid = () => {
        if (onSaveToGrid) {
            onSaveToGrid(selectedProjectId);
            const projName = projects.find(p => p.id === selectedProjectId)?.name || 'Bin';
            showFeedback(`Saved to ${projName}`);
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button 
                onClick={handleDownload} 
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded shadow-sm"
                title="Download to computer"
            >
                <DownloadIcon /> <span className="hidden sm:inline">Download</span>
            </button>

            {onSaveToGrid && (
                <div className="flex bg-neutral-700 rounded shadow-sm">
                    {projects.length > 0 && (
                        <div className="border-r border-neutral-600 relative">
                            <select 
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="h-full bg-transparent text-xs text-neutral-300 pl-2 pr-1 outline-none cursor-pointer appearance-none hover:text-white max-w-[100px] truncate"
                                title="Select Active Project or Bin"
                            >
                                {projects.map(p => (
                                    <option key={p.id} value={p.id} className="bg-neutral-800 text-white">
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button 
                        onClick={handleSaveToGrid} 
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-600 transition rounded-r"
                        title="Save Output"
                    >
                        <GridIcon /> <span className="hidden sm:inline">Save</span>
                    </button>
                </div>
            )}

            {onSaveToStoryboard && (
                <button 
                    onClick={wrapAction(onSaveToStoryboard, "Added to Storyboard")} 
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded shadow-sm"
                    title="Add to Storyboard"
                >
                    <AddToStoryIcon />
                </button>
            )}

            {onSaveToInspiration && asset.type === 'image' && (
                <button 
                    onClick={wrapAction(onSaveToInspiration, "Pinned to Inspiration")} 
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded shadow-sm"
                    title="Pin to Inspiration"
                >
                    <PinIcon />
                </button>
            )}

            {feedback && (
                <span className="text-xs text-brand animate-fade-in font-bold ml-2 whitespace-nowrap">
                    {feedback}
                </span>
            )}
        </div>
    );
};
