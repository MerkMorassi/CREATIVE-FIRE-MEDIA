
import React, { useState } from 'react';
import { Agent, ActiveView, ScriptFile } from '../types.ts';
import { AgentChatView } from './AgentChatView.tsx';
import { StudioHeader } from './StudioHeader.tsx';
import { ScriptIcon, ChatIcon, LibraryIcon, DownloadIcon, CloseIcon } from './icons.tsx';
import { TrashIcon } from './icons/TrashIcon';
import { ScriptViewer } from './ScriptViewer.tsx';

interface ScriptingStudioProps {
    agent: Agent;
    onNavigate: (view: ActiveView) => void;
    onOpenChat: (mode: 'chat' | 'call') => void;
    scriptText: string;
    scriptsBin: ScriptFile[];
    onDeleteScript: (id: string) => void;
    onScriptUpload: (file: File) => void;
    defaultTab?: 'chat' | 'viewer' | 'bin';
}

export const ScriptingStudio: React.FC<ScriptingStudioProps> = ({ 
    agent, onNavigate, onOpenChat, scriptText, scriptsBin, onDeleteScript, onScriptUpload, defaultTab = 'chat' 
}) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'viewer' | 'bin'>(defaultTab);
    const [selectedScript, setSelectedScript] = useState<ScriptFile | null>(null);

    const handleDownload = (s: ScriptFile) => {
        const blob = new Blob([s.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${s.title.replace(/ /g, '_')}_Draft.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full w-full bg-primary">
            <div className="flex items-center px-6 pt-2 bg-neutral-900 border-b border-neutral-800 gap-1 z-10">
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'chat' ? 'border-emerald-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <ChatIcon className="w-4 h-4" /> Scribe Chat
                </button>
                <button
                    onClick={() => setActiveTab('viewer')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'viewer' ? 'border-emerald-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <ScriptIcon className="w-4 h-4" /> Script Viewer
                </button>
                <button
                    onClick={() => setActiveTab('bin')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'bin' ? 'border-emerald-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
                    }`}
                >
                    <LibraryIcon className="w-4 h-4" /> Scripts Bin
                </button>
            </div>

            <main className="flex-grow overflow-hidden flex flex-col relative">
                {activeTab === 'chat' && (
                    <div className="flex flex-col h-full">
                        <div className="p-6 pb-0 max-w-6xl mx-auto w-full">
                            <h1 className="text-2xl font-black text-white mb-4">Scribe's Workspace</h1>
                            <div className="bg-emerald-900/20 border border-emerald-500/20 p-4 rounded-xl mb-6 text-sm text-emerald-200">
                                <strong>Status:</strong> Ready for dictation or structural analysis.
                            </div>
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <AgentChatView agent={agent} />
                        </div>
                    </div>
                )}

                {activeTab === 'viewer' && (
                    <div className="flex-grow overflow-hidden h-full">
                        <ScriptViewer scriptText={scriptText} onUpload={onScriptUpload} />
                    </div>
                )}

                {activeTab === 'bin' && (
                    <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {scriptsBin.map(s => (
                                <div key={s.id} className="bg-secondary/40 border border-accent rounded-xl p-5 hover:border-emerald-500/50 transition-all group flex flex-col h-64">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="p-2 bg-neutral-900 rounded-lg text-emerald-400"><ScriptIcon className="w-6 h-6"/></div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleDownload(s)} className="p-2 hover:bg-accent rounded-lg text-neutral-400 hover:text-white" title="Download"><DownloadIcon className="w-4 h-4"/></button>
                                            <button onClick={() => onDeleteScript(s.id)} className="p-2 hover:bg-red-900/20 rounded-lg text-neutral-400 hover:text-red-400" title="Delete"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1 truncate">{s.title}</h3>
                                    <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-3">{s.date}</p>
                                    <div className="bg-black/40 rounded-lg p-3 text-[10px] font-mono text-neutral-400 flex-grow overflow-hidden leading-tight">
                                        {s.content.substring(0, 300)}...
                                    </div>
                                    <button 
                                        onClick={() => setSelectedScript(s)}
                                        className="mt-4 w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase tracking-wider rounded"
                                    >
                                        Inspect Draft
                                    </button>
                                </div>
                            ))}
                        </div>
                        {scriptsBin.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-40">
                                <LibraryIcon className="w-16 h-16 mb-4" />
                                <p className="text-lg font-bold">Scripts Bin Empty</p>
                                <p className="text-sm">Generate screenplay drafts in the Script Writer Studio.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {selectedScript && (
                <div className="fixed inset-0 bg-black/90 z-[100] p-10 flex flex-col animate-fade-in" onClick={() => setSelectedScript(null)}>
                    <div className="max-w-5xl mx-auto w-full h-full bg-neutral-900 border border-neutral-700 rounded-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/50">
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase">{selectedScript.title}</h2>
                                <p className="text-xs text-neutral-400">Warner Bros. Standard Formatting • {selectedScript.date}</p>
                            </div>
                            <button onClick={() => setSelectedScript(null)} className="p-2 hover:bg-neutral-700 rounded-full text-neutral-400">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-12 bg-white text-black font-mono text-sm leading-relaxed whitespace-pre">
                            {selectedScript.content}
                        </div>
                        <div className="p-6 border-t border-neutral-800 flex justify-end gap-3 bg-neutral-900">
                            <button onClick={() => handleDownload(selectedScript)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-2">
                                <DownloadIcon className="w-4 h-4" /> Download .txt
                            </button>
                            <button onClick={() => setSelectedScript(null)} className="px-6 py-2 bg-neutral-800 text-neutral-300 font-bold rounded-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};