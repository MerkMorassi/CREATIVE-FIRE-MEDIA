import React, { useRef, useState } from 'react';
import { SendIcon } from './icons/SendIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { FileIcon } from './icons/FileIcon';
import { ToolIcon, ImageIcon, ClapperboardIcon } from './icons';

interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface ChatInterfaceProps {
  history: { role: 'user' | 'model'; parts: ChatMessagePart[] }[];
  message: string;
  onMessageChange: (message: string) => void;
  onSendMessage: (files?: File[], isToolCommand?: boolean) => void;
  isLoading: boolean;
  onSendToolCommand: (toolName: string, prompt: string) => void;
}

const ToolModal: React.FC<{
    tool: 'generateMythosImage' | 'generateMythosVideo' | 'image_studio_mcp';
    onClose: () => void;
    onSubmit: (toolName: string, prompt: string) => void;
}> = ({ tool, onClose, onSubmit }) => {
    const [prompt, setPrompt] = useState('');
    const title = 
        tool === 'generateMythosImage' ? 'Generate Image (MythOS)' : 
        tool === 'generateMythosVideo' ? 'Generate Video (Veo)' : 
        'Image Studio (MCP)';
    const Icon = 
        tool === 'generateMythosImage' ? ImageIcon : 
        tool === 'generateMythosVideo' ? ClapperboardIcon : 
        ImageIcon;


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(prompt.trim()) {
            onSubmit(tool, prompt);
        }
    };

    return (
        <div className="absolute bottom-full mb-2 w-full max-w-lg left-1/2 -translate-x-1/2" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="bg-neutral-800 border border-accent rounded-xl shadow-2xl p-4 space-y-3 animate-fade-in-up">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Icon className="w-4 h-4 text-brand" />
                        {title} Command
                    </h4>
                    <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white">&times;</button>
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter a detailed cinematic prompt..."
                    className="w-full h-24 bg-primary border border-accent rounded-lg p-2 text-sm text-white focus:ring-1 focus:ring-brand outline-none resize-none"
                    autoFocus
                />
                <button type="submit" className="w-full bg-brand hover:bg-brand-hover text-white text-sm font-bold py-2 rounded-lg transition-colors disabled:opacity-50" disabled={!prompt.trim()}>
                    Instruct Agent
                </button>
            </form>
        </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  message,
  onMessageChange,
  onSendMessage,
  isLoading,
  onSendToolCommand,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<'generateMythosImage' | 'generateMythosVideo' | 'image_studio_mcp' | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleSendClick = () => {
    if ((!message.trim() && selectedFiles.length === 0) || isLoading) return;
    onSendMessage(selectedFiles);
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToolSubmit = (toolName: string, prompt: string) => {
    onSendToolCommand(toolName, prompt);
    setActiveTool(null);
  };

  return (
    <div className="w-full bg-secondary/80 backdrop-blur-md border border-accent rounded-xl p-3 shadow-2xl relative">
       <style>{`.animate-fade-in-up { animation: fadeInUp 0.2s ease-out; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      {activeTool && (
        <ToolModal tool={activeTool} onClose={() => setActiveTool(null)} onSubmit={handleToolSubmit} />
      )}

      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 px-1 border-b border-accent mb-3">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group flex-shrink-0">
              <div className="w-20 h-20 rounded-lg bg-primary border border-accent flex items-center justify-center overflow-hidden">
                {file.type.startsWith('image/') ? (
                  <img 
                    src={URL.createObjectURL(file)} 
                    alt="preview" 
                    className="w-full h-full object-cover" 
                    onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                  />
                ) : (
                   <div className="p-2 text-center flex flex-col items-center justify-center">
                        <FileIcon className="w-8 h-8 mx-auto text-text-secondary"/>
                        <span className="text-[10px] text-text-secondary break-all mt-1 truncate w-16">{file.name}</span>
                   </div>
                )}
              </div>
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,video/*,application/pdf,text/plain,.doc,.docx,.md,.csv"/>
        
        <div className="relative">
            <button
                onClick={() => setToolMenuOpen(!toolMenuOpen)}
                disabled={isLoading}
                className="p-3 bg-primary border border-accent text-text-secondary rounded-xl hover:text-text-primary hover:border-brand transition-colors"
                title="Use a tool"
            >
                <ToolIcon className="w-5 h-5" />
            </button>
            {toolMenuOpen && (
                <div className="absolute bottom-full mb-2 w-56 bg-neutral-800 border border-accent rounded-lg shadow-2xl overflow-hidden animate-fade-in-up" onMouseLeave={() => setToolMenuOpen(false)}>
                    <button onClick={() => { setActiveTool('generateMythosImage'); setToolMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Generate Image (MythOS)</button>
                    <button onClick={() => { setActiveTool('image_studio_mcp'); setToolMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Image Studio (MCP)</button>
                    <button onClick={() => { setActiveTool('generateMythosVideo'); setToolMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2"><ClapperboardIcon className="w-4 h-4"/> Generate Video (Veo)</button>
                </div>
            )}
        </div>

        <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-3 bg-primary border border-accent text-text-secondary rounded-xl hover:text-text-primary hover:border-brand transition-colors"
            title="Attach files"
        >
            <PaperclipIcon className="w-5 h-5" />
        </button>

        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          className="w-full p-3 bg-primary border border-accent rounded-xl focus:ring-2 focus:ring-brand focus:outline-none transition duration-200 resize-none placeholder-text-secondary/70 shadow-sm"
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSendClick}
          disabled={isLoading || (!message.trim() && selectedFiles.length === 0)}
          className="p-3 bg-brand text-text-primary rounded-xl hover:bg-brand-hover disabled:bg-accent disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
          aria-label="Send message"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
