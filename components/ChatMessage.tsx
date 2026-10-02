import React, { useState } from 'react';
import { UserIcon } from './icons/UserIcon';
import { Agent } from '../services/agentService';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { SpeakerOffIcon } from './icons/SpeakerOffIcon';
import { WarningIcon } from './icons/WarningIcon';
import { FileIcon } from './icons/FileIcon';
import { PencilIcon } from './icons/PencilIcon';
import { simpleMarkdownToHtml } from '../utils/textFormatting';

interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
    fileName?: string;
  };
  toolCode?: { code: string; };
  toolResult?: { result: any; }; // Added to display tool output
}

interface AudioState {
    isGenerating?: boolean;
    isPlaying?: boolean;
    buffer?: AudioBuffer | null;
    error?: string | null;
}

interface ChatMessageProps {
  message: { id: string; role: 'user' | 'model'; parts: ChatMessagePart[] };
  agent: Agent | null;
  audioState?: AudioState;
  onPlayAudio: () => void;
  onStopAudio: () => void;
  onGenerateAudio: (text: string) => void;
  onUpdateMessage?: (messageId: string, newText: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, agent, audioState, onPlayAudio, onStopAudio, onGenerateAudio, onUpdateMessage }) => {
  const { role, parts } = message;
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(parts.map(p => p.text || '').join(' '));

  const name = isUser ? "You" : agent?.name || "Model";
  const avatar = isUser ? null : agent?.avatar;
  const fullText = parts.map(p => p.text || '').join(' ');
  const isSystemNotification = fullText.startsWith('[System Notification:');
  
  const hasAudio = !!audioState?.buffer;
  const isSpeaking = !!audioState?.isPlaying;
  const isAudioGenerating = !!audioState?.isGenerating;
  const audioError = audioState?.error;


  const handleCopy = () => {
    // Copy plain text
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveEdit = () => {
      if (onUpdateMessage && editText.trim() !== fullText) {
          onUpdateMessage(message.id, editText);
      }
      setIsEditing(false);
  };

  return (
    <div className={`border rounded-xl p-6 shadow-sm w-full animate-fade-in ${isEditing ? 'ring-2 ring-brand' : ''} ${isSystemNotification ? 'bg-amber-900/30 border-amber-500/40' : 'bg-secondary/30 border-accent'}`}>
      <div className="flex justify-between items-start mb-4">
        {isSystemNotification ? (
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <WarningIcon className="w-5 h-5 text-amber-400"/>
                </div>
                <h3 className="font-semibold text-amber-300">System Notification</h3>
            </div>
        ) : (
            <div className="flex items-center gap-3">
                {isUser ? (
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-text-secondary"/>
                </div>
                ) : (
                avatar ? (
                    <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover bg-accent flex-shrink-0" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-text-secondary"/>
                    </div>
                )
                )}
                <h3 className="font-semibold text-text-primary">{name}</h3>
            </div>
        )}
        
        <div className="flex items-center gap-1">
             {isUser && !isEditing && onUpdateMessage && (
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-xl hover:bg-accent transition-colors flex items-center gap-1 group"
                    title="Edit message"
                >
                    <PencilIcon className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
                </button>
             )}
             <button
                onClick={handleCopy}
                className="p-2 rounded-xl hover:bg-accent transition-colors flex items-center gap-1 group"
                title="Copy plain text"
            >
                <ClipboardIcon className="w-4 h-4 text-text-secondary group-hover:text-text-primary" />
                {copied && <span className="text-xs font-medium text-brand-hover animate-fade-in">Copied!</span>}
            </button>
            
            {!isUser && !isSystemNotification && (
                <>
                    <div className="h-4 w-px bg-accent mx-1"></div>
                    {hasAudio ? (
                        <button
                            onClick={isSpeaking ? onStopAudio : onPlayAudio}
                            className="p-2 rounded-xl hover:bg-accent transition-colors"
                            aria-label={isSpeaking ? 'Stop speech' : 'Read aloud'}
                        >
                            {isSpeaking ? 
                                <SpeakerOffIcon className="w-4 h-4 text-brand-hover" /> : 
                                <SpeakerIcon className="w-4 h-4 text-text-primary" />
                            }
                        </button>
                    ) : (
                        <button
                            onClick={() => onGenerateAudio(fullText)}
                            disabled={isAudioGenerating}
                            className="p-2 rounded-xl hover:bg-accent transition-colors disabled:opacity-50"
                            aria-label="Generate audio"
                        >
                            {isAudioGenerating ? (
                                <div className="animate-spin h-4 w-4 border-2 border-brand border-t-transparent rounded-full"></div>
                            ) : (
                                <SpeakerIcon className="w-4 h-4 text-text-secondary" />
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
      </div>

       {audioError && (
          <div className="mb-4 p-2 bg-orange-900/20 border border-orange-500/30 rounded-lg flex items-start gap-2 text-orange-200 text-xs">
              <WarningIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{audioError}</p>
          </div>
      )}
      
      {isEditing ? (
          <div className="flex flex-col gap-3">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-black/30 border border-accent rounded-lg p-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand min-h-[100px] resize-y"
              />
              <div className="flex gap-2 justify-end">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 rounded text-neutral-200">Cancel</button>
                  <button onClick={handleSaveEdit} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white font-bold">Save Changes</button>
              </div>
          </div>
      ) : (
          <div className="prose prose-invert prose-base max-w-none flex-grow leading-loose space-y-4 prose-p:my-4">
            {parts.map((part, partIndex) => (
              <div key={partIndex}>
                 {part.toolCode && (
                    <div className="bg-black/40 border border-accent/50 rounded-lg p-3 my-2">
                        <p className="font-mono text-xs text-blue-300 whitespace-pre-wrap">{part.toolCode.code}</p>
                    </div>
                 )}
                 {part.toolResult && (
                    <div className="bg-black/40 border border-accent/50 rounded-lg p-3 my-2">
                        <pre className="font-mono text-xs text-green-300 whitespace-pre-wrap">[TOOL RESULT]: {JSON.stringify(part.toolResult.result, null, 2)}</pre>
                    </div>
                 )}
                 {part.inlineData && (
                    <div className="mb-2">
                        {part.inlineData.mimeType.startsWith('image/') ? (
                        <img
                            src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                            alt={part.inlineData.fileName || 'Uploaded image'}
                            className="max-w-md rounded-lg max-h-96 object-contain border border-accent"
                        />
                        ) : part.inlineData.mimeType.startsWith('video/') ? (
                        <video
                            src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                            controls
                            className="max-w-md rounded-lg max-h-96 border border-accent bg-black"
                        />
                        ) : (
                        <div className="bg-primary/50 p-3 rounded-lg border border-accent/50 text-sm flex items-center gap-3 max-w-sm">
                            <FileIcon className="w-6 h-6 text-text-secondary flex-shrink-0" />
                            <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-text-primary truncate">{part.inlineData.fileName || 'Attached File'}</span>
                            <span className="text-xs text-text-secondary">{part.inlineData.mimeType}</span>
                            </div>
                        </div>
                        )}
                    </div>
                )}
                {part.text && (
                  isSystemNotification ? (
                    <p className="text-amber-200 font-medium">{part.text.replace('[System Notification: ', '').replace(']', '')}</p>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(part.text) }} />
                  )
                )}
              </div>
            ))}
          </div>
      )}
    </div>
  );
};
