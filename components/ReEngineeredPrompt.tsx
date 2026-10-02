import React, { useState } from 'react';
import { WandIcon } from './icons/WandIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';

interface ReEngineeredPromptProps {
  prompt: string;
}

export const ReEngineeredPrompt: React.FC<ReEngineeredPromptProps> = ({ prompt }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Create a temporary element to parse the HTML string
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = prompt;

    // Find the H3 with the text "🎬 Positive Prompt"
    const positivePromptHeader = Array.from(tempDiv.querySelectorAll('h3')).find(
      (h3) => h3.textContent?.includes('🎬 Positive Prompt')
    );
    
    // Get the text from the next sibling element, which should be the <p> tag
    const positivePromptText = positivePromptHeader?.nextElementSibling?.textContent || '';

    navigator.clipboard.writeText(positivePromptText.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-brand-hover flex items-center gap-2">
            <WandIcon className="w-5 h-5" />
            <span>SDXL Optimized Prompt</span>
        </h3>
        <button
          onClick={handleCopy}
          className="p-2 rounded-xl hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-brand flex items-center gap-2 group"
          title="Copy positive prompt to clipboard"
        >
          <ClipboardIcon className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
          {copied && <span className="text-xs font-medium text-brand-hover animate-fade-in">Copied!</span>}
        </button>
      </div>
      <div 
        className="flex-grow overflow-y-auto bg-primary/50 p-4 rounded-lg prose prose-invert prose-sm max-w-none prose-headings:text-brand-hover prose-headings:font-semibold prose-headings:mb-2 prose-p:my-2 prose-ul:my-2"
        dangerouslySetInnerHTML={{ __html: prompt }}
      />
    </div>
  );
};

export const ReEngineeredPromptLoader: React.FC = () => (
    <div className="w-full bg-secondary/30 border border-accent rounded-xl p-6 shadow-sm flex items-center gap-4">
        <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full"></div>
        <div className="flex flex-col">
            <span className="font-semibold text-text-primary">Generating SDXL Prompt...</span>
            <span className="text-sm text-text-secondary">Please wait a moment.</span>
        </div>
    </div>
);