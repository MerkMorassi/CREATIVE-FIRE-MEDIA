




import React, { useState, useRef, useEffect } from 'react';
import { LoadingSpinner, BasicGridOverlay, TriadicGridOverlay, BasicGoldenRatioGridOverlay, TriadicGoldenRatioGridOverlay, EditIcon, AddToStoryIcon, PinIcon, DownloadIcon, UpscaleIcon, CharacterIcon, AutomationIcon, VideoIcon } from './icons.tsx';
import { GridOverlayType, ImageState, Agent } from '../types.ts';

interface ImageGridProps {
  images: ImageState[];
  isLoading: boolean;
  error: string | null;
  progressMessage?: string;
  onViewImage: (image: ImageState) => void;
  gridOverlay: GridOverlayType;
  onGridOverlayChange: (type: GridOverlayType) => void;
  onEditImage: (base64Image: string) => void;
  onAddToStoryboard: (base64Image: string) => void;
  onAddToInspiration: (base64Image: string) => void;
  onUpscaleImage: (id: string) => void;
  agents: Agent[];
  onAssignAgentToImage: (imageId: string, agentId: string | null) => void;
  onCreateAgent: (data: Partial<Agent>) => Agent;
  agentFilter: string;
  onAgentFilterChange: (filter: string) => void;
  awaitingExternalGeneration: boolean;
  showGridSelectors?: boolean;
  onUploadImage?: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string }) => void;
  onUpdateImages?: (images: ImageState[]) => void;
}

const gridOptions: { id: GridOverlayType; label: string }[] = [
    { id: 'none', label: 'No Grid' },
    { id: 'basic', label: 'Basic' },
    { id: 'triadic', label: 'Triadic' },
    { id: 'golden-basic', label: 'Golden Ratio 1. Basic' },
    { id: 'golden-triadic', label: 'Golden Ratio 2. Triadic' },
];

