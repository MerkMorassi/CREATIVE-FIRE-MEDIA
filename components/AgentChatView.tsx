
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Agent } from '../services/agentService';
import { GoogleGenAI, FunctionCall, Part } from '@google/genai';
import { ChatMessage } from './ChatMessage';
import { ChatInterface } from './ChatInterface';
import { vectorDb } from '../services/vectorDbService';
import { useLiveChat } from '../hooks/useLiveChat';
import { MicIcon, MicOffIcon, SpeakerIcon, SpeakerOffIcon, LoadingSpinner, DatabaseIcon, TrashIcon, CloseIcon } from './icons.tsx';
import { TELEPORTER } from '../utils/numMarkX';
import { getGeminiApiKey, getHfApiKey } from '../services/apiKeyService';
import { generateImageSDXL } from '../services/huggingFaceService';
import { blobToBase64 } from '../utils/imageUtils';
import { factoryService as lorepackService } from '../services/lorepack';
import { retrieveLivedExperience } from '../services/localRagService';
import { generateImageMCP } from '../services/gradioService';

interface AgentChatViewProps {
  agent: Agent;
  initialMode?: 'chat' | 'call';
  onClose?: () => void;
}

interface ChatMessagePart {
  text?: string;
  inlineData?: { mimeType: string; data: string; fileName?: string; };
  functionCall?: any;
  toolCode?: { code: string; };
  toolResult?: { result: any; };
}

