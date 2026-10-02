
import React, { useState, useEffect } from 'react';
import { LoreEntry } from '../types.ts';
import { LoreIcon, FolderIcon } from './icons.tsx';
import { LoreNetwork } from './LoreNetwork.tsx';

interface ProjectSummary {
    id: string;
    name: string;
}

interface LoreStudioProps {
    lore: LoreEntry[];
    projects: ProjectSummary[];
    characters?: any[];
    promptTemplates?: any[];
    images?: any[];
    activeProjectId?: string;
    onCreate: (title: string, content: string, projectId: string) => void;
    onUpdate: (id: string, title: string, content: string) => void;
    onDelete: (id: string) => void;
    onUpdateCharacters?: (characters: any[]) => void;
    onUpdateLore?: (lore: LoreEntry[]) => void;
}

const LoreEntryEditor: React.FC<{
    entry: LoreEntry;
    onUpdate: (id: string, title: string, content: string) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ entry, onUpdate, onDelete, onCancel }) => {
    const [title, setTitle] = useState(entry.title);
    const [content, setContent] = useState(entry.content);

    const handleSave = () => {
        if (title.trim() && content.trim()) {
            onUpdate(entry.id, title, content);
            onCancel(); // Close editor
        }
    };

    return (
        <div className="bg-neutral-800/60 p-4 border border-neutral-700 space-y-3 rounded-lg">
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lore Title"
                className="w-full bg-black border border-neutral-800 p-2 text-lg font-bold text-white focus:ring-2 focus:ring-brand outline-none rounded-lg"
            />
            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe the lore..."
                className="w-full h-40 bg-black border border-neutral-800 p-3 text-sm text-neutral-200 resize-y focus:ring-2 focus:ring-brand outline-none rounded-lg"
            />
            <div className="flex justify-end gap-3">
                <button onClick={() => onDelete(entry.id)} className="px-4 py-2 text-sm font-medium text-red-400 bg-neutral-900 hover:bg-red-900/50 transition rounded-lg">Delete</button>
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded-lg">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition rounded-lg">Save Changes</button>
            </div>
        </div>
    );
};

interface ClusteringResult {
    id: string;
    name: string;
    type: 'lore' | 'character';
    cluster: string;
    tags: string[];
}