const downloadAsset = (image: ImageState) => {
    const link = document.createElement('a');
    if (image.type === 'video' && image.url) {
        link.href = image.url;
        link.download = `video-${Date.now()}.mp4`;
        link.target = "_blank";
    } else if (image.base64) {
        link.href = `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`;
        link.download = `image-${Date.now()}.jpeg`;
    } else {
        return;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const AssignAgentControl: React.FC<{ 
    image: ImageState;
    agents: Agent[];
    onAssignAgentToImage: (imageId: string, agentId: string | null) => void;
    onCreateAgent: (data: Partial<Agent>) => Agent;
}> = ({ image, agents, onAssignAgentToImage, onCreateAgent }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleAssign = (agentId: string | null) => {
        onAssignAgentToImage(image.id, agentId);
        setIsOpen(false);
    };

    const handleCreateAndAssign = () => {
        const name = prompt("Enter the new agent's name:");
        if (name && name.trim()) {
            const newAgent = onCreateAgent({ name });
            onAssignAgentToImage(image.id, newAgent.id);
        }
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 bg-black/60 text-white hover:bg-neutral-600 transition-colors rounded-md"
                title="Assign Agent"
            >
                <CharacterIcon />
            </button>
            {isOpen && (
                <div className="absolute bottom-full right-0 mb-1 w-48 bg-neutral-800 border border-neutral-700 shadow-lg z-20 rounded-md overflow-hidden">
                    <div className="p-1 text-xs text-neutral-400">Assign Agent</div>
                    <div className="max-h-40 overflow-y-auto">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => handleAssign(agent.id)}
                                className="w-full text-left px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
                            >
                                {agent.name}
                            </button>
                        ))}
                    </div>
                    <div className="border-t border-neutral-700">
                        <button
                            onClick={handleCreateAndAssign}
                            className="w-full text-left px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700"
                        >
                            + Create new...
                        </button>
                        {image.agentId && (
                             <button
                                onClick={() => handleAssign(null)}
                                className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-neutral-700"
                            >
                                x Unassign
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ImageGrid: React.FC<ImageGridProps> = ({ images, isLoading, error, progressMessage, onViewImage, gridOverlay, onGridOverlayChange, onEditImage, onAddToStoryboard, onAddToInspiration, onUpscaleImage, agents, onAssignAgentToImage, onCreateAgent, agentFilter, onAgentFilterChange, awaitingExternalGeneration, showGridSelectors = true, onUploadImage, onUpdateImages }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bulk selection and folders state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [showFolderDropdown, setShowFolderDropdown] = useState<boolean>(false);
  const [bulkTagInput, setBulkTagInput] = useState<string>('');
  
  const [activeAssignOpen, setActiveAssignOpen] = useState(false);
  const [activeMoveOpen, setActiveMoveOpen] = useState(false);
  const [activeTagOpen, setActiveTagOpen] = useState(false);

  // AI Auto-Tagging tracking state
  const [taggingIds, setTaggingIds] = useState<string[]>([]);

  const handleAutoTagSingle = async (image: ImageState) => {
      if (!onUpdateImages) return;
      setTaggingIds(prev => [...prev, image.id]);
      try {
          const res = await fetch('/api/auto-tag', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  base64: image.base64,
                  url: image.url,
                  mimeType: image.mimeType || (image.type === 'video' ? 'video/mp4' : 'image/jpeg')
              })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to generate tags");

          const generatedTags = data.tags || [];
          if (generatedTags.length > 0) {
              const updated = images.map(img => {
                  if (img.id === image.id) {
                      const existing = img.tags || [];
                      const combined = Array.from(new Set([...existing, ...generatedTags]));
                      return { ...img, tags: combined };
                  }
                  return img;
              });
              onUpdateImages(updated);
          }
      } catch (err) {
          console.error("Auto tag error:", err);
          alert(`Auto tag failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
          setTaggingIds(prev => prev.filter(id => id !== image.id));
      }
  };

  const handleAutoTagBulk = async () => {
      if (!onUpdateImages || selectedIds.length === 0) return;
      const idsToTag = [...selectedIds];
      setTaggingIds(prev => [...prev, ...idsToTag]);
      setSelectedIds([]);
      
      try {
          const tagPromises = idsToTag.map(async (id) => {
              const img = images.find(i => i.id === id);
              if (!img) return null;
              
              try {
                  const res = await fetch('/api/auto-tag', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          base64: img.base64,
                          url: img.url,
                          mimeType: img.mimeType || (img.type === 'video' ? 'video/mp4' : 'image/jpeg')
                      })
                  });
                  const data = await res.json();
                  if (res.ok && data.tags) {
                      return { id, tags: data.tags };
                  }
              } catch (e) {
                  console.error(`Bulk tag failed for item ${id}:`, e);
              }
              return null;
          });
          
          const results = await Promise.all(tagPromises);
          
          const updated = images.map(img => {
              const foundResult = results.find(r => r && r.id === img.id);
              if (foundResult) {
                  const existing = img.tags || [];
                  const combined = Array.from(new Set([...existing, ...foundResult.tags]));
                  return { ...img, tags: combined };
              }
              return img;
          });
          
          onUpdateImages(updated);
      } catch (err) {
          console.error("Bulk auto tag error:", err);
      } finally {
          setTaggingIds(prev => prev.filter(id => !idsToTag.includes(id)));
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && onUploadImage) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64Data = (event.target?.result as string).split(',')[1];
              onUploadImage({
                  type: 'image',
                  base64: base64Data,
                  mimeType: file.type
              });
          };
          reader.readAsDataURL(file);
      }
  };

  // Base filtered images (by search/filter query)
  const filteredImages = images.filter(image => {
      if (!agentFilter) return true;
      const searchLower = agentFilter.toLowerCase();
      
      // Check agent name match
      const agentName = image.agentId ? agents.find(c => c.id === image.agentId)?.name : '';
      if (agentName && agentName.toLowerCase().includes(searchLower)) return true;
      
      // Check tags match
      if (image.tags && image.tags.some(tag => tag.toLowerCase().includes(searchLower))) return true;
      
      return false;
  });

  // Unique folders list
  const folderList = Array.from(new Set(images.map(img => img.folder).filter(Boolean))) as string[];

  // Visible images inside selected folder
  const visibleImages = filteredImages.filter(img => {
      if (selectedFolder === 'all') return true;
      if (selectedFolder === 'unassigned') return !img.folder;
      return img.folder === selectedFolder;
  });

  // Check if all visible items are selected
  const isAllSelected = visibleImages.length > 0 && visibleImages.every(img => selectedIds.includes(img.id));

  const toggleSelectAll = () => {
      if (isAllSelected) {
          setSelectedIds(prev => prev.filter(id => !visibleImages.some(img => img.id === id)));
      } else {
          const visibleIds = visibleImages.map(img => img.id);
          setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
      }
  };

  const toggleSelectItem = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Bulk actions handlers
  const handleBulkAssignAgent = (agentId: string | null) => {
      if (!onUpdateImages) return;
      const updated = images.map(img => {
          if (selectedIds.includes(img.id)) {
              return { ...img, agentId: agentId || undefined };
          }
          return img;
      });
      onUpdateImages(updated);
      setSelectedIds([]);
  };

  const handleBulkTag = (tagString: string) => {
      if (!onUpdateImages || !tagString.trim()) return;
      const tagsToAdd = tagString.split(',').map(t => t.trim()).filter(Boolean);
      const updated = images.map(img => {
          if (selectedIds.includes(img.id)) {
              const existingTags = img.tags || [];
              const combined = Array.from(new Set([...existingTags, ...tagsToAdd]));
              return { ...img, tags: combined };
          }
          return img;
      });
      onUpdateImages(updated);
      setBulkTagInput('');
      setSelectedIds([]);
  };

  const handleBulkMoveToFolder = (folderName: string | null) => {
      if (!onUpdateImages) return;
      const updated = images.map(img => {
          if (selectedIds.includes(img.id)) {
              return { ...img, folder: folderName || undefined };
          }
          return img;
      });
      onUpdateImages(updated);
      setSelectedIds([]);
      setNewFolderName('');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <LoadingSpinner />
        <p className="mt-4 text-lg text-neutral-300 animate-pulse">{progressMessage || 'Generating your masterpieces...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-red-900/20 border border-red-500 p-8 text-center rounded-lg">
        <div>
          <h3 className="text-xl font-semibold text-red-400">Generation Failed</h3>
          <p className="mt-2 text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (awaitingExternalGeneration) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center rounded-lg">
            <div className="w-16 h-16 text-neutral-700"><AutomationIcon /></div>
            <h3 className="mt-4 text-xl font-semibold text-neutral-400">Request Sent to External Engine</h3>
            <p className="mt-1 text-neutral-500">Your images are being generated by your external service. Check your configured output folder for results.</p>
        </div>
    );
  }

  if (images.length === 0 && !agentFilter) {
    return (
       <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-4 text-xl font-semibold text-neutral-400">Project Gallery</h3>
        <p className="mt-1 text-neutral-500">Generated images and videos will appear here.</p>
        {onUploadImage && (
            <div className="mt-4">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-all font-medium text-sm mx-auto shadow-md"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload first image
                </button>
            </div>
        )}
      </div>
    );
  }

  const compositionHint: Record<GridOverlayType, string> = {
    'none': '',
    'basic': 'Composition Hint: Prompt is being enhanced for Rule of Thirds.',
    'triadic': 'Composition Hint: Prompt is being enhanced for Triadic composition.',
    'golden-basic': 'Composition Hint: Prompt is being enhanced for Golden Ratio composition.',
    'golden-triadic': 'Composition Hint: Prompt is being enhanced for Golden Ratio (Triadic) composition.',
  };
  
  const getAgentName = (agentId?: string) => {
      if (!agentId) return null;
      return agents.find(c => c.id === agentId)?.name;
  };

  const handleCardClick = (image: ImageState) => {
      if (selectedIds.length > 0) {
          setSelectedIds(prev => prev.includes(image.id) ? prev.filter(x => x !== image.id) : [...prev, image.id]);
      } else {
          onViewImage(image);
      }
  };

  return (
    <div className="p-6 h-full overflow-y-auto custom-scrollbar space-y-5">
        {/* Horizontal folders browsing list */}
        {onUpdateImages && (
            <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl space-y-3 shadow-md">
                 <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                     <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Browse Folders</span>
                     <button 
                         type="button"
                         onClick={() => {
                             const fName = prompt("Enter new folder name:");
                             if (fName && fName.trim()) {
                                 setSelectedFolder(fName.trim());
                             }
                         }}
                         className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-bold flex items-center gap-1"
                     >
                         <span>+ New Folder</span>
                     </button>
                 </div>
                 <div className="flex gap-2 overflow-x-auto pb-1.5 custom-scrollbar snap-x scroll-smooth">
                     <button
                         type="button"
                         onClick={() => setSelectedFolder('all')}
                         className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 snap-start ${
                             selectedFolder === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                         }`}
                     >
                         <span>📂</span>
                         <span>All Assets</span>
                         <span className="bg-black/30 text-[10px] px-1.5 py-0.5 rounded-full text-neutral-300 font-mono">
                             {images.length}
                         </span>
                     </button>
                     <button
                         type="button"
                         onClick={() => setSelectedFolder('unassigned')}
                         className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 snap-start ${
                             selectedFolder === 'unassigned' ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                         }`}
                     >
                         <span>📁</span>
                         <span>Unassigned</span>
                         <span className="bg-black/30 text-[10px] px-1.5 py-0.5 rounded-full text-neutral-300 font-mono">
                             {images.filter(img => !img.folder).length}
                         </span>
                     </button>
                     {folderList.map(folderName => (
                         <button
                             key={folderName}
                             type="button"
                             onClick={() => setSelectedFolder(folderName)}
                             className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 snap-start ${
                                 selectedFolder === folderName ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                             }`}
                         >
                             <span>📁</span>
                             <span>{folderName}</span>
                             <span className="bg-black/30 text-[10px] px-1.5 py-0.5 rounded-full text-neutral-300 font-mono">
                                 {images.filter(img => img.folder === folderName).length}
                             </span>
                         </button>
                     ))}
                 </div>
            </div>
        )}

        {/* Bulk action toolbar block */}
        {selectedIds.length > 0 && onUpdateImages && (
            <div className="bg-neutral-900 border border-blue-500/30 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20 font-mono">
                        {selectedIds.length} SELECTED
                    </span>
                    <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-xs text-neutral-400 hover:text-white transition-colors underline font-medium"
                    >
                        {isAllSelected ? "Deselect All" : "Select All Shown"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-neutral-400 hover:text-white transition-colors underline font-medium ml-2"
                    >
                        Clear Selection
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {/* Bulk Agent assign dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveAssignOpen(!activeAssignOpen);
                                setActiveMoveOpen(false);
                                setActiveTagOpen(false);
                            }}
                            className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-3 py-2 rounded-lg text-xs font-bold text-neutral-200 transition-all flex items-center gap-1.5"
                        >
                            <span>👤 Assign to Agent</span>
                            <span className="text-[9px] text-neutral-500 font-mono">{activeAssignOpen ? '▲' : '▼'}</span>
                        </button>
                        {activeAssignOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-48 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-50 p-1 space-y-1">
                                <span className="block text-[9px] text-neutral-500 uppercase tracking-wider px-2 py-1 font-black">Choose Agent</span>
                                {agents.map(agent => (
                                    <button
                                        key={agent.id}
                                        type="button"
                                        onClick={() => {
                                            handleBulkAssignAgent(agent.id);
                                            setActiveAssignOpen(false);
                                        }}
                                        className="w-full text-left px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 rounded transition-all"
                                    >
                                        {agent.name}
                                    </button>
                                ))}
                                <div className="border-t border-neutral-800/80 my-1"></div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleBulkAssignAgent(null);
                                        setActiveAssignOpen(false);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs text-red-400 hover:bg-neutral-800 rounded transition-all"
                                >
                                    Unassign Agent
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bulk Tag addition dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTagOpen(!activeTagOpen);
                                setActiveMoveOpen(false);
                                setActiveAssignOpen(false);
                            }}
                            className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-3 py-2 rounded-lg text-xs font-bold text-neutral-200 transition-all flex items-center gap-1.5"
                        >
                            <span>🏷️ Tag Selected</span>
                            <span className="text-[9px] text-neutral-500 font-mono">{activeTagOpen ? '▲' : '▼'}</span>
                        </button>
                        {activeTagOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-50 p-3 space-y-2">
                                <span className="block text-[9px] text-neutral-500 uppercase tracking-wider font-black">Add Tags to Selected</span>
                                <input
                                    type="text"
                                    value={bulkTagInput}
                                    onChange={(e) => setBulkTagInput(e.target.value)}
                                    placeholder="Enter tags (comma separated)..."
                                    className="w-full bg-black border border-neutral-800 p-2 rounded text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleBulkTag(bulkTagInput);
                                            setActiveTagOpen(false);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleBulkTag(bulkTagInput);
                                        setActiveTagOpen(false);
                                    }}
                                    className="w-full py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-500 transition-all"
                                >
                                    Apply Tags
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Bulk Folder move dropdown */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveMoveOpen(!activeMoveOpen);
                                setActiveAssignOpen(false);
                                setActiveTagOpen(false);
                            }}
                            className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-3 py-2 rounded-lg text-xs font-bold text-neutral-200 transition-all flex items-center gap-1.5"
                        >
                            <span>📂 Move to Folder</span>
                            <span className="text-[9px] text-neutral-500 font-mono">{activeMoveOpen ? '▲' : '▼'}</span>
                        </button>
                        {activeMoveOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-50 p-3 space-y-2">
                                <span className="block text-[9px] text-neutral-500 uppercase tracking-wider font-black">Choose Folder</span>
                                <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleBulkMoveToFolder(null);
                                            setActiveMoveOpen(false);
                                        }}
                                        className="w-full text-left px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 rounded transition-all"
                                    >
                                        Remove from Folder (Unassigned)
                                    </button>
                                    {folderList.map(fol => (
                                        <button
                                            key={fol}
                                            type="button"
                                            onClick={() => {
                                                handleBulkMoveToFolder(fol);
                                                setActiveMoveOpen(false);
                                            }}
                                            className="w-full text-left px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800 rounded transition-all truncate"
                                        >
                                            {fol}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-neutral-800 pt-2 space-y-1.5">
                                    <span className="block text-[9px] text-neutral-500 uppercase tracking-wider font-black font-sans">Or Create New Folder</span>
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="New folder name..."
                                        className="w-full bg-black border border-neutral-800 p-1.5 rounded text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newFolderName.trim()) {
                                                handleBulkMoveToFolder(newFolderName.trim());
                                                setActiveMoveOpen(false);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (newFolderName.trim()) {
                                                handleBulkMoveToFolder(newFolderName.trim());
                                                setActiveMoveOpen(false);
                                            }
                                        }}
                                        className="w-full py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-500 transition-all"
                                    >
                                        Create & Move
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bulk Auto-Tag Selected using Gemini */}
                    <button
                        type="button"
                        onClick={handleAutoTagBulk}
                        disabled={taggingIds.length > 0}
                        className="bg-purple-950/20 hover:bg-purple-950/60 border border-purple-500/30 hover:border-purple-500/80 px-3 py-2 rounded-lg text-xs font-bold text-purple-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Analyze all selected images and videos using Gemini AI to auto-generate descriptive tags"
                    >
                        <span>🔮 AI Auto-Tag Selected</span>
                    </button>

                    {/* Bulk delete selected assets permanently */}
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm(`Are you sure you want to delete these ${selectedIds.length} assets permanently from your project vault?`)) {
                                const updated = images.filter(img => !selectedIds.includes(img.id));
                                onUpdateImages(updated);
                                setSelectedIds([]);
                            }
                        }}
                        className="bg-red-950/20 hover:bg-red-950 border border-red-500/20 hover:border-red-500 px-3 py-2 rounded-lg text-xs font-bold text-red-400 transition-all flex items-center gap-1.5"
                        title="Delete selected assets permanently"
                    >
                        <span>🗑️ Delete Selected</span>
                    </button>
                </div>
            </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="relative w-full sm:w-auto flex-grow max-w-lg flex items-center gap-3">
                 <div className="relative flex-grow">
                    <input
                        type="text"
                        value={agentFilter}
                        onChange={(e) => onAgentFilterChange(e.target.value)}
                        placeholder="Filter by agent or AI tag..."
                        className="w-full pl-8 py-2 px-3 bg-neutral-900 text-neutral-200 border border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                    />
                     <div className="absolute inset-y-0 left-0 flex items-center pl-2 text-neutral-500 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" /></svg>
                    </div>
                 </div>
                 {onUploadImage && (
                     <>
                         <input 
                             type="file" 
                             ref={fileInputRef} 
                             onChange={handleFileUpload} 
                             accept="image/*" 
                             className="hidden" 
                         />
                         <button
                             onClick={() => fileInputRef.current?.click()}
                             className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-all font-medium text-sm whitespace-nowrap shadow-sm"
                             title="Upload an image to Project Vault with Auto AI-Tagging"
                         >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                             </svg>
                             Upload Image
                         </button>
                     </>
                 )}
            </div>
            {showGridSelectors && (
                <div className="flex items-center justify-end gap-2 flex-wrap">
                    <span className="text-sm text-neutral-400 hidden md:inline">Composition Grids:</span>
                    {gridOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={() => onGridOverlayChange(option.id)}
                            className={`px-3 py-1 text-sm font-medium transition-colors duration-200 rounded-md ${
                                gridOverlay === option.id
                                    ? 'bg-neutral-700 text-white shadow-md'
                                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
        
        {showGridSelectors && gridOverlay !== 'none' && (
            <p className="text-xs text-neutral-300 h-4 text-right mb-2">{compositionHint[gridOverlay]}</p>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleImages.map((image, index) => {
                const isSelected = selectedIds.includes(image.id);
                return (
                    <div 
                        key={image.id} 
                        className={`relative bg-neutral-800 rounded-lg overflow-hidden group transition-all duration-300 hover:scale-105 shadow-lg cursor-pointer ring-2 ${
                            isSelected ? 'ring-blue-500' : 'ring-transparent hover:ring-blue-500/50'
                        }`}
                        onClick={() => handleCardClick(image)}
                    >
                        {/* Select Checkbox (Google Photos Style) */}
                        {onUpdateImages && (
                            <div 
                                onClick={(e) => toggleSelectItem(image.id, e)}
                                className={`absolute top-2.5 left-2.5 w-5 h-5 rounded-md flex items-center justify-center transition-all border border-neutral-500 z-30 ${
                                    isSelected 
                                        ? 'bg-blue-600 border-blue-500 opacity-100' 
                                        : 'bg-black/40 hover:bg-black/60 border-neutral-400 opacity-0 group-hover:opacity-100'
                                }`}
                            >
                                {isSelected && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        )}

                        {image.type === 'video' ? (
                            <div className="relative w-full h-full">
                                <video 
                                    src={image.url} 
                                    className="w-full h-full object-cover" 
                                    controls={false} // Hide controls in grid, show icon
                                    muted
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                    <VideoIcon className="w-12 h-12 text-white/80" />
                                </div>
                            </div>
                        ) : (
                            <img
                                src={`data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`}
                                alt={`Gallery asset ${index + 1}`}
                                className="w-full h-full object-cover transition-opacity duration-500"
                            />
                        )}

                        {image.isUpscaling && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
                                <LoadingSpinner />
                                <p className="mt-2 text-sm text-white">Preparing...</p>
                            </div>
                        )}
                        {gridOverlay !== 'none' && image.type === 'image' && (
                            <>
                                {gridOverlay === 'basic' && <BasicGridOverlay />}
                                {gridOverlay === 'triadic' && <TriadicGridOverlay />}
                                {gridOverlay === 'golden-basic' && <BasicGoldenRatioGridOverlay />}
                                {gridOverlay === 'golden-triadic' && <TriadicGoldenRatioGridOverlay />}
                            </>
                        )}

                        {/* Visual Lore Consistency Deviation / Verification Badge */}
                        {image.metadata?.loreConsistency && (
                            <div 
                                className={`absolute bottom-2.5 left-2.5 z-20 px-2 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 shadow-lg backdrop-blur-md border ${
                                    image.metadata.loreConsistency.status === 'deviated'
                                        ? 'bg-rose-950/90 text-rose-300 border-rose-500/80 animate-pulse'
                                        : 'bg-emerald-950/90 text-emerald-300 border-emerald-500/70'
                                }`}
                                title={image.metadata.loreConsistency.status === 'deviated' 
                                    ? `⚠️ Visual Lore Deviation Flagged: ${image.metadata.loreConsistency.deviations?.map((d: any) => `${d.entity}: ${d.promptConflict} (Expected: ${d.expectedLore})`).join('; ') || 'Conflicts with established lore'}` 
                                    : '✓ 100% Visual Lore Verified'}
                            >
                                <span>{image.metadata.loreConsistency.status === 'deviated' ? '⚠️' : '✓'}</span>
                                <span>{image.metadata.loreConsistency.status === 'deviated' ? 'Lore Deviation' : 'Lore Verified'}</span>
                            </div>
                        )}
                        
                        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" onClick={e => e.stopPropagation()}>
                          {image.type === 'image' && image.base64 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onEditImage(image.base64!); }}
                                className="p-2 bg-black/60 text-white hover:bg-neutral-600 transition-colors rounded-md"
                                aria-label="Edit image"
                                title="Edit Image (Inpaint)"
                              >
                                <EditIcon />
                              </button>
                          )}
                          
                          {(image.type === 'image' || image.type === 'video') && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onUpscaleImage(image.id); }}
                                className="p-2 bg-black/60 text-white hover:bg-neutral-600 transition-colors rounded-md"
                                aria-label="Upscale asset"
                                title={`Upscale ${image.type === 'image' ? 'Image' : 'Video'} (Enhance)`}
                              >
                                <UpscaleIcon />
                              </button>
                          )}

                          {image.type === 'image' && image.base64 && (
                              <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onAddToStoryboard(image.base64!); }}
                                    className="p-2 bg-black/60 text-white hover:bg-neutral-600 transition-colors rounded-md"
                                    aria-label="Add to storyboard"
                                    title="Add to Storyboard"
                                >
                                    <AddToStoryIcon />
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onAddToInspiration(image.base64!); }}
                                    className="p-2 bg-black/60 text-white hover:bg-neutral-600 transition-colors rounded-md"
                                    aria-label="Add to inspiration"
                                    title="Add to Inspiration"
                                >
                                    <PinIcon />
                                </button>
                              </>
                          )}
                          
                           <button 
                            onClick={(e) => { e.stopPropagation(); downloadAsset(image); }}
                            className="p-2 bg-black/60 text-white hover:bg-neutral-600 transition-colors rounded-md"
                            aria-label="Download asset"
                            title="Download"
                          >
                            <DownloadIcon />
                          </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleAutoTagSingle(image); }}
                             disabled={taggingIds.includes(image.id)}
                             className="p-2 bg-black/60 hover:bg-purple-900 text-white hover:text-purple-200 transition-colors rounded-md disabled:opacity-50 animate-fade-in"
                             aria-label="Auto Tag asset with Gemini"
                             title="AI Auto-Tag (Gemini)"
                           >
                             <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 8l-.75-2.75L13.75 4.5l2.75-.75L17.25 1l.75 2.75L20.75 4.5l-2.75.75z" />
                             </svg>
                           </button>
                           <AssignAgentControl
                             image={image}
                             agents={agents}
                             onAssignAgentToImage={onAssignAgentToImage}
                             onCreateAgent={onCreateAgent}
                           />
                        </div>
                        {image.agentId && (
                            <div className="absolute bottom-2 left-2 p-1 px-2 bg-black/60 text-white text-xs font-bold pointer-events-none rounded-md z-10">
                                {getAgentName(image.agentId)}
                            </div>
                        )}
                        {taggingIds.includes(image.id) ? (
                            <div className="absolute bottom-2 right-2 p-1 px-2 bg-purple-900/90 text-[10px] text-white font-black rounded-md uppercase tracking-widest animate-pulse border border-purple-500/30 z-10">
                                🔮 AI Tagging...
                            </div>
                        ) : image.tags && image.tags.length > 0 ? (
                            <div className="absolute bottom-2 right-2 flex flex-wrap gap-1 max-w-[65%] justify-end z-10 pointer-events-none">
                                {image.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="p-0.5 px-1.5 bg-indigo-600/80 text-[10px] text-white font-bold rounded-md uppercase tracking-wider backdrop-blur-xs shadow-xs">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {image.folder && (
                            <div className="absolute top-2 right-12 p-1 px-1.5 bg-neutral-900/90 text-[9px] font-black tracking-wider uppercase text-neutral-300 rounded-md border border-neutral-700/50 pointer-events-none z-10">
                                📁 {image.folder}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
        
        {visibleImages.length === 0 && (
             <div className="mt-8 flex flex-col items-center justify-center h-full text-center py-12">
                <h3 className="text-xl font-semibold text-neutral-400">No Assets Found</h3>
                <p className="mt-1 text-neutral-500">
                    {agentFilter 
                        ? `No assets matched search filter "${agentFilter}" in this view.` 
                        : "No assets have been stored inside this folder yet."}
                </p>
            </div>
        )}
    </div>
  );
};