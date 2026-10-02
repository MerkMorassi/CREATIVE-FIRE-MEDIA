
import React from 'react';
import { Agent, ActiveView } from '../types.ts';
import { AgentChatView } from './AgentChatView.tsx';
import { StudioHeader } from './StudioHeader.tsx';
import { AutomationIcon } from './icons.tsx';

interface CoreStudioProps {
    agent: Agent;
    onNavigate: (view: ActiveView) => void;
    onOpenChat: (mode: 'chat' | 'call') => void;
}

export const CoreStudio: React.FC<CoreStudioProps> = ({ agent, onNavigate, onOpenChat }) => {
    return (
        <div className="flex flex-col h-full w-full bg-primary">
            <main className="flex-grow overflow-hidden flex flex-col relative">
                {/* Office Header */}
                <div className="p-6 pb-0 max-w-6xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-900/20">
                            <AutomationIcon className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Production Control</h1>
                            <p className="text-indigo-300 font-medium">Orchestration & Logic Center</p>
                        </div>
                    </div>
                    
                    <div className="bg-indigo-900/20 border border-indigo-500/20 p-4 rounded-xl mb-6">
                        <p className="text-sm text-indigo-200">
                            <strong>Nexus Status:</strong> Ready to coordinate. Task me with breaking down scripts, assigning jobs to other agents, or validating production milestones.
                        </p>
                    </div>

                    <div className="h-px bg-neutral-800 w-full mb-2"></div>
                </div>

                {/* Main Workspace - Currently Chat Focused */}
                <div className="flex-grow overflow-hidden">
                    <AgentChatView agent={agent} />
                </div>
            </main>
        </div>
    );
};