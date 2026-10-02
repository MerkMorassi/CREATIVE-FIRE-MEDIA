import React, { useState } from 'react';
import { Agent } from '../types.ts';
import { AgentChatView } from './AgentChatView.tsx';

// Keep props same as original file for compatibility
interface AgentChatStudioProps {
    agents: Agent[];
    onUploadLore: (agentId: string, loreText: string) => void;
    onCallTool: (name: string, args: any) => Promise<{ textResult: string; resultData?: any; }>;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    onAddAssetToGrid: (asset: any) => void;
}

export const AgentChatStudio: React.FC<AgentChatStudioProps> = ({ agents, ...rest }) => {
    const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');

    const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

    return (
        <div className="flex h-full w-full bg-primary overflow-hidden">
            {/* Sidebar for agent selection */}
            <div className="w-72 flex-shrink-0 bg-secondary/50 p-6 border-r border-accent overflow-y-auto custom-scrollbar">
                <h2 className="text-xl font-black text-white uppercase tracking-tight mb-6">Agent Roster</h2>
                <div className="space-y-2">
                    {agents.map(agent => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgentId(agent.id)}
                            className={`w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all duration-200 group ${
                                selectedAgentId === agent.id 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' 
                                    : 'hover:bg-neutral-800 text-neutral-300'
                            }`}
                        >
                            <img 
                                src={agent.avatar || `https://ui-avatars.com/api/?name=${agent.name}&background=171717&color=e5e5e5`} 
                                alt={agent.name} 
                                className={`w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 ${selectedAgentId === agent.id ? 'border-blue-300' : 'border-neutral-700 group-hover:border-blue-500'}`}
                            />
                            <div className="overflow-hidden">
                                <p className="font-bold text-sm truncate">{agent.name}</p>
                                <p className={`text-xs truncate ${selectedAgentId === agent.id ? 'text-blue-200' : 'text-neutral-400'}`}>{agent.narrativeRole || 'Specialist'}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Chat View */}
            <div className="flex-grow flex flex-col min-w-0">
                {selectedAgent ? (
                    <AgentChatView agent={selectedAgent} />
                ) : (
                    <div className="flex items-center justify-center h-full text-neutral-500">
                        <p>Select an agent to start the conversation.</p>
                    </div>
                )}
            </div>
        </div>
    );
};