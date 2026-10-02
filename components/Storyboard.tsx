
import React, { useState } from 'react';
import { StoryboardFrame as StoryboardFrameType } from '../types.ts';
import { DownloadIcon, StoryboardIcon, GridIcon } from './icons.tsx';
import { PlusIcon } from './icons/PlusIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';

interface StoryboardProps {
    frames: StoryboardFrameType[];
    onUpdateNote: (id: string, notes: string) => void;
    onRemove: (id: string) => void;
    onReorder: (startIndex: number, endIndex: number) => void;
}

const downloadImage = (base64Image: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64Image}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Print View Component - Optimized for PDF Export
const PrintView: React.FC<{ frames: StoryboardFrameType[] }> = ({ frames }) => {
    return (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] text-black overflow-y-auto">
            <div className="max-w-[21cm] mx-auto p-8 h-full">
                {/* Header */}
                <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Storyboard</h1>
                        <p className="text-sm font-bold mt-2 text-gray-600 tracking-widest uppercase">Production: Untitled Project</p>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Generated</div>
                        <div className="text-sm font-mono font-bold">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Frames List */}
                <div className="flex flex-col gap-6">
                    {frames.map((frame, index) => (
                        <div key={frame.id} className="break-inside-avoid flex border-2 border-black h-48 bg-white">
                            {/* Visual Reference */}
                            <div className="w-[300px] flex-shrink-0 border-r-2 border-black relative bg-gray-100 flex items-center justify-center overflow-hidden">
                                <img 
                                    src={`data:image/jpeg;base64,${frame.base64Image}`} 
                                    className="w-full h-full object-cover"
                                    alt={`Shot ${index}`}
                                />
                                <div className="absolute top-0 left-0 bg-black text-white px-2 py-1 text-xs font-bold z-10">
                                    #{index + 1}
                                </div>
                            </div>

                            {/* Data & Notes */}
                            <div className="flex-grow flex flex-col">
                                <div className="flex border-b border-black divide-x divide-black bg-gray-50">
                                    <div className="px-3 py-1.5 text-xs font-bold uppercase w-24">SCENE 1</div>
                                    <div className="px-3 py-1.5 text-xs font-bold uppercase w-24">SHOT {String.fromCharCode(65 + (index % 26))}</div>
                                    <div className="px-3 py-1.5 text-xs font-bold uppercase flex-grow">NOTES</div>
                                </div>

                                <div className="p-4 flex-grow relative">
                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap font-mono text-gray-800">
                                        {frame.notes || <span className="text-gray-400 italic">No description provided.</span>}
                                    </p>
                                    {frame.prompt && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <p className="text-[10px] text-gray-500 line-clamp-2 italic">
                                                Prompt: {frame.prompt}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Footer */}
                <div className="fixed bottom-0 left-0 w-full text-center py-4 bg-white border-t border-black text-[10px] font-bold uppercase tracking-widest text-gray-400 print:block hidden">
                    Mythos Director Pro • AI Storyboard Generator
                </div>
            </div>
        </div>
    );
};

const ShotCard: React.FC<{
    frame: StoryboardFrameType;
    index: number;
    onUpdateNote: (id: string, notes: string) => void;
    onRemove: (id: string) => void;
    onDragStart: (e: React.DragEvent, index: number) => void;
    onDragEnter: (e: React.DragEvent, index: number) => void;
    onDragEnd: (e: React.DragEvent) => void;
    draggedOverIndex: number | null;
}> = ({ frame, index, onUpdateNote, onRemove, onDragStart, onDragEnter, onDragEnd, draggedOverIndex }) => {
    
    const isBeingDraggedOver = draggedOverIndex === index;
    const shotLetter = String.fromCharCode(65 + (index % 26)); // A, B, C...

    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className={`
                group relative flex flex-col bg-neutral-900/80 border rounded-xl overflow-hidden shadow-lg transition-all duration-200 backdrop-blur-sm
                ${isBeingDraggedOver ? 'border-blue-500 ring-2 ring-blue-500/20 scale-[1.02] z-10' : 'border-neutral-800 hover:border-neutral-600 hover:shadow-2xl hover:-translate-y-1'}
            `}
        >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-2.5 bg-neutral-800/80 border-b border-neutral-700/50">
                <div className="flex items-center gap-2">
                    <span className="bg-black/40 text-neutral-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/5">
                        #{index + 1}
                    </span>
                    <span className="text-xs font-bold text-neutral-200 tracking-wide">SHOT {shotLetter}</span>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onClick={(e) => { e.stopPropagation(); downloadImage(frame.base64Image, `shot-${index + 1}.jpeg`); }}
                        className="text-neutral-500 hover:text-white transition-colors p-1"
                        title="Download Image"
                    >
                        <DownloadIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(frame.id); }}
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                        title="Remove Shot"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Image Area */}
            <div className="relative aspect-video bg-black cursor-move group/image">
                <img 
                    src={`data:image/jpeg;base64,${frame.base64Image}`} 
                    alt={`Shot ${shotLetter}`} 
                    className="w-full h-full object-cover opacity-90 group-hover/image:opacity-100 transition-opacity" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity pointer-events-none" />
            </div>

            {/* Notes Area */}
            <div className="flex-grow p-4 bg-neutral-900 flex flex-col gap-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Action / Notes</label>
                <textarea
                    value={frame.notes}
                    onChange={(e) => onUpdateNote(frame.id, e.target.value)}
                    placeholder="Describe action, camera movement, or dialogue..."
                    className="w-full h-24 bg-neutral-800/50 border border-neutral-700/50 rounded-lg p-3 text-sm text-neutral-300 placeholder-neutral-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:bg-neutral-800 transition-all leading-relaxed"
                />
            </div>
        </div>
    );
};

