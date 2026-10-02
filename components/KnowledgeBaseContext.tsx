
import React, { useState } from 'react';
import { DatabaseIcon } from './icons/DatabaseIcon';
import { WarningIcon } from './icons/WarningIcon';
import { CloseIcon } from './icons.tsx';

interface KnowledgeBaseContextProps {
  context: string;
  warning: string | null;
  url: string;
}

export const KnowledgeBaseContext: React.FC<KnowledgeBaseContextProps> = ({ context, warning, url }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Determine citation count roughly by checking for the headers we insert
  // Or just use a generic label if parsing is too specific to the implementation details
  // We'll just count list items if it's formatted that way, or default to "View Context"
  const citationCount = context.split('\n\n').length; 

  return (
    <div className="bg-secondary/30 border border-accent rounded-xl shadow-sm animate-fade-in mb-4">
      <div className="flex justify-between items-center w-full p-4">
        <div className="flex items-center gap-3">
          <DatabaseIcon className="w-5 h-5 text-brand-hover" />
          <div>
            <h3 className="font-semibold text-text-primary text-sm">Knowledge Base Active</h3>
            <p className="text-[10px] text-text-secondary truncate max-w-xs">{url}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
             {warning && (
                <div className="flex items-center gap-1 text-yellow-500 text-xs px-2 py-1 bg-yellow-900/20 rounded border border-yellow-500/30" title={warning}>
                    <WarningIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">Warning</span>
                </div>
            )}
            <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-bold bg-brand/20 text-brand-hover border border-brand/30 px-3 py-1.5 rounded-full hover:bg-brand/30 transition-colors flex items-center gap-1"
            >
                <span>View {citationCount > 1 ? `${citationCount} Sources` : 'Context'}</span>
            </button>
        </div>
      </div>

      {/* Modal for Citations */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setIsModalOpen(false)}>
            <div 
                className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-neutral-700 bg-neutral-800/50 rounded-t-xl">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <DatabaseIcon className="w-4 h-4 text-blue-400" />
                        Retrieved Context (Citations)
                    </h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-700 transition-colors">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto bg-primary/95 rounded-b-xl text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap font-mono">
                    {context}
                </div>
                
                {warning && (
                    <div className="p-4 bg-yellow-900/20 border-t border-yellow-500/30 text-yellow-200 text-xs flex items-start gap-2">
                        <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>{warning}</p>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
