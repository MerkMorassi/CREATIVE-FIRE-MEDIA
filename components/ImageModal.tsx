

import React, { useEffect, useState } from 'react';
import { ImageState, Agent } from '../types.ts';
import { AddToStoryIcon, DownloadIcon, EditIcon, PinIcon, CloseIcon } from './icons.tsx';

interface ImageModalProps {
  image: ImageState | null;
  onClose: () => void;
  onEdit: (base64: string) => void;
  onAddToStoryboard: (base64: string) => void;
  onAddToInspiration: (base64: string) => void;
  agents: Agent[];
  onAssignAgentToImage: (imageId: string, agentId: string | null) => void;
  onCreateAgent: (data: Partial<Agent>) => Agent;
}

const downloadImage = (base64Image: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${base64Image}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const AssignAgentDropdown: React.FC<{
  image: ImageState;
  agents: Agent[];
  onAssignAgentToImage: (imageId: string, agentId: string | null) => void;
  onCreateAgent: (data: Partial<Agent>) => Agent;
}> = ({ image, agents, onAssignAgentToImage, onCreateAgent }) => {
    
    const handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = e.target;
        if (value === 'create_new') {
            const name = prompt("Enter the new agent's name:");
            if (name && name.trim()) {
                const newAgent = onCreateAgent({ name });
                onAssignAgentToImage(image.id, newAgent.id);
            }
        } else {
            onAssignAgentToImage(image.id, value || null);
        }
    };
    
    return (
        <div className="flex-grow">
            <select
                value={image.agentId || ''}
                onChange={handleSelectionChange}
                className="w-full text-sm bg-neutral-800 border border-neutral-700 p-1.5 focus:ring-1 focus:ring-neutral-400 outline-none"
            >
                <option value="">- Unassigned -</option>
                <optgroup label="Agents">
                    {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Actions">
                    <option value="create_new">+ Create New Agent</option>
                </optgroup>
            </select>
        </div>
    );
};

export const ImageModal: React.FC<ImageModalProps> = ({ image, onClose, onEdit, onAddToStoryboard, onAddToInspiration, agents, onAssignAgentToImage, onCreateAgent }) => {
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  useEffect(() => {
    // Reset feedback when image changes
    if (image) {
        setFeedbackMessage('');
    }
  }, [image]);

  if (!image) {
    return null;
  }

  const showFeedback = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => setFeedbackMessage(''), 2500);
  };

  const handleEditAction = () => {
    if (!image || !image.base64) return;
    onEdit(image.base64);
  };
  
  const handleAddToStoryboardAction = () => {
      if (!image || !image.base64) return;
      onAddToStoryboard(image.base64);
      showFeedback('Added to Storyboard');
  };
  
  const handleAddToInspirationAction = () => {
      if (!image || !image.base64) return;
      onAddToInspiration(image.base64);
      showFeedback('Added to Inspiration');
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
      <div
        className="bg-neutral-900 shadow-2xl w-full max-w-4xl max-h-full flex flex-col border border-neutral-800 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-neutral-400 hover:text-white transition-colors z-20 bg-black/40 p-1.5"
          aria-label="Close image viewer"
        >
          <CloseIcon />
        </button>

        <div className="flex-grow p-4 flex items-center justify-center overflow-hidden">
            {image.base64 && <img
                src={`data:image/jpeg;base64,${image.base64}`}
                alt="Full size generated image"
                className="max-w-full max-h-[75vh] object-contain shadow-lg"
            />}
        </div>
        
        <div className="flex-shrink-0 bg-neutral-800/50 p-3 border-t border-neutral-800 flex items-center justify-between gap-4 flex-wrap relative">
            <div className="flex items-center gap-2 flex-wrap flex-grow min-w-[200px]">
                <label className="text-sm font-semibold text-neutral-400">Agent:</label>
                <AssignAgentDropdown
                    image={image}
                    agents={agents}
                    onAssignAgentToImage={onAssignAgentToImage}
                    onCreateAgent={onCreateAgent}
                />
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-4 flex-shrink-0">
                 <button
                    onClick={() => image.base64 && downloadImage(image.base64, `storyboard-image-${Date.now()}.jpeg`)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition"
                    disabled={!image.base64}
                >
                    <DownloadIcon />
                    <span className="hidden sm:inline">Download</span>
                </button>
                <button
                    onClick={handleEditAction}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition"
                    disabled={!image.base64}
                >
                    <EditIcon />
                    <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                    onClick={handleAddToStoryboardAction}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition"
                     disabled={!image.base64}
                >
                    <AddToStoryIcon />
                    <span className="hidden sm:inline">Add to Storyboard</span>
                </button>
                 <button
                    onClick={handleAddToInspirationAction}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition"
                     disabled={!image.base64}
                >
                    <PinIcon />
                    <span className="hidden sm:inline">Add to Inspiration</span>
                </button>
            </div>
            
            <div 
              className={`absolute bottom-full mb-2 bg-neutral-700 text-white text-sm font-bold px-4 py-2 shadow-lg transition-all duration-300 pointer-events-none ${feedbackMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
              role="status"
            >
                {feedbackMessage}
            </div>
        </div>
      </div>
    </div>
  );
};