
import React from 'react';
import { Agent, ActiveView } from '../types.ts';
import { AgentChatView } from './AgentChatView.tsx';
import { StudioHeader } from './StudioHeader.tsx';
import { PencilIcon } from './icons/PencilIcon.tsx';

interface DesignStudioProps {
    agent: Agent;
    onNavigate: (view: ActiveView) => void;
    onOpenChat: (mode: 'chat' | 'call') => void;
}

export const DesignStudio: React.FC<DesignStudioProps> = ({ agent, onNavigate, onOpenChat }) => {
    return (
        <div className="flex flex-col h-full w-full bg-primary">
            <main className="flex-grow overflow-hidden flex flex-col relative">
                <div className="p-6 pb-0 max-w-6xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-900 to-rose-900 border border-pink-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-pink-900/20">
                            <PencilIcon className="w-8 h-8 text-pink-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Design Studio</h1>
                            <p className="text-pink-300 font-medium">Visual Development & Style Guides</p>
                        </div>
                    </div>
                    
                    <div className="bg-pink-900/20 border border-pink-500/20 p-4 rounded-xl mb-6">
                        <p className="text-sm text-pink-200">
                            <strong>Stylus Status:</strong> Palette ready. Describe a character or setting, and I will define its visual language.
                        </p>
                    </div>

                    <div className="h-px bg-neutral-800 w-full mb-2"></div>
                </div>

                <div className="flex-grow overflow-hidden">
                    <AgentChatView agent={agent} />
                </div>
            </main>
        </div>
    );
};