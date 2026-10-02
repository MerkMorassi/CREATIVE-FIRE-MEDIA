
import React from 'react';
import { Agent, ActiveView } from '../types.ts';
import { AgentChatView } from './AgentChatView.tsx';
import { StudioHeader } from './StudioHeader.tsx';

interface GenericAgentStudioProps {
    agent: Agent;
    onNavigate: (view: ActiveView) => void;
    onOpenChat: (mode: 'chat' | 'call') => void;
}

export const GenericAgentStudio: React.FC<GenericAgentStudioProps> = ({ agent, onNavigate, onOpenChat }) => {
    return (
        <div className="flex flex-col h-full w-full bg-primary">
            <main className="flex-grow overflow-hidden flex flex-col relative">
                {/* Agent "Home" Content */}
                <div className="flex-grow flex flex-col h-full">
                    {/* Simplified Header for context within the workspace */}
                    <div className="p-6 pb-0 max-w-5xl mx-auto w-full">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden shadow-lg">
                                {agent.avatar ? (
                                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-bold text-neutral-500">{agent.name.charAt(0)}</span>
                                )}
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">{agent.name}</h1>
                                <p className="text-neutral-400 font-medium">{agent.narrativeRole || 'Specialist Agent'}</p>
                            </div>
                        </div>
                        <div className="h-px bg-neutral-800 w-full mb-2"></div>
                    </div>

                    {/* Chat View is the main workspace for text-based agents */}
                    <div className="flex-grow overflow-hidden">
                        <AgentChatView agent={agent} />
                    </div>
                </div>
            </main>
        </div>
    );
};