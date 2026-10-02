
import React, { useState, useEffect, useRef } from 'react';
import { HomeIcon, PhoneIcon, ChatIcon, ChevronRightIcon, SearchIcon, CloseIcon } from './icons.tsx';
import { Agent, Project, ActiveView, LoreEntry } from '../types.ts';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator.tsx';

interface StudioHeaderProps {
    breadcrumbs: { label: string; onClick?: () => void }[];
    agent?: Agent;
    onOpenChat?: (mode: 'chat' | 'call') => void;
    saveStatus?: SaveStatus;
    lastSavedTime?: Date | null;
    onRetrySave?: () => void;
    
    // Search props
    projects?: Project[];
    activeProjectId?: string;
    onSelectProject?: (id: string) => void;
    projectLore?: LoreEntry[];
    projectAgents?: Agent[];
    onNavigate?: (view: ActiveView, agentId?: string) => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({ 
    breadcrumbs, 
    agent, 
    onOpenChat,
    saveStatus = 'saved',
    lastSavedTime,
    onRetrySave,
    projects,
    activeProjectId,
    onSelectProject,
    projectLore,
    projectAgents,
    onNavigate
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const hasSearchProps = projects && onSelectProject && onNavigate;

    const getSearchResults = () => {
        if (!searchTerm.trim()) return { projects: [], lore: [], agents: [] };
        const query = searchTerm.toLowerCase();

        const matchedProjects = (projects || []).filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.tagline && p.tagline.toLowerCase().includes(query)) ||
            (p.brief && p.brief.toLowerCase().includes(query))
        );

        const matchedLore = (projectLore || []).filter(l => 
            l.title.toLowerCase().includes(query) || 
            l.content.toLowerCase().includes(query)
        );

        const matchedAgents = (projectAgents || []).filter(a => 
            a.name.toLowerCase().includes(query) || 
            (a.narrativeRole && a.narrativeRole.toLowerCase().includes(query)) ||
            (a.bio && a.bio.toLowerCase().includes(query))
        );

        return {
            projects: matchedProjects.slice(0, 5),
            lore: matchedLore.slice(0, 5),
            agents: matchedAgents.slice(0, 5)
        };
    };

    const results = getSearchResults();
    const hasResults = results.projects.length > 0 || results.lore.length > 0 || results.agents.length > 0;

    return (
        <div className="flex-shrink-0 bg-neutral-900 border-b border-neutral-800 px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30">
            {/* Left Section: Breadcrumbs + Auto-save indicator */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-400 font-medium">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-neutral-800 rounded-lg text-neutral-500">
                        <HomeIcon className="w-4 h-4" />
                    </div>
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            <ChevronRightIcon className="w-4 h-4 text-neutral-600" />
                            {crumb.onClick ? (
                                <button 
                                    onClick={crumb.onClick}
                                    className="hover:text-white transition-colors hover:underline decoration-neutral-600 underline-offset-4"
                                >
                                    {crumb.label}
                                </button>
                            ) : (
                                <span className="text-white font-bold">{crumb.label}</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="h-4 w-px bg-neutral-800 hidden sm:block"></div>

                {/* Auto-saving Status Indicator */}
                <AutoSaveIndicator 
                    status={saveStatus} 
                    lastSavedTime={lastSavedTime} 
                    onRetry={onRetrySave} 
                />
            </div>

            {/* Center Section: Global Search Bar */}
            {hasSearchProps && (
                <div ref={searchRef} className="relative w-full max-w-sm md:max-w-md mx-auto z-40">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-neutral-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search projects, lore entries, agents..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            className="block w-full pl-10 pr-10 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-medium"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white"
                            >
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown Overlay */}
                    {isFocused && searchTerm.trim() && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto z-50 custom-scrollbar">
                            {!hasResults ? (
                                <div className="p-4 text-center text-xs text-neutral-500 font-medium">
                                    No results match "{searchTerm}"
                                </div>
                            ) : (
                                <div className="p-2 space-y-4">
                                    {/* Projects Group */}
                                    {results.projects.length > 0 && (
                                        <div>
                                            <div className="px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Projects
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                {results.projects.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            onSelectProject(p.id);
                                                            onNavigate('dashboard');
                                                            setSearchTerm('');
                                                            setIsFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-black">
                                                            P
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                                                            {p.tagline && <p className="text-[10px] text-neutral-500 truncate">{p.tagline}</p>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Agents Group */}
                                    {results.agents.length > 0 && (
                                        <div>
                                            <div className="px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Agents
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                {results.agents.map((a) => (
                                                    <button
                                                        key={a.id}
                                                        onClick={() => {
                                                            onNavigate('agent-workspace', a.id);
                                                            setSearchTerm('');
                                                            setIsFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-3"
                                                    >
                                                        <img
                                                            src={a.avatar || `https://ui-avatars.com/api/?name=${a.name}&background=random`}
                                                            alt={a.name}
                                                            className="w-8 h-8 rounded-full border border-neutral-700 object-cover"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-white truncate">{a.name}</p>
                                                            {a.narrativeRole && <p className="text-[10px] text-neutral-500 truncate">{a.narrativeRole}</p>}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lore Group */}
                                    {results.lore.length > 0 && (
                                        <div>
                                            <div className="px-3 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                                                Lore Bible Entries
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                {results.lore.map((l) => (
                                                    <button
                                                        key={l.id}
                                                        onClick={() => {
                                                            if (l.projectId !== activeProjectId) {
                                                                onSelectProject(l.projectId);
                                                            }
                                                            onNavigate('lore');
                                                            setSearchTerm('');
                                                            setIsFocused(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                            </svg>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-white truncate">{l.title}</p>
                                                            <p className="text-[10px] text-neutral-500 truncate">{l.content}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Right Section: Agent Controls (if agent is present) */}
            {agent && onOpenChat && (
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-neutral-800/50 border border-neutral-700 rounded-full pl-1 pr-4 py-1">
                        <img 
                            src={agent.avatar || `https://ui-avatars.com/api/?name=${agent.name}&background=random`} 
                            alt={agent.name} 
                            className="w-8 h-8 rounded-full border border-neutral-600 object-cover" 
                        />
                        <div className="text-left">
                            <p className="text-[10px] text-neutral-500 font-bold uppercase leading-none">{agent.narrativeRole || 'Agent'}</p>
                            <p className="text-xs font-bold text-white leading-none">{agent.name}</p>
                        </div>
                    </div>

                    <button 
                        onClick={() => onOpenChat('chat')}
                        className="p-2.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors border border-neutral-700 group relative"
                        title="Chat with Agent"
                    >
                        <ChatIcon className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-neutral-900"></span>
                    </button>

                    <button 
                        onClick={() => onOpenChat('call')}
                        className="p-2.5 rounded-full bg-green-600 hover:bg-green-500 text-white transition-colors shadow-lg hover:shadow-green-500/20 active:scale-95"
                        title="Call Agent (Voice Mode)"
                    >
                        <PhoneIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
};