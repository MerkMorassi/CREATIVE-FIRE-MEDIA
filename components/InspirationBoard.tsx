
import React, { useRef, useState } from 'react';
import { InspirationImage } from '../types.ts';
import { UseAsGuideIcon, PinIcon, GridIcon, SearchIcon, ListIcon, FolderIcon } from './icons.tsx';
import { UploadIcon } from './icons/UploadIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';

interface InspirationBoardProps {
    images: InspirationImage[];
    onUpload: (file: File) => void;
    onRemove: (id: string) => void;
    onUseAsGuide: (base64Image: string) => void;
}

export const InspirationBoard: React.FC<InspirationBoardProps> = ({ images, onUpload, onRemove, onUseAsGuide }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            onUpload(file);
        }
        event.target.value = ''; // Reset
    };

    // Filter images based on search query matching ID or auto-generated tags
    const filteredImages = images.filter(image => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase().trim();
        const hasId = image.id.toLowerCase().includes(query);
        const hasTags = image.tags?.some(tag => tag.toLowerCase().includes(query));
        return hasId || hasTags;
    }); 

    return (
        <div className="flex flex-col h-full bg-primary overflow-hidden">
            {/* Header / Toolbar */}
            <div className="flex-shrink-0 bg-neutral-900 border-b border-neutral-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Breadcrumbs & Title */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <FolderIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm text-neutral-400 font-medium">
                            <span className="hover:text-white cursor-pointer transition-colors">Media Library</span>
                            <span className="text-neutral-600">▸</span>
                            <span className="text-white font-bold">All Files</span>
                        </div>
                        <span className="text-xs text-neutral-500 font-mono mt-0.5">{images.length} files</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search files..."
                            className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm rounded-lg block w-full pl-9 p-2 placeholder-neutral-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all w-48 md:w-64"
                        />
                    </div>

                    <div className="h-6 w-px bg-neutral-800 mx-1 hidden md:block"></div>

                    {/* View Toggles */}
                    <div className="flex bg-neutral-800 rounded-lg p-1 border border-neutral-700">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-neutral-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
                            title="Grid View"
                        >
                            <GridIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-neutral-600 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'}`}
                            title="List View"
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Upload Button */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={handleUploadClick}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <UploadIcon className="w-4 h-4" />
                        <span>Upload Files</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow overflow-y-auto p-6 bg-neutral-900/50">
                {filteredImages.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                        <div className="w-20 h-20 bg-neutral-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-neutral-700">
                            <PinIcon className="w-10 h-10 text-neutral-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-300 mb-2">No Media Files</h3>
                        <p className="text-neutral-500 max-w-sm mx-auto mb-6">Upload images or add generations from the Studio to build your inspiration library.</p>
                        <button
                            onClick={handleUploadClick}
                            className="text-blue-400 hover:text-blue-300 font-semibold text-sm border border-blue-500/30 bg-blue-500/10 px-4 py-2 rounded-lg transition-colors"
                        >
                            Browse Local Files
                        </button>
                    </div>
                ) : (
                    <div className={`grid gap-6 ${
                        viewMode === 'grid' 
                            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' 
                            : 'grid-cols-1'
                    }`}>
                        {filteredImages.map(image => (
                            <div 
                                key={image.id} 
                                className={`group relative bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:border-neutral-500 ${
                                    viewMode === 'list' ? 'flex h-32' : 'flex flex-col'
                                }`}
                            >
                                <div className={`${viewMode === 'list' ? 'w-48 h-full shrink-0' : 'aspect-video w-full'} relative bg-black overflow-hidden`}>
                                    <img 
                                        src={`data:image/jpeg;base64,${image.base64Image}`}
                                        alt="Inspiration"
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    {/* Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                        <button
                                            onClick={() => onUseAsGuide(image.base64Image)}
                                            className="p-2 bg-white/10 hover:bg-blue-600 text-white transition-colors rounded-lg border border-white/20 backdrop-blur-sm"
                                            title="Use as Reference"
                                        >
                                            <UseAsGuideIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => onRemove(image.id)}
                                            className="p-2 bg-white/10 hover:bg-red-600 text-white transition-colors rounded-lg border border-white/20 backdrop-blur-sm"
                                            title="Delete"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Info / Tag Panel */}
                                <div className="flex-grow p-3 bg-neutral-900/60 flex flex-col justify-between gap-1.5">
                                    <div>
                                        <h4 className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Inspiration Asset</h4>
                                        <p className="text-[9px] text-neutral-500 font-mono truncate">{image.id}</p>
                                    </div>
                                    {image.tags && image.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {image.tags.map(t => (
                                                <span key={t} className="text-[8px] bg-blue-950/40 text-blue-400 border border-blue-900/20 px-1.5 py-0.5 rounded-full font-mono font-bold">
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