const LoreClusteringUtility: React.FC<{
    lore: LoreEntry[];
    characters: any[];
    activeProjectId: string;
    onUpdateCharacters?: (characters: any[]) => void;
    onUpdateLore?: (lore: LoreEntry[]) => void;
}> = ({ lore, characters, activeProjectId, onUpdateCharacters, onUpdateLore }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [results, setResults] = useState<ClusteringResult[]>([]);
    const [hasCommitted, setHasCommitted] = useState(false);

    // Scan relevant entries
    const projectLore = lore.filter(l => l.projectId === activeProjectId);
    const totalScanCount = projectLore.length + characters.length;

    const handleRunClustering = async () => {
        setIsProcessing(true);
        setProgressStatus("Scanning and formatting entries for Gemini...");
        
        try {
            // Compile items payload
            const items = [
                ...projectLore.map(l => ({
                    id: l.id,
                    name: l.title,
                    description: l.content,
                    type: 'lore'
                })),
                ...characters.map(c => ({
                    id: c.id,
                    name: c.name,
                    description: `${c.archetype}: ${c.description}`,
                    type: 'character'
                }))
            ];

            if (items.length === 0) {
                alert("No lore or character entries found in this project to analyze.");
                setIsProcessing(false);
                return;
            }

            setProgressStatus("Synthesizing clusters with Gemini 2.5...");

            const res = await fetch('/api/batch-categorize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Batch categorization failed");
            }

            const data = await res.json();
            
            if (data.mappings) {
                const compiled: ClusteringResult[] = [];
                items.forEach(item => {
                    const mapped = data.mappings[item.id];
                    compiled.push({
                        id: item.id,
                        name: item.name,
                        type: item.type as any,
                        cluster: mapped ? mapped.cluster : 'Uncategorized',
                        tags: mapped ? mapped.tags : []
                    });
                });
                setResults(compiled);
                setHasCommitted(false);
            }
        } catch (err) {
            console.error("Clustering failed:", err);
            alert(`Semantic clustering failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsProcessing(false);
            setProgressStatus('');
        }
    };

    const handleCommit = () => {
        if (results.length === 0) return;

        // Apply to characters
        const updatedChars = characters.map(c => {
            const result = results.find(r => r.id === c.id);
            if (result) {
                return {
                    ...c,
                    cluster: result.cluster,
                    tags: result.tags
                };
            }
            return c;
        });

        // Apply to lore
        const updatedLore = lore.map(l => {
            const result = results.find(r => r.id === l.id);
            if (result) {
                return {
                    ...l,
                    cluster: result.cluster,
                    tags: result.tags
                };
            }
            return l;
        });

        if (onUpdateCharacters) onUpdateCharacters(updatedChars);
        if (onUpdateLore) onUpdateLore(updatedLore);

        setHasCommitted(true);
        alert("✨ Thematic clusters and semantic tags successfully written to project bible!");
    };

    // Group results by cluster
    const groupedResults = results.reduce((acc, curr) => {
        if (!acc[curr.cluster]) {
            acc[curr.cluster] = [];
        }
        acc[curr.cluster].push(curr);
        return acc;
    }, {} as Record<string, ClusteringResult[]>);

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="border-b border-neutral-800 pb-4">
                <h3 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
                    <span>🧬 Semantic Clustering Utility</span>
                    <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black uppercase px-2 py-0.5 rounded-full tracking-wider font-mono">
                        Powered by Gemini AI
                    </span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                    Scans existing character entries and lore bible content to discover thematic groupings, organizing them dynamically using semantic tags.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Control Panel */}
                <div className="bg-neutral-950/40 border border-neutral-850 p-5 rounded-lg flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Project Scanner Report</span>
                        <div className="p-3 bg-black/40 border border-neutral-800/80 rounded-lg flex justify-between items-center text-xs">
                            <span className="text-neutral-300 font-bold">Total Scannable Assets:</span>
                            <span className="text-blue-400 font-black font-mono">{totalScanCount} elements</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                            <div className="p-2.5 bg-neutral-900/40 rounded border border-neutral-900">
                                <span className="block font-bold">Lore Entries:</span>
                                <span className="text-xs font-black text-white">{projectLore.length}</span>
                            </div>
                            <div className="p-2.5 bg-neutral-900/40 rounded border border-neutral-900">
                                <span className="block font-bold">Characters:</span>
                                <span className="text-xs font-black text-white">{characters.length}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleRunClustering}
                        disabled={isProcessing || totalScanCount === 0}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs uppercase tracking-widest font-black rounded-lg shadow-lg transition-all disabled:opacity-50"
                    >
                        {isProcessing ? "Analyzing Universe..." : "🧬 Scan & Categorize Universe"}
                    </button>
                </div>

                {/* Info block */}
                <div className="bg-neutral-950/20 border border-neutral-850/80 p-5 rounded-lg text-xs leading-relaxed text-neutral-300 space-y-3">
                    <h4 className="font-bold text-neutral-200">How thematic clustering works:</h4>
                    <p>
                        Our batch categorization engine bundles all textual summaries and character archetypes into a single contextual payload. It then leverages the deep reasoning capability of <strong>Gemini 2.5</strong> to identify shared historical, mechanical, or cultural themes.
                    </p>
                    <p>
                        Each item is placed into its most suitable thematic group, and is enhanced with custom semantic search tags. Committing these modifications writes them directly to your lore database.
                    </p>
                </div>
            </div>

            {isProcessing && (
                <div className="bg-blue-950/20 border border-blue-500/20 p-5 rounded-lg flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-blue-300 font-medium">{progressStatus}</span>
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-neutral-800">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-black uppercase text-neutral-400 tracking-wider">Discovered Clusters ({Object.keys(groupedResults).length})</h4>
                        <button
                            onClick={handleCommit}
                            disabled={hasCommitted}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg shadow-md transition-all ${
                                hasCommitted 
                                    ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-default' 
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                        >
                            {hasCommitted ? "✓ Committed to Bible" : "💾 Commit & Apply Tags"}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(groupedResults).map(([cluster, items]) => (
                            <div key={cluster} className="bg-black/40 border border-neutral-850 p-4 rounded-lg space-y-3">
                                <div className="border-b border-neutral-800 pb-2 flex justify-between items-center">
                                    <span className="text-xs font-black text-blue-400 tracking-wide block truncate max-w-[150px]">{cluster}</span>
                                    <span className="text-[10px] text-neutral-500 font-mono font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">{items.length} assets</span>
                                </div>

                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                    {items.map(item => (
                                        <div key={item.id} className="p-2 bg-neutral-900/60 border border-neutral-850 rounded text-xs space-y-1.5">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-neutral-200 truncate block max-w-[140px]">{item.name}</span>
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                    item.type === 'character' ? 'bg-purple-950/60 text-purple-400 border border-purple-900/40' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {item.tags.map((tag, idx) => (
                                                    <span key={idx} className="text-[9px] font-mono font-bold bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-850">
                                                        #{tag}
                                                    </span>
                                                ))}
                                                {item.tags.length === 0 && <span className="text-[9px] text-neutral-600 italic">No tags assigned.</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const LoreStudio: React.FC<LoreStudioProps> = ({ lore, projects, characters = [], promptTemplates = [], images = [], activeProjectId = '', onCreate, onUpdate, onDelete, onUpdateCharacters, onUpdateLore }) => {
    const [activeTab, setActiveTab] = useState<'bible' | 'network' | 'clustering' | 'heatmap'>('bible');
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    // Database states for heatmap calculations
    const [tripletEdges, setTripletEdges] = useState<any[]>([]);
    const [vectors, setVectors] = useState<any[]>([]);
    const [activeHeatmapFilter, setActiveHeatmapFilter] = useState<'all' | 'gaps' | 'overlaps'>('all');
    const [entityTypeFilter, setEntityTypeFilter] = useState<'all' | 'characters' | 'locations' | 'themes'>('all');
    const [selectedHeatmapItem, setSelectedHeatmapItem] = useState<any | null>(null);

    useEffect(() => {
        if (!activeProjectId) return;
        const loadStats = async () => {
            try {
                const edges = await import('../services/vectorDbService.ts').then(m => m.vectorDb.getAllTripletEdges());
                const vecs = await import('../services/vectorDbService.ts').then(m => m.vectorDb.getAllVectors());
                setTripletEdges(edges);
                setVectors(vecs);
            } catch (err) {
                console.error("Failed to load db data in LoreStudio:", err);
            }
        };
        loadStats();
    }, [activeProjectId]);

    useEffect(() => {
        if (projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, selectedProjectId]);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTitle.trim() && newContent.trim() && selectedProjectId) {
            onCreate(newTitle, newContent, selectedProjectId);
            setNewTitle('');
            setNewContent('');
        }
    };

    const handleExportLorepack = () => {
        const activeProj = projects.find(p => p.id === activeProjectId);
        const projectName = activeProj ? activeProj.name : 'Unknown Project';

        // Filter lore to current project
        const projectLore = lore.filter(entry => entry.projectId === activeProjectId);

        const lorepack = {
            schema: "LOREPACK_FACTORY_V1",
            metadata: {
                packId: `lorepack_${Date.now()}`,
                projectId: activeProjectId || '',
                projectName: projectName,
                exportedAt: new Date().toISOString(),
                generator: "MYTHOS DMS READER"
            },
            lore: projectLore.map(l => ({
                id: l.id,
                title: l.title,
                content: l.content
            })),
            characters: characters.map(c => ({
                id: c.id,
                name: c.name,
                archetype: c.archetype,
                description: c.description,
                avatar: c.avatar
            })),
            prompts: promptTemplates.map(t => ({
                id: t.id,
                name: t.name,
                positivePrompt: t.positivePrompt,
                negativePrompt: t.negativePrompt
            })),
            assets: images.map(img => ({
                id: img.id,
                type: img.type,
                base64: img.base64,
                url: img.url,
                mimeType: img.mimeType,
                tags: img.tags || [],
                folder: img.folder
            }))
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lorepack, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_lorepack.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.removeChild(downloadAnchor);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="mb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-neutral-200 mb-2">Lore Studio</h2>
                        <p className="text-neutral-400">Define the elements of your story universe. This lore will be used as context to guide every AI image generation, ensuring consistency.</p>
                    </div>
                    <button
                        onClick={handleExportLorepack}
                        className="flex-shrink-0 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-lg shadow-lg flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                        title="Export Lore, Characters, Prompt Templates and Images as Lorepack"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download Lorepack</span>
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-neutral-800">
                    <button
                        onClick={() => setActiveTab('bible')}
                        className={`px-5 py-3 border-b-2 text-xs uppercase tracking-widest font-black transition-all ${
                            activeTab === 'bible' 
                                ? 'border-blue-500 text-blue-400' 
                                : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        📚 Lore Bible List
                    </button>
                    <button
                        onClick={() => setActiveTab('network')}
                        className={`px-5 py-3 border-b-2 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-1.5 ${
                            activeTab === 'network' 
                                ? 'border-purple-500 text-purple-400' 
                                : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        🔮 Lore Network Constellation
                    </button>
                    <button
                        onClick={() => setActiveTab('clustering')}
                        className={`px-5 py-3 border-b-2 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-1.5 ${
                            activeTab === 'clustering' 
                                ? 'border-blue-500 text-blue-400' 
                                : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        🧬 Thematic Clustering
                    </button>
                    <button
                        onClick={() => setActiveTab('heatmap')}
                        className={`px-5 py-3 border-b-2 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-1.5 ${
                            activeTab === 'heatmap' 
                                ? 'border-red-500 text-red-400' 
                                : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                    >
                        🗺️ Thematic Heatmap
                    </button>
                </div>
            </div>

            {activeTab === 'network' ? (
                <LoreNetwork 
                    lore={lore} 
                    characters={characters} 
                    activeProjectId={activeProjectId} 
                />
            ) : activeTab === 'clustering' ? (
                <LoreClusteringUtility
                    lore={lore}
                    characters={characters}
                    activeProjectId={activeProjectId}
                    onUpdateCharacters={onUpdateCharacters}
                    onUpdateLore={onUpdateLore}
                />
            ) : activeTab === 'heatmap' ? (
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800 pb-4">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 font-mono">
                                <span>🗺️</span> Thematic Heatmap & Knowledge Gap Analyzer
                            </h3>
                            <p className="text-[10px] text-neutral-500 uppercase mt-0.5 font-bold tracking-wider">
                                Dynamically overlays entity density values across the creative bible
                            </p>
                        </div>
                        {/* Interactive overlay filters toggles */}
                        <div className="flex flex-wrap gap-2 bg-black/40 p-1.5 rounded-xl border border-neutral-800 shrink-0">
                            {(['all', 'characters', 'locations', 'themes'] as const).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => { setEntityTypeFilter(type); setSelectedHeatmapItem(null); }}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        entityTypeFilter === type
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-neutral-500 hover:text-white'
                                    }`}
                                >
                                    {type === 'all' ? '🔍 All Themes' : type === 'characters' ? '👤 Characters' : type === 'locations' ? '📍 Locations' : '🔮 Concepts'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(() => {
                        if (!tripletEdges || tripletEdges.length === 0) {
                            return (
                                <div className="bg-black/10 border border-neutral-850 p-6 rounded-xl text-center text-xs text-neutral-500 italic py-12">
                                    No entities registered. Build or link node triplets inside the Knowledge Base Neural Graph to overlay values.
                                </div>
                            );
                        }

                        const entities = Array.from(new Set(
                            tripletEdges.flatMap(e => [e.s.trim(), e.o.trim()]).filter(s => s && s.length > 2)
                        ));

                        const rawItems = entities.map(name => {
                            const mentionsCount = vectors.filter(v => v.text.toLowerCase().includes(name.toLowerCase())).length;
                            const relationsCount = tripletEdges.filter(e => e.s.trim() === name || e.o.trim() === name).length;
                            const score = mentionsCount + relationsCount * 1.5;

                            let status: 'gap' | 'balanced' | 'overlap' = 'balanced';
                            if (score <= 2.5) {
                                status = 'gap';
                            } else if (score >= 9) {
                                status = 'overlap';
                            }

                            // Dynamic entity categorization logic
                            const isChar = characters.some(c => c.name.toLowerCase() === name.toLowerCase()) || 
                                           lore.some(l => l.title.toLowerCase() === name.toLowerCase() && l.content.toLowerCase().includes('character'));
                            const isLoc = name.toLowerCase().match(/\b(palace|citadel|mountain|city|desert|room|cave|forest|tower|station|temple|lake|sea|ship|base|house)\b/i) ||
                                          lore.some(l => l.title.toLowerCase() === name.toLowerCase() && l.content.toLowerCase().match(/\b(place|location|region|settlement|capital)\b/i));

                            let catType: 'character' | 'location' | 'theme' = 'theme';
                            if (isChar) catType = 'character';
                            else if (isLoc) catType = 'location';

                            return { name, mentionsCount, relationsCount, score, status, catType };
                        }).sort((a, b) => b.score - a.score);

                        const filteredItems = rawItems.filter(item => {
                            if (entityTypeFilter === 'characters') return item.catType === 'character';
                            if (entityTypeFilter === 'locations') return item.catType === 'location';
                            if (entityTypeFilter === 'themes') return item.catType === 'theme';
                            return true;
                        });

                        return (
                            <div className="space-y-4 font-sans">
                                {filteredItems.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-72 overflow-y-auto custom-scrollbar pr-1 animate-fade-in">
                                        {filteredItems.map((item, idx) => {
                                            const isSelected = selectedHeatmapItem?.name === item.name;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setSelectedHeatmapItem(item)}
                                                    className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between h-20 relative cursor-pointer ${
                                                        isSelected 
                                                            ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg scale-[1.03]' 
                                                            : item.status === 'gap'
                                                                ? 'bg-rose-950/20 border-rose-900/30 hover:border-rose-700/60'
                                                                : item.status === 'overlap'
                                                                    ? 'bg-purple-950/20 border-purple-900/30 hover:border-purple-700/60'
                                                                    : 'bg-black/20 border-neutral-800 hover:border-neutral-700'
                                                    }`}
                                                >
                                                    <div className="w-full">
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className={`text-[7px] font-black uppercase px-1 rounded border font-mono ${
                                                                item.status === 'gap'
                                                                    ? 'bg-red-950 text-red-400 border-red-900/20 animate-pulse'
                                                                    : item.status === 'overlap'
                                                                        ? 'bg-purple-950 text-purple-400 border-purple-900/20 font-black'
                                                                        : 'bg-neutral-850 text-neutral-400 border-neutral-700/40'
                                                            }`}>
                                                                {item.status === 'gap' ? 'Gap' : item.status === 'overlap' ? 'Hub' : 'Core'}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-neutral-400 font-mono">
                                                                {item.score.toFixed(1)}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-[10px] font-black text-neutral-200 mt-1 truncate w-full font-mono" title={item.name}>
                                                            {item.name}
                                                        </h4>
                                                    </div>
                                                    <span className="text-[8px] text-neutral-500 font-mono truncate block w-full">
                                                        {item.catType.toUpperCase()}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-neutral-500 italic text-center py-4 font-sans">
                                        No entities matched this filter overlay. Try choosing another category.
                                    </p>
                                )}

                                {/* HEATMAP DETAILED INSPECTOR CARD */}
                                {selectedHeatmapItem && (
                                    <div className="bg-black/35 border border-neutral-850 rounded-xl p-4 space-y-2 animate-scale-up font-sans text-xs">
                                        <div className="flex justify-between items-start pb-2 border-b border-neutral-800">
                                            <div>
                                                <span className="text-[8px] font-black uppercase text-red-400 tracking-wider font-mono">Thematic Gap Analysis Inspector</span>
                                                <h4 className="text-xs font-black text-white mt-0.5 font-mono">{selectedHeatmapItem.name}</h4>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedHeatmapItem(null)}
                                                className="text-neutral-500 hover:text-white text-xs cursor-pointer font-sans"
                                            >
                                                ✕ Close Inspector
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono pt-1 text-neutral-400">
                                            <div>
                                                Mentions In Documents: <span className="text-white font-bold">{selectedHeatmapItem.mentionsCount} times</span>
                                            </div>
                                            <div>
                                                Relationships Defined: <span className="text-white font-bold">{selectedHeatmapItem.relationsCount} links</span>
                                            </div>
                                            <div>
                                                Entity Aspect: <span className="text-white font-bold uppercase">{selectedHeatmapItem.catType}</span>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-neutral-800 flex gap-2 items-center text-xs">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 font-mono">Documentation Health:</span>
                                            <p className="text-neutral-300 leading-normal text-xs font-sans">
                                                {selectedHeatmapItem.status === 'gap' ? (
                                                    <span className="text-red-400 font-bold">⚠️ Critical Gap: This {selectedHeatmapItem.catType} is severely under-referenced and barely linked. Create more lore documents or scripts containing "{selectedHeatmapItem.name}" to balance the project.</span>
                                                ) : selectedHeatmapItem.status === 'overlap' ? (
                                                    <span className="text-purple-400 font-bold">🔥 High Focus: Dense overlapping hub. This {selectedHeatmapItem.catType} is central to multiple thematic files and relationships.</span>
                                                ) : (
                                                    <span className="text-green-400 font-bold">✓ Perfectly Balanced: Structurally integrated with stable mentions and connections.</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <>
                    <div className="mb-8">
                        <form onSubmit={handleCreate} className="bg-neutral-800/50 p-6 border border-neutral-700 space-y-4 rounded-xl shadow-xl">
                             <h3 className="text-lg font-semibold text-neutral-300">Add New Lore Entry</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <select
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                        className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="" disabled>Select Project...</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                                        <FolderIcon className="w-4 h-4" />
                                    </div>
                                </div>
                                
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Lore Title (e.g., The Sunstone of Arath)"
                                    className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none"
                                />
                            </div>

                            <textarea
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                placeholder="Describe the lore in detail. What it looks like, its history, its function..."
                                className="w-full h-28 bg-black border border-neutral-800 p-3 rounded-lg text-neutral-200 resize-y focus:ring-2 focus:ring-brand outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!newTitle.trim() || !newContent.trim() || !selectedProjectId}
                                className="w-full bg-blue-600 text-white font-bold py-3 px-4 hover:bg-blue-500 transition duration-300 disabled:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg"
                            >
                                Add to Lore Bible
                            </button>
                        </form>
                    </div>
                    
                    <div className="space-y-4">
                        {lore.length > 0 ? (
                            lore.map(entry => (
                                <div key={entry.id}>
                                    {editingId === entry.id ? (
                                        <LoreEntryEditor
                                            entry={entry}
                                            onUpdate={onUpdate}
                                            onDelete={onDelete}
                                            onCancel={() => setEditingId(null)}
                                        />
                                    ) : (
                                        <div className="bg-neutral-800/50 p-4 border border-neutral-700 group rounded-lg hover:border-neutral-500 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                                                            {projects.find(p => p.id === entry.projectId)?.name || 'Unknown Project'}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-neutral-200">{entry.title}</h4>
                                                </div>
                                                <button 
                                                    onClick={() => setEditingId(entry.id)} 
                                                    className="text-sm text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                            <p className="text-sm text-neutral-300 mt-2 whitespace-pre-wrap">{entry.content}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/30 text-center p-8">
                                <div className="w-16 h-16 text-neutral-700 mb-4"><LoreIcon /></div>
                                <h3 className="text-xl font-semibold text-neutral-300 mb-2">Your Lore Bible is Empty</h3>
                                <p className="text-neutral-500">Add entries above to start building your story's universe.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
