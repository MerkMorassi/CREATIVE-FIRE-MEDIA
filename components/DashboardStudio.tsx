
import React, { useState, useEffect } from 'react';
import { ActiveView, Project, ImageState, AudioSentimentAnalysis } from '../types.ts';
import { StoryboardIcon, CharacterIcon, LoreIcon, PinIcon, ShuffleIcon, GridIcon, LibraryIcon, DashboardIcon, EditIcon, CheckIcon, ScriptIcon, ImageIcon } from './icons.tsx';
import { AudioThemesBubbleChart } from './AudioThemesBubbleChart.tsx';
import { analyzeAudioSentimentAndThemesService } from '../services/geminiService.ts';

interface DashboardStudioProps {
    project: Project;
    onUpdateProject: (updates: Partial<Project>) => void;
    images: ImageState[];
    stats: {
        storyboardFrames: number;
        agents: number;
        loreEntries: number;
        inspirationImages: number;
        dynamicPromptLists: number;
        promptTemplates: number;
        imagesGenerated: number;
        totalProjects: number;
        scriptsCount: number;
    };
    onNavigate: (view: ActiveView) => void;
}

const colorClasses = {
    purple: { border: 'hover:border-purple-500/50', text: 'text-purple-400 group-hover:text-purple-300' },
    sky: { border: 'hover:border-sky-500/50', text: 'text-sky-400 group-hover:text-sky-300' },
    amber: { border: 'hover:border-amber-500/50', text: 'text-amber-400 group-hover:text-amber-300' },
    pink: { border: 'hover:border-pink-500/50', text: 'text-pink-400 group-hover:text-pink-300' },
    green: { border: 'hover:border-green-500/50', text: 'text-green-400 group-hover:text-green-300' },
    teal: { border: 'hover:border-teal-500/50', text: 'text-teal-400 group-hover:text-teal-300' },
    red: { border: 'hover:border-red-500/50', text: 'text-red-400 group-hover:text-red-300' },
    blue: { border: 'hover:border-blue-500/50', text: 'text-blue-400 group-hover:text-blue-300' },
    emerald: { border: 'hover:border-emerald-500/50', text: 'text-emerald-400 group-hover:text-emerald-300' },
};

const StatCard: React.FC<{
    title: string;
    value: number;
    icon: React.ReactNode;
    onClick: () => void;
    color: keyof typeof colorClasses;
}> = ({ title, value, icon, onClick, color }) => (
    <div
        onClick={onClick}
        className={`bg-neutral-800/40 p-5 border border-neutral-800 hover:bg-neutral-800/80 ${colorClasses[color].border} transition-all duration-300 cursor-pointer group rounded-xl shadow-inner`}
    >
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">{title}</h3>
            <div className={`${colorClasses[color].text} transition-all transform group-hover:scale-110 duration-500 opacity-70 group-hover:opacity-100`}>{icon}</div>
        </div>
        <p className="text-4xl font-black text-white">{value}</p>
    </div>
);

