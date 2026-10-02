
import React from 'react';
import { Agent, ActiveView } from '../types.ts';
import { AgentChatView } from './AgentChatView.tsx';
import { StudioHeader } from './StudioHeader.tsx';
import { ImageIcon } from './icons.tsx';

interface ArtStudioProps {
    agent: Agent;
    onNavigate: (view: ActiveView) => void;
    onOpenChat: (mode: 'chat' | 'call') => void;
}

export const ArtStudio: React.FC<ArtStudioProps> = ({ agent, onNavigate, onOpenChat }) => {
    return (
        <div className="flex-col h-full w-full bg-primary flex">
            <main className="flex-grow overflow-hidden flex flex-col relative">
                <div className="p-6 pb-0 max-w-6xl mx-auto w-full">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-cyan-900 border border-blue-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-blue-900/20">
                            <ImageIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">The Atelier</h1>
                            <p className="text-blue-300 font-medium">Illustration & Composition</p>
                        </div>
                    </div>
                    
                    <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl mb-6">
                        <p className="text-sm text-blue-200">
                            <strong>Canvas Status:</strong> Easel set. Provide a scene description, and I will visualize the composition and lighting.
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