export const Storyboard: React.FC<StoryboardProps> = ({ frames, onUpdateNote, onRemove, onReorder }) => {
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);
    const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

    const handleDragStart = (e: React.DragEvent, position: number) => {
        dragItem.current = position;
        e.dataTransfer.effectAllowed = 'move';
        // Create custom drag image ghost if needed, usually browser default is fine with proper CSS
    };

    const handleDragEnter = (e: React.DragEvent, position: number) => {
        dragOverItem.current = position;
        setDraggedOverIndex(position);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
            onReorder(dragItem.current, dragOverItem.current);
        }
        dragItem.current = null;
        dragOverItem.current = null;
        setDraggedOverIndex(null);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col h-full w-full bg-primary overflow-hidden">
            <PrintView frames={frames} />
            
            {/* Header */}
            <div className="flex-shrink-0 bg-neutral-900 border-b border-neutral-800 px-8 py-6 flex items-end justify-between print:hidden z-10">
                <div>
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">Storyboard</h2>
                    <p className="text-neutral-400">Assemble your narrative sequence. Drag and drop to reorder shots.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-neutral-800 rounded-lg border border-neutral-700 flex items-center gap-3">
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Shots</span>
                        <span className="text-lg font-bold text-white">{frames.length}</span>
                    </div>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-neutral-100 hover:bg-white text-neutral-900 font-bold px-5 py-2.5 rounded-lg transition-all shadow-lg hover:shadow-white/10 active:scale-95"
                        title="Export as PDF"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span>Print / PDF</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow overflow-y-auto p-8 bg-neutral-900/50 print:hidden scrollbar-thin scrollbar-thumb-neutral-700">
                {frames.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-60">
                        <div className="w-24 h-24 bg-neutral-800/50 rounded-3xl flex items-center justify-center mb-6 border-2 border-dashed border-neutral-700">
                            <StoryboardIcon className="w-10 h-10 text-neutral-600" />
                        </div>
                        <h3 className="text-xl font-bold text-neutral-300 mb-2">Storyboard Empty</h3>
                        <p className="text-neutral-500 max-w-md text-center">
                            Generate images in the Studio and click "Add to Storyboard" to start building your sequence.
                        </p>
                    </div>
                ) : (
                    <div className="max-w-[1920px] mx-auto pb-20">
                        {/* Scene Divider */}
                        <div className="flex items-center gap-4 mb-8 text-neutral-500">
                            <div className="h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent flex-grow"></div>
                            <span className="text-xs font-bold uppercase tracking-[0.2em]">Sequence 01</span>
                            <div className="h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent flex-grow"></div>
                        </div>

                        {/* Grid */}
                        <div 
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6"
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onDragLeave={() => setDraggedOverIndex(null)}
                        >
                            {frames.map((frame, index) => (
                                <ShotCard
                                    key={frame.id}
                                    frame={frame}
                                    index={index}
                                    onUpdateNote={onUpdateNote}
                                    onRemove={onRemove}
                                    onDragStart={handleDragStart}
                                    onDragEnter={handleDragEnter}
                                    onDragEnd={handleDrop}
                                    draggedOverIndex={draggedOverIndex}
                                />
                            ))}
                            
                            {/* Add Placeholder */}
                            <div className="border-2 border-dashed border-neutral-800 bg-neutral-900/30 rounded-xl flex flex-col items-center justify-center aspect-video hover:bg-neutral-800/50 hover:border-neutral-700 transition-all group cursor-pointer">
                                <div className="p-4 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors mb-3">
                                    <PlusIcon className="w-6 h-6 text-neutral-500 group-hover:text-neutral-300" />
                                </div>
                                <span className="font-bold text-xs text-neutral-600 uppercase tracking-wider group-hover:text-neutral-400">Add from Gallery</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