export const DashboardStudio: React.FC<DashboardStudioProps> = ({ project, onUpdateProject, images, stats, onNavigate }) => {
    const [isEditingBrief, setIsEditingBrief] = useState(false);
    const [brief, setBrief] = useState(project.brief || '');
    const [progress, setProgress] = useState(project.progress || 0);
    const [dashboardTab, setDashboardTab] = useState<'metrics' | 'timeline' | 'audio-themes'>('metrics');

    // Audio Sentiment & Plot Themes State
    const [audioAnalysis, setAudioAnalysis] = useState<AudioSentimentAnalysis | null>(null);
    const [isLoadingAudioAnalysis, setIsLoadingAudioAnalysis] = useState<boolean>(false);

    const fetchAudioAnalysis = async () => {
        setIsLoadingAudioAnalysis(true);
        try {
            const data = await analyzeAudioSentimentAndThemesService(
                project.data.transcripts || [],
                project.name || "Cinematic Universe"
            );
            if (data && data.plotThemes) {
                setAudioAnalysis(data);
                try {
                    localStorage.setItem(`mythos_audio_analysis_${project.id}`, JSON.stringify(data));
                } catch (e) {}
            }
        } catch (err) {
            console.error("Audio sentiment analysis failed:", err);
        } finally {
            setIsLoadingAudioAnalysis(false);
        }
    };

    useEffect(() => {
        try {
            const cached = localStorage.getItem(`mythos_audio_analysis_${project.id}`);
            if (cached) {
                setAudioAnalysis(JSON.parse(cached));
            } else {
                fetchAudioAnalysis();
            }
        } catch (e) {
            fetchAudioAnalysis();
        }
    }, [project.id]);

    // Custom milestone form states
    const [showAddMilestone, setShowAddMilestone] = useState(false);
    const [mTitle, setMTitle] = useState('');
    const [mDate, setMDate] = useState('');
    const [mDesc, setMDesc] = useState('');
    const [mStatus, setMStatus] = useState<'pending' | 'in_progress' | 'completed' | 'critical'>('pending');
    const [mColor, setMColor] = useState<'purple' | 'emerald' | 'amber' | 'sky' | 'rose'>('purple');

    const handleSaveBrief = () => {
        onUpdateProject({ brief });
        setIsEditingBrief(false);
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value);
        setProgress(val);
        onUpdateProject({ progress: val });
    };

    const handleAddMilestoneSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!mTitle.trim()) return;

        const newMilestone = {
            id: `milestone_${Date.now()}`,
            title: mTitle,
            date: mDate ? new Date(mDate).toLocaleDateString() : new Date().toLocaleDateString(),
            description: mDesc,
            status: mStatus,
            color: mColor,
            timestamp: mDate ? new Date(mDate).getTime() : Date.now()
        };

        const nextMilestones = [...(project.data.customMilestones || []), newMilestone];
        onUpdateProject({
            data: {
                ...project.data,
                customMilestones: nextMilestones
            }
        });

        // Reset inputs
        setMTitle('');
        setMDate('');
        setMDesc('');
        setMStatus('pending');
        setMColor('purple');
        setShowAddMilestone(false);
    };

    const handleDeleteMilestone = (milestoneId: string) => {
        const nextMilestones = (project.data.customMilestones || []).filter(m => m.id !== milestoneId);
        onUpdateProject({
            data: {
                ...project.data,
                customMilestones: nextMilestones
            }
        });
    };

    const galleryImages = images.slice(0, 8);

    // Compile chronological timeline events from project content dynamically
    const getTimelineEvents = () => {
        const events: Array<{
            id: string;
            date: string;
            title: string;
            description: string;
            type: 'inception' | 'lore' | 'script' | 'image' | 'voice' | 'character';
            timestamp: number;
        }> = [];

        // 1. Initial Project Inception
        events.push({
            id: 'init_inception',
            date: project.createdAt ? new Date(project.createdAt).toLocaleDateString() : new Date(Date.now() - 86400000 * 10).toLocaleDateString(),
            title: 'Project Inception & Matrix Lock',
            description: `Established "${project.name}" universe baseline matrix and briefcase configurations.`,
            type: 'inception',
            timestamp: project.createdAt ? new Date(project.createdAt).getTime() : (Date.now() - 86400000 * 10)
        });

        // 2. Lore pack entries
        if (project.data.lore && project.data.lore.length > 0) {
            project.data.lore.forEach((l, index) => {
                const itemTime = (project.createdAt ? new Date(project.createdAt).getTime() : Date.now()) + 3600000 * 4 * (index + 1);
                events.push({
                    id: l.id,
                    date: new Date(itemTime).toLocaleDateString(),
                    title: `Lore Pack: ${l.title}`,
                    description: l.content.substring(0, 110) + (l.content.length > 110 ? '...' : ''),
                    type: 'lore',
                    timestamp: itemTime
                });
            });
        }

        // 3. Characters
        if (project.data.characters && project.data.characters.length > 0) {
            project.data.characters.forEach((c, index) => {
                const itemTime = (project.createdAt ? new Date(project.createdAt).getTime() : Date.now()) + 3600000 * 8 * (index + 1);
                events.push({
                    id: c.id,
                    date: new Date(itemTime).toLocaleDateString(),
                    title: `Character Casting: ${c.name}`,
                    description: `Cast archetype "${c.archetype}" with core details and profile description.`,
                    type: 'character',
                    timestamp: itemTime
                });
            });
        }

        // 4. Draft scripts
        if (project.data.scriptsBin && project.data.scriptsBin.length > 0) {
            project.data.scriptsBin.forEach((s, index) => {
                const itemTime = (project.createdAt ? new Date(project.createdAt).getTime() : Date.now()) + 3600000 * 16 * (index + 1);
                events.push({
                    id: s.id,
                    date: s.date || new Date(itemTime).toLocaleDateString(),
                    title: `Screenplay Draft: ${s.title}`,
                    description: `Composed script draft of type ${s.type} for production routing.`,
                    type: 'script',
                    timestamp: itemTime
                });
            });
        }

        // 5. Visual canvas generations
        if (project.data.images && project.data.images.length > 0) {
            project.data.images.slice(0, 5).forEach((img, index) => {
                const itemTime = (project.createdAt ? new Date(project.createdAt).getTime() : Date.now()) + 3600000 * 24 * (index + 1);
                events.push({
                    id: img.id,
                    date: new Date(itemTime).toLocaleDateString(),
                    title: `Visual Canvas Synthesis`,
                    description: `Generated high-resolution ${img.type} assets in project canvas.`,
                    type: 'image',
                    timestamp: itemTime
                });
            });
        }

        // 6. Custom Milestones
        if (project.data.customMilestones && project.data.customMilestones.length > 0) {
            project.data.customMilestones.forEach(m => {
                events.push({
                    id: m.id,
                    date: m.date,
                    title: m.title,
                    description: m.description,
                    type: 'milestone' as any,
                    timestamp: m.timestamp,
                    color: m.color,
                    status: m.status
                } as any);
            });
        }

        // Sort events chronologically (earliest first)
        return events.sort((a, b) => a.timestamp - b.timestamp);
    };

    const timelineEvents = getTimelineEvents();

    return (
        <div className="p-8 max-w-7xl mx-auto w-full animate-fade-in h-full overflow-y-auto space-y-10 custom-scrollbar">
             <style>{`.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1); } @keyframes fadeIn { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
            
            {/* Project Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <span className="text-[10px] font-black text-brand uppercase tracking-[0.4em] mb-2 block">Project Matrix</span>
                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">{project.name}</h1>
                    <p className="text-neutral-500 text-lg mt-2 font-medium">{project.tagline || 'A new creative endeavor in development.'}</p>
                </div>
                <div className="bg-neutral-800/50 px-5 py-2.5 rounded-full border border-neutral-700 flex items-center gap-3 shadow-xl backdrop-blur-md">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Status</span>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
                        <span className="text-xs font-black text-white uppercase tracking-tighter">Live Production</span>
                    </div>
                </div>
            </div>

            {/* Progress Section */}
            <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl space-y-6 relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand/50"></div>
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.3em]">Production Lifecycle</h3>
                        <p className="text-xs text-neutral-400 mt-1">Completion tracking for current production milestones.</p>
                    </div>
                    <span className="text-4xl font-black text-brand italic tracking-tighter">{progress}%</span>
                </div>
                <div className="relative w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-white/5">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <input 
                    type="range" 
                    min="0" max="100" 
                    value={progress} 
                    onChange={handleProgressChange} 
                    className="w-full h-1 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-neutral-900 hover:[&::-webkit-slider-thumb]:scale-125 transition-all opacity-0 hover:opacity-100 absolute bottom-0 left-0"
                    title="Adjust Progress"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Project Brief Column */}
                <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 flex flex-col min-h-[450px] shadow-2xl">
                    <div className="flex justify-between items-center mb-6 border-b border-neutral-800 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-brand">
                                <LibraryIcon className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Mission Brief</h2>
                        </div>
                        <button 
                            onClick={() => isEditingBrief ? handleSaveBrief() : setIsEditingBrief(true)}
                            className={`px-5 py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isEditingBrief ? 'bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-900/20' : 'bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-700'}`}
                        >
                            {isEditingBrief ? <><CheckIcon className="w-3 h-3"/> Commit Changes</> : <><EditIcon className="w-3 h-3"/> Update Brief</>}
                        </button>
                    </div>
                    
                    <div className="flex-grow">
                        {isEditingBrief ? (
                            <textarea
                                value={brief}
                                onChange={(e) => setBrief(e.target.value)}
                                className="w-full h-full min-h-[300px] bg-black/40 border border-neutral-800 rounded-xl p-6 text-neutral-200 focus:ring-1 focus:ring-brand outline-none resize-none font-mono text-sm leading-relaxed"
                                placeholder="Define the creative vision, high-level plot points, and technical objectives..."
                            />
                        ) : (
                            <div className="prose prose-invert prose-sm max-w-none text-neutral-400 whitespace-pre-wrap leading-loose font-medium">
                                {brief || <div className="h-full flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-xl py-20 text-neutral-600 italic">Vision documents required. Click 'Update Brief' to initialize.</div>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid Column */}
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.4em] mb-2 px-2">Asset Inventory</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard title="Storyboard" value={stats.storyboardFrames} icon={<StoryboardIcon />} onClick={() => onNavigate('story')} color="purple" />
                        <StatCard title="Drafts" value={stats.scriptsCount} icon={<ScriptIcon />} onClick={() => onNavigate('scripts-bin')} color="emerald" />
                        <StatCard title="Talent" value={stats.agents} icon={<CharacterIcon />} onClick={() => onNavigate('agents')} color="sky" />
                        <StatCard title="Inspo" value={stats.inspirationImages} icon={<PinIcon />} onClick={() => onNavigate('inspiration')} color="pink" />
                    </div>
                    
                    <div className="mt-8 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand/5 blur-[80px] rounded-full"></div>
                        <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-4">Command Center</h3>
                        <div className="space-y-3">
                            <button onClick={() => onNavigate('team')} className="w-full text-left px-5 py-4 bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-black uppercase tracking-widest text-neutral-300 transition-all flex items-center justify-between group">
                                <span>Consult Studio Crew</span>
                                <span className="text-neutral-600 group-hover:text-brand transition-colors">→</span>
                            </button>
                            <button onClick={() => onNavigate('script-writer')} className="w-full text-left px-5 py-4 bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-black uppercase tracking-widest text-neutral-300 transition-all flex items-center justify-between group">
                                <span>Initialize New Script</span>
                                <span className="text-neutral-600 group-hover:text-brand transition-colors">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset Gallery Strip */}
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-8 shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-6 bg-red-600 rounded-full"></div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Recent Visual Data</h3>
                    </div>
                    <button onClick={() => onNavigate('grid')} className="text-[10px] font-black text-brand hover:text-brand-hover transition-colors uppercase tracking-[0.2em] border-b border-brand/20 pb-0.5">Access Vault →</button>
                </div>
                
                {galleryImages.length > 0 ? (
                    <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent snap-x">
                        {galleryImages.map((img) => (
                            <div key={img.id} className="flex-shrink-0 w-72 aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 shadow-xl group relative snap-start">
                                {img.type === 'video' ? (
                                    <video src={img.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 scale-110 group-hover:scale-100" muted />
                                ) : (
                                    <img src={`data:${img.mimeType};base64,${img.base64}`} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 scale-110 group-hover:scale-100" alt="Asset" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end p-4">
                                    <div className="w-full">
                                        <span className="text-[9px] font-black text-brand uppercase tracking-widest block mb-1">Asset ID</span>
                                        <span className="text-[10px] font-mono text-neutral-400 truncate block w-full">{img.id}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center bg-black/20 rounded-xl border border-dashed border-neutral-800 text-neutral-600 text-sm py-10">
                        <ImageIcon className="w-8 h-8 mb-3 opacity-20" />
                        <span className="font-bold uppercase tracking-widest text-[10px]">No visual assets detected in project buffer</span>
                    </div>
                )}
            </div>

            {/* Analytics Dashboard Panel */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 shadow-2xl relative space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-neutral-800 pb-5 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Studio Production Center</h2>
                    </div>

                    <div className="flex bg-black/40 border border-neutral-800 p-1.5 rounded-xl self-end sm:self-auto shrink-0 flex-wrap gap-1">
                        <button
                            onClick={() => setDashboardTab('metrics')}
                            className={`px-4 py-1.5 text-[10px] uppercase tracking-wider font-black rounded-lg transition-all ${
                                dashboardTab === 'metrics' 
                                    ? 'bg-purple-600 text-white shadow-md' 
                                    : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            📊 KPI Metrics
                        </button>
                        <button
                            onClick={() => setDashboardTab('audio-themes')}
                            className={`px-4 py-1.5 text-[10px] uppercase tracking-wider font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                dashboardTab === 'audio-themes' 
                                    ? 'bg-purple-600 text-white shadow-md' 
                                    : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            🫧 Audio Sentiment & Plot Themes
                        </button>
                        <button
                            onClick={() => setDashboardTab('timeline')}
                            className={`px-4 py-1.5 text-[10px] uppercase tracking-wider font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                dashboardTab === 'timeline' 
                                    ? 'bg-purple-600 text-white shadow-md' 
                                    : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            ⏳ Project Timeline
                        </button>
                    </div>
                </div>

                {dashboardTab === 'timeline' ? (
                    <div className="space-y-6">
                        {/* Custom Milestone Creator Bar */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-neutral-950/20 p-4 border border-neutral-850 rounded-xl gap-3">
                                <div>
                                    <h4 className="text-xs font-black uppercase text-neutral-400 tracking-wider">Custom Production Milestones</h4>
                                    <p className="text-[11px] text-neutral-500">Map custom milestones (e.g. Concept Lock, Rough Cut) directly into your visual production timeline.</p>
                                </div>
                                <button
                                    onClick={() => setShowAddMilestone(!showAddMilestone)}
                                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-all shadow-md self-end sm:self-auto shrink-0"
                                >
                                    {showAddMilestone ? "Close Form" : "➕ Add Milestone"}
                                </button>
                            </div>

                            {showAddMilestone && (
                                <form onSubmit={handleAddMilestoneSubmit} className="bg-neutral-950/60 border border-neutral-800 p-5 rounded-2xl space-y-4 animate-fade-in shadow-xl">
                                    <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider">New Production Milestone</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">Milestone Title</label>
                                            <input
                                                type="text"
                                                required
                                                value={mTitle}
                                                onChange={e => setMTitle(e.target.value)}
                                                placeholder="e.g. Concept Lock, Rough Cut, Final Render"
                                                className="w-full bg-black border border-neutral-800 p-2.5 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none rounded-lg"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">Target Date</label>
                                            <input
                                                type="date"
                                                required
                                                value={mDate}
                                                onChange={e => setMDate(e.target.value)}
                                                className="w-full bg-black border border-neutral-800 p-2.5 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">Milestone Description</label>
                                        <textarea
                                            value={mDesc}
                                            onChange={e => setMDesc(e.target.value)}
                                            placeholder="Outline core objectives or lock constraints of this delivery point..."
                                            className="w-full h-16 bg-black border border-neutral-800 p-2.5 text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none rounded-lg resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">Status Level</label>
                                            <select
                                                value={mStatus}
                                                onChange={e => setMStatus(e.target.value as any)}
                                                className="w-full bg-black border border-neutral-800 p-2.5 text-xs text-neutral-300 focus:ring-1 focus:ring-purple-500 outline-none rounded-lg"
                                            >
                                                <option value="pending">Pending</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                                <option value="critical">Critical Path</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-wider block">Theme Color</label>
                                            <select
                                                value={mColor}
                                                onChange={e => setMColor(e.target.value as any)}
                                                className="w-full bg-black border border-neutral-800 p-2.5 text-xs text-neutral-300 focus:ring-1 focus:ring-purple-500 outline-none rounded-lg"
                                            >
                                                <option value="purple">Purple Accent</option>
                                                <option value="emerald">Emerald Green Accent</option>
                                                <option value="amber">Amber Orange Accent</option>
                                                <option value="sky">Sky Blue Accent</option>
                                                <option value="rose">Rose Red Accent</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2.5 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowAddMilestone(false)}
                                            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-neutral-400 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg transition-all"
                                        >
                                            Save Milestone
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-purple-500 before:via-indigo-500 before:to-neutral-850">
                            {timelineEvents.map((ev, idx) => (
                                <div key={ev.id} className="relative group animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                                    {/* Timeline icon bullet */}
                                    <span className={`absolute -left-9 sm:-left-11 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all ${
                                        ev.type === 'inception' ? 'bg-sky-950 border-sky-500 text-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.3)]' :
                                        ev.type === 'lore' ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                        ev.type === 'character' ? 'bg-purple-950 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.3)]' :
                                        ev.type === 'script' ? 'bg-amber-950 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                                        ev.type === 'image' ? 'bg-pink-950 border-pink-500 text-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.3)]' :
                                        // Custom Milestones theme colors
                                        (ev as any).color === 'purple' ? 'bg-purple-950 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.3)]' :
                                        (ev as any).color === 'emerald' ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                        (ev as any).color === 'amber' ? 'bg-amber-950 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                                        (ev as any).color === 'sky' ? 'bg-sky-950 border-sky-500 text-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.3)]' :
                                        'bg-rose-950 border-rose-500 text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                                    }`}>
                                        {ev.type === 'inception' && <PinIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                        {ev.type === 'lore' && <LoreIcon className="w-3.5 h-3.5" />}
                                        {ev.type === 'character' && <CharacterIcon className="w-3.5 h-3.5" />}
                                        {ev.type === 'script' && <ScriptIcon className="w-3.5 h-3.5" />}
                                        {ev.type === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
                                        {ev.type === 'milestone' && (
                                            <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
                                        )}
                                    </span>

                                    <div className="bg-neutral-950/40 border border-neutral-850 p-5 rounded-2xl space-y-2 hover:border-purple-500/20 transition-all shadow-lg relative group">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest border ${
                                                    ev.type === 'inception' ? 'bg-sky-950/60 border-sky-900/40 text-sky-400' :
                                                    ev.type === 'lore' ? 'bg-emerald-950/60 border-emerald-900/40 text-emerald-400' :
                                                    ev.type === 'character' ? 'bg-purple-950/60 border-purple-900/40 text-purple-400' :
                                                    ev.type === 'script' ? 'bg-amber-950/60 border-amber-900/40 text-amber-400' :
                                                    ev.type === 'image' ? 'bg-pink-950/60 border-pink-900/40 text-pink-400' :
                                                    // Custom status badge
                                                    (ev as any).status === 'critical' ? 'bg-rose-950/60 border-rose-900/40 text-rose-400' :
                                                    (ev as any).status === 'completed' ? 'bg-emerald-950/60 border-emerald-900/40 text-emerald-400' :
                                                    (ev as any).status === 'in_progress' ? 'bg-amber-950/60 border-amber-900/40 text-amber-400' :
                                                    'bg-neutral-900/60 border-neutral-800 text-neutral-400'
                                                }`}>
                                                    {ev.type === 'milestone' ? `Milestone: ${(ev as any).status.replace('_', ' ')}` : ev.type}
                                                </span>
                                                <h4 className="text-sm font-black text-white">{ev.title}</h4>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">{ev.date}</span>
                                                {ev.type === 'milestone' && (
                                                    <button
                                                        onClick={() => handleDeleteMilestone(ev.id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded hover:bg-rose-950/30"
                                                        title="Delete Milestone"
                                                    >
                                                        ✕ Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-400 leading-relaxed">{ev.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : dashboardTab === 'audio-themes' ? (
                    /* Dedicated Audio Themes & Sentiment Intelligence Tab */
                    <div className="space-y-6">
                        <AudioThemesBubbleChart
                            analysis={audioAnalysis}
                            isLoading={isLoadingAudioAnalysis}
                            onReanalyze={fetchAudioAnalysis}
                            transcriptsCount={project.data.transcripts?.length || 4}
                            onNavigateToLore={() => onNavigate('lore')}
                        />
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Column 1: Core Compute metrics */}
                        <div className="bg-neutral-950/40 border border-neutral-850 p-5 rounded-xl flex flex-col justify-between">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Estimated Core Compute</span>
                                <div className="pt-2">
                                    <span className="text-4xl font-black text-white tracking-tighter">
                                        {Math.floor(((stats.imagesGenerated || 0) * 45 + (stats.storyboardFrames || 0) * 120 + (stats.scriptsCount || 0) * 180) / 60)}m{" "}
                                        {Math.floor(((stats.imagesGenerated || 0) * 45 + (stats.storyboardFrames || 0) * 120 + (stats.scriptsCount || 0) * 180) % 60)}s
                                    </span>
                                    <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
                                        Dynamic generation timespan mapped across text synthesis, image render grids, and audio encoding pipelines.
                                    </p>
                                </div>
                            </div>

                            {/* Visual speed indicator */}
                            <div className="pt-4 border-t border-neutral-850 space-y-1.5">
                                <div className="flex justify-between text-[9px] font-black text-neutral-500 uppercase tracking-wider">
                                    <span>Core Thermal Throttle</span>
                                    <span className="text-emerald-400">Stable</span>
                                </div>
                                <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[24%]" />
                                </div>
                            </div>
                        </div>

                        {/* Column 2: Inventory breakdown */}
                        <div className="bg-neutral-950/40 border border-neutral-850 p-5 rounded-xl space-y-4">
                            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block">Production Inventory Mix</span>
                            
                            <div className="space-y-3 pt-1">
                                {/* Proportional bars */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-neutral-400">
                                        <span className="font-bold">Visuals (Images/Frames)</span>
                                        <span className="font-mono">{stats.imagesGenerated + stats.storyboardFrames}</span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, ((stats.imagesGenerated + stats.storyboardFrames) / Math.max(1, stats.imagesGenerated + stats.storyboardFrames + stats.scriptsCount + stats.loreEntries)) * 100))}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-neutral-400">
                                        <span className="font-bold">Writings & Bible (Scripts/Lore)</span>
                                        <span className="font-mono">{stats.scriptsCount + stats.loreEntries}</span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, ((stats.scriptsCount + stats.loreEntries) / Math.max(1, stats.imagesGenerated + stats.storyboardFrames + stats.scriptsCount + stats.loreEntries)) * 100))}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-neutral-400">
                                        <span className="font-bold">Agents & Roster</span>
                                        <span className="font-mono">{stats.agents}</span>
                                    </div>
                                    <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-sky-600 to-blue-600 rounded-full"
                                            style={{ width: `${Math.min(100, Math.max(5, (stats.agents / Math.max(1, stats.imagesGenerated + stats.storyboardFrames + stats.scriptsCount + stats.loreEntries + stats.agents)) * 100))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 3: Heat Map of Studio utilization */}
                        <div className="bg-neutral-950/40 border border-neutral-850 p-5 rounded-xl space-y-4">
                            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider block">Studio Load Heat Map</span>
                            
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                <div className={`p-2.5 border rounded-lg flex flex-col justify-between h-14 transition-all ${
                                    stats.loreEntries > 5 
                                        ? 'bg-purple-950/30 border-purple-500/40 text-purple-200' 
                                        : stats.loreEntries > 0 
                                            ? 'bg-purple-950/10 border-purple-500/20 text-purple-300' 
                                            : 'bg-neutral-900/40 border-neutral-850 text-neutral-500'
                                }`}>
                                    <span className="text-[9px] font-black uppercase tracking-wider block">Lore Studio</span>
                                    <span className="text-xs font-black font-mono">{stats.loreEntries > 5 ? "Overloaded" : stats.loreEntries > 0 ? "High Active" : "Idle"}</span>
                                </div>

                                <div className={`p-2.5 border rounded-lg flex flex-col justify-between h-14 transition-all ${
                                    stats.storyboardFrames > 5 
                                        ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200' 
                                        : stats.storyboardFrames > 0 
                                            ? 'bg-indigo-950/10 border-indigo-500/20 text-indigo-300' 
                                            : 'bg-neutral-900/40 border-neutral-850 text-neutral-500'
                                }`}>
                                    <span className="text-[9px] font-black uppercase tracking-wider block">Storyboard</span>
                                    <span className="text-xs font-black font-mono">{stats.storyboardFrames > 5 ? "Overloaded" : stats.storyboardFrames > 0 ? "High Active" : "Idle"}</span>
                                </div>

                                <div className={`p-2.5 border rounded-lg flex flex-col justify-between h-14 transition-all ${
                                    stats.scriptsCount > 3 
                                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                                        : stats.scriptsCount > 0 
                                            ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300' 
                                            : 'bg-neutral-900/40 border-neutral-850 text-neutral-500'
                                }`}>
                                    <span className="text-[9px] font-black uppercase tracking-wider block">Scripting</span>
                                    <span className="text-xs font-black font-mono">{stats.scriptsCount > 3 ? "Overloaded" : stats.scriptsCount > 0 ? "High Active" : "Idle"}</span>
                                </div>

                                <div className={`p-2.5 border rounded-lg flex flex-col justify-between h-14 transition-all ${
                                    stats.imagesGenerated > 8 
                                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-200' 
                                        : stats.imagesGenerated > 0 
                                            ? 'bg-rose-950/10 border-rose-500/20 text-rose-300' 
                                            : 'bg-neutral-900/40 border-neutral-850 text-neutral-500'
                                }`}>
                                    <span className="text-[9px] font-black uppercase tracking-wider block">Visual Synth</span>
                                    <span className="text-xs font-black font-mono">{stats.imagesGenerated > 8 ? "Overloaded" : stats.imagesGenerated > 0 ? "High Active" : "Idle"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Audio Transcripts Plot Themes & Sentiment Bubble Chart */}
                    <div className="pt-4 border-t border-neutral-800">
                            <AudioThemesBubbleChart
                                analysis={audioAnalysis}
                                isLoading={isLoadingAudioAnalysis}
                                onReanalyze={fetchAudioAnalysis}
                                transcriptsCount={project.data.transcripts?.length || 4}
                                onNavigateToLore={() => onNavigate('lore')}
                            />
                        </div>
                    </div>
                )}
            </div>
            
            {/* Project Footer Detail */}
            <div className="pt-10 flex justify-center opacity-30 border-t border-neutral-800">
                <span className="text-[9px] font-black uppercase tracking-[1em] text-neutral-500">MythOS Director Pro / System Version 4.2 / Finalized Build</span>
            </div>
        </div>
    );
};