export const AgentChatView: React.FC<AgentChatViewProps> = ({ agent, initialMode, onClose }) => {
  const [chatHistory, setChatHistory] = useState<{ id: string; role: 'user' | 'model'; parts: ChatMessagePart[] }[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [hasLorepack, setHasLorepack] = useState(false);
  
  const [isMicMuted, setIsMicMuted] = useState(initialMode !== 'call');
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(initialMode !== 'call');
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const handleTurnComplete = useCallback((turn: { user: string; model: string; toolCalls?: FunctionCall[]; toolResponses?: any[] }) => {
    setIsSending(false); // A turn is complete, so we are no longer "sending"
    
    // The user part was already added optimistically for text messages.
    // For voice, we might need to add it here, but for now we assume text is primary.
    // If the model responded, add its response to history.
    if (turn.model || (turn.toolCalls && turn.toolCalls.length > 0)) {
      const modelParts: ChatMessagePart[] = [];
      if (turn.model) {
        modelParts.push({ text: turn.model });
      }
      if (turn.toolCalls) {
        turn.toolCalls.forEach(tc => modelParts.push({ toolCode: { code: `Executing Tool: ${tc.name}(${JSON.stringify(tc.args, null, 2)})` } }));
      }
      if (turn.toolResponses) {
          turn.toolResponses.forEach(tr => modelParts.push({ toolResult: { result: tr.response.result } }));
      }

      setChatHistory(prev => [...prev, {
        id: `model-${Date.now()}`,
        role: 'model',
        parts: modelParts
      }]);
    }
  }, []);

  const handleToolCall = useCallback(async (toolCalls: FunctionCall[]): Promise<any[]> => {
      const toolResponses: any[] = [];
      for (const fc of toolCalls) {
          let result: any;
          try {
              if (fc.name === 'generateMythosImage') {
                  const blob = await generateImageSDXL({ prompt: fc.args.prompt, useSuperiorEngine: true }, getHfApiKey() || '');
                  const base64 = await blobToBase64(blob);
                  const resultPart = { inlineData: { mimeType: blob.type, data: base64 } };
                  setChatHistory(prev => [...prev, {
                      id: `model-tool-result-${Date.now()}`, role: 'model',
                      parts: [resultPart, { text: `Image generated via ${fc.name}.` }]
                  }]);
                  result = { result: "Image generated and displayed successfully." };
              } else if (fc.name === 'lorepack_search') {
                  const experience = await retrieveLivedExperience(agent.id, fc.args.query);
                  result = { result: experience ? experience.text : "No relevant experience found in LOREPACK." };
              }
              // TODO: Add other tool implementations here (Video, etc.)
              else {
                  result = { error: `Tool '${fc.name}' is not implemented.` };
              }
          } catch (e: any) {
              result = { error: e.message || "Tool execution failed." };
          }

          toolResponses.push({
              name: fc.name,
              response: { result }
          });
      }
      return toolResponses;
  }, [agent.id]);

  const { connectionState, liveTranscript, startLiveChat, stopLiveChat, sendTextMessage, sendFiles, sendToolResponse } = useLiveChat(agent, { 
      isMicMuted, 
      isSpeakerMuted, 
      onTurnComplete: handleTurnComplete,
      onToolCall: async (toolCalls) => {
          const responses = await handleToolCall(toolCalls);
          sendToolResponse(responses);
          return responses;
      }
  });

  useEffect(() => {
    startLiveChat();
    return () => { stopLiveChat(); };
  }, [agent.id, startLiveChat, stopLiveChat]);

  useEffect(() => {
      const syncState = async () => {
          const vectors = await vectorDb.getVectorsByAgent(agent.id);
          TELEPORTER.rebuildIndex(vectors.map(v => ({ id: v.id, text: v.text })));
          setHasLorepack(vectors.length > 0);
          const logs = await vectorDb.getAgentChat(agent.id);
          setChatHistory(logs);
      };
      syncState();
  }, [agent.id]);
  
  const saveHistory = useCallback((history: any[]) => {
      if (history.length > 0) {
        vectorDb.saveAgentChat(agent.id, history);
      }
  }, [agent.id]);
  
  useEffect(() => { saveHistory(chatHistory); }, [chatHistory, saveHistory]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chatHistory, isSending, liveTranscript]);
  
  const handleSendMessage = async (files?: File[], isToolCommand?: boolean) => {
    if ((!chatMessage.trim() && (!files || files.length === 0)) || isSending) return;
    
    setIsSending(true);
    const currentMessage = chatMessage;
    setChatMessage('');

    const partsForHistory: ChatMessagePart[] = [];
    if (currentMessage.trim()) partsForHistory.push({ text: currentMessage });
    if (files) {
        for (const file of files) {
            const base64 = await blobToBase64(file);
            partsForHistory.push({ inlineData: { mimeType: file.type, data: base64, fileName: file.name }});
        }
    }
    
    setChatHistory(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', parts: partsForHistory }]);
    
    if (currentMessage.trim()) sendTextMessage(currentMessage);
    if (files) sendFiles(files);
  };

  const handleSendToolCommand = (toolName: string, prompt: string) => {
    const commandMessage = `Use the ${toolName} tool with this prompt: "${prompt}"`;
    setChatMessage(commandMessage);
    setTimeout(() => {
        handleSendMessage([], true);
    }, 0);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in px-4 pb-4 md:px-6 md:pb-6 pt-2">
        <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-3">
                 <img 
                    src={agent.avatar || `https://ui-avatars.com/api/?name=${agent.name}&background=171717&color=e5e5e5`} 
                    alt={agent.name} 
                    className="w-10 h-10 rounded-full object-cover border-2 border-neutral-700"
                />
                <div>
                    <h2 className="text-lg font-bold text-text-primary">{agent.name}</h2>
                    {hasLorepack && (
                         <div className="px-2 py-0.5 bg-blue-900/30 border border-blue-500/30 rounded flex items-center gap-1 text-[9px] text-blue-300 font-black uppercase tracking-widest" title="LOREPACK Active">
                            <DatabaseIcon className="w-2 h-2" /> PERSPECTIVE SYNCED
                        </div>
                    )}
                </div>
            </div>
             <div className="flex items-center gap-3">
                <div className="text-[10px] uppercase font-black tracking-widest text-neutral-500">{connectionState}</div>
                <button onClick={() => setIsMicMuted(p => !p)} className={`p-2 rounded-xl border transition-colors ${isMicMuted ? 'bg-secondary border-accent text-text-secondary' : 'bg-red-600 border-red-400 text-white'}`}>
                    {isMicMuted ? <MicOffIcon className="w-5 h-5"/> : <MicIcon className="w-5 h-5"/>}
                </button>
                 <button onClick={() => setIsSpeakerMuted(p => !p)} className={`p-2 rounded-xl border transition-colors ${isSpeakerMuted ? 'bg-secondary border-accent text-text-secondary' : 'bg-blue-600 border-blue-400 text-white'}`}>
                    {isSpeakerMuted ? <SpeakerOffIcon className="w-5 h-5"/> : <SpeakerIcon className="w-5 h-5"/>}
                </button>
                 <button onClick={async () => { if (confirm(`Clear history for ${agent.name}?`)) { await vectorDb.deleteAgentChat(agent.id); setChatHistory([]); } }} className="p-2 bg-secondary border border-accent text-text-secondary hover:text-red-400 rounded-xl transition-colors"><TrashIcon className="w-5 h-5" /></button>
                 {onClose && <button onClick={onClose} className="p-2 bg-secondary border border-accent text-text-secondary hover:text-white rounded-xl transition-colors"><CloseIcon className="w-5 h-5" /></button>}
            </div>
        </div>

        <div className="flex-grow flex flex-col space-y-4 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
            {chatHistory.map((msg) => (
            <ChatMessage key={msg.id} message={msg} agent={agent} onPlayAudio={() => {}} onStopAudio={() => {}} onGenerateAudio={() => {}} />
            ))}
            {isSending && (
                <div className="flex justify-start">
                    <div className="flex items-center gap-4 bg-secondary/30 border border-accent rounded-xl p-4 shadow-sm w-full">
                        <LoadingSpinner className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-semibold text-text-secondary animate-pulse">
                            Consulting LOREPACK...
                        </span>
                    </div>
                </div>
            )}
            <div ref={chatEndRef} />
        </div>
        
        {!isMicMuted && (
            <div className="w-full min-h-[80px] bg-secondary/30 border border-accent rounded-xl p-4 my-2 text-left space-y-1 text-sm">
                <p><span className="font-bold text-neutral-500 uppercase text-[10px]">You:</span> <span className="text-neutral-300">{liveTranscript.user}</span></p>
                <div className="h-px bg-accent"></div>
                <p><span className="font-bold text-blue-400 uppercase text-[10px]">{agent.name}:</span> <span className="text-white">{liveTranscript.model}</span></p>
            </div>
        )}

        <div className="mt-4 shrink-0 z-20">
            <ChatInterface 
                history={chatHistory} 
                message={chatMessage} 
                onMessageChange={setChatMessage} 
                onSendMessage={handleSendMessage} 
                isLoading={isSending}
                onSendToolCommand={handleSendToolCommand}
            />
        </div>
    </div>
  );
};