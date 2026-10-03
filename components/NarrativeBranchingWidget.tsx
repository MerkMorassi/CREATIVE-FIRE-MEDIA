import React, { useState } from 'react';
import { NarrativeBranch } from '../types.ts';
import { suggestNarrativeBranchesService } from '../services/geminiService.ts';
import { LoadingSpinner, ScriptIcon } from './icons.tsx';

interface NarrativeBranchingWidgetProps {
    sceneContent: string;
    scriptTitle?: string;
    genre?: string;
    characters?: any[];
    lore?: any[];
    onForkScript: (branch: NarrativeBranch, branchScreenplay: string) => void;
    onApplyBranchToEditor?: (screenplayExcerpt: string) => void;
}

export const NarrativeBranchingWidget: React.FC<NarrativeBranchingWidgetProps> = ({
    sceneContent,
    scriptTitle = "Current Script",
    genre = "Cinematic Drama",
    characters = [],
    lore = [],
    onForkScript,
    onApplyBranchToEditor
}) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [pivotAnalysis, setPivotAnalysis] = useState<string>('');
    const [branches, setBranches] = useState<NarrativeBranch[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [customSceneText, setCustomSceneText] = useState(sceneContent || '');
    const [isCustomizingScene, setIsCustomizingScene] = useState(false);
    const [forkFeedback, setForkFeedback] = useState<string | null>(null);
    const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);

    // Keep scene text in sync if parent changes and user hasn't typed custom
    React.useEffect(() => {
        if (!isCustomizingScene && sceneContent) {
            setCustomSceneText(sceneContent);
        }
    }, [sceneContent, isCustomizingScene]);

    const handleGenerateBranches = async () => {
        const textToAnalyze = customSceneText.trim() || sceneContent.trim();
        if (!textToAnalyze) {
            alert("Please provide or generate scene content first before generating narrative branches.");
            return;
        }

        setIsAnalyzing(true);
        setForkFeedback(null);
        try {
            const result = await suggestNarrativeBranchesService({
                sceneContent: textToAnalyze,
                currentScriptTitle: scriptTitle,
                genre,
                characters,
                lore
            });

            setPivotAnalysis(result.pivotAnalysis);
            setBranches(result.branches);
            if (result.branches.length > 0) {
                setSelectedBranchId(result.branches[0].id);
                setExpandedBranchId(result.branches[0].id);
            }
        } catch (error) {
            console.error("Narrative branching error:", error);
            alert(`Failed to analyze narrative branches: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFork = (branch: NarrativeBranch) => {
        const baseScene = customSceneText.trim() || sceneContent.trim();
        const branchScreenplay = `${baseScene}\n\n/* ============================================================\n   NARRATIVE FORK POINT: [${branch.branchTitle.toUpperCase()}]\n   DRAMATIC TONE: ${branch.dramaticTone}\n   TURNING POINT: ${branch.turningPoint}\n   ============================================================ */\n\n${branch.screenplayExcerpt}`;

        onForkScript(branch, branchScreenplay);
        setForkFeedback(`✓ Successfully forked into new branch: "${branch.branchTitle}"!`);
        setTimeout(() => setForkFeedback(null), 4000);
    };

    const selectedBranch = branches.find(b => b.id === selectedBranchId) || branches[0];

    return (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🔀</span>
                        <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">
                            Interactive Narrative Branching
                        </h3>
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold uppercase font-mono tracking-wider">
                            Gemini Scribe Matrix
                        </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                        Synthesizes alternative plot directions and scene climaxes, enabling one-click script forking into parallel storylines.
                    </p>
                </div>

                <button
                    onClick={handleGenerateBranches}
                    disabled={isAnalyzing || (!customSceneText.trim() && !sceneContent.trim())}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer active:scale-95"
                >
                    {isAnalyzing ? (
                        <>
                            <LoadingSpinner className="w-4 h-4 text-white" />
                            <span>Synthesizing Plot Paths...</span>
                        </>
                    ) : (
                        <>
                            <span>✨ Suggest Plot Paths</span>
                        </>
                    )}
                </button>
            </div>

            {forkFeedback && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-between animate-fade-in">
                    <span>{forkFeedback}</span>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono">Scripts Bin Updated</span>
                </div>
            )}

            {/* Current Scene Anchor / Customizer toggle */}
            <div className="bg-black/40 border border-neutral-800/80 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-neutral-300 uppercase font-mono text-[11px] tracking-wider">
                        Active Scene Anchor:
                    </span>
                    <button
                        onClick={() => setIsCustomizingScene(!isCustomizingScene)}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider hover:underline"
                    >
                        {isCustomizingScene ? "Hide Editor" : "Edit / Focus Passage"}
                    </button>
                </div>

                {isCustomizingScene ? (
                    <textarea
                        value={customSceneText}
                        onChange={(e) => setCustomSceneText(e.target.value)}
                        placeholder="Paste or write the specific scene or turning point here..."
                        className="w-full h-32 bg-black border border-neutral-700 p-3 text-xs text-neutral-200 font-mono resize-y rounded-lg outline-none focus:ring-1 focus:ring-purple-500"
                    />
                ) : (
                    <div className="text-xs text-neutral-400 font-mono line-clamp-3 italic bg-neutral-950/60 p-2.5 rounded border border-neutral-850">
                        {customSceneText || sceneContent || "No scene content currently selected. Enter a scene or generate a screenplay above."}
                    </div>
                )}
            </div>

            {/* Turning Point Pivot Analysis */}
            {pivotAnalysis && (
                <div className="bg-purple-950/20 border border-purple-900/40 p-4 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 font-mono flex items-center gap-1.5">
                        <span>🎯</span> Identified Narrative Pivot Point
                    </span>
                    <p className="text-xs text-neutral-200 leading-relaxed font-sans">
                        {pivotAnalysis}
                    </p>
                </div>
            )}

            {/* Branches Tree & Cards */}
            {branches.length > 0 && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-neutral-400 tracking-wider font-mono">
                            Alternative Timeline Branches ({branches.length})
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                            Select branch to inspect & fork
                        </span>
                    </div>

                    {/* Timeline Branch Selector Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {branches.map((b, idx) => {
                            const isSelected = selectedBranchId === b.id;
                            return (
                                <div
                                    key={b.id}
                                    onClick={() => { setSelectedBranchId(b.id); setExpandedBranchId(b.id); }}
                                    className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer space-y-3 relative group ${
                                        isSelected
                                            ? 'bg-purple-950/30 border-purple-500 ring-2 ring-purple-500/20 shadow-xl scale-[1.01]'
                                            : 'bg-black/30 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850/30'
                                    }`}
                                >
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono border bg-purple-950 text-purple-400 border-purple-800/40">
                                                Branch {String.fromCharCode(65 + idx)}
                                            </span>
                                            <span className="text-[9px] font-mono text-neutral-400 bg-neutral-850 px-1.5 py-0.5 rounded">
                                                {b.dramaticTone}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                                            {b.branchTitle}
                                        </h4>
                                        <p className="text-xs text-neutral-400 mt-2 line-clamp-3 leading-relaxed">
                                            {b.narrativeSummary}
                                        </p>
                                    </div>

                                    <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                                        <span className="truncate max-w-[150px]">Pivot: {b.turningPoint}</span>
                                        <span className="text-purple-400 font-bold group-hover:underline">View Fork &rarr;</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detailed Branch Inspector & Screenplay Preview */}
                    {selectedBranch && (
                        <div className="bg-black/50 border border-neutral-800 rounded-xl p-5 space-y-4 animate-scale-up">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-800">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-base font-black text-white font-mono">
                                            {selectedBranch.branchTitle}
                                        </h4>
                                        <span className="text-[10px] px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/40 font-mono rounded font-bold uppercase">
                                            Tone: {selectedBranch.dramaticTone}
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-400 mt-1">
                                        <strong>Turning Point Divergence:</strong> {selectedBranch.turningPoint}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {onApplyBranchToEditor && (
                                        <button
                                            onClick={() => onApplyBranchToEditor(selectedBranch.screenplayExcerpt)}
                                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                            title="Insert this branch continuation into your current screenplay editor"
                                        >
                                            Append to Script
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleFork(selectedBranch)}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                                        title="Create an independent script file in Scripts Bin for this branch"
                                    >
                                        <ScriptIcon className="w-3.5 h-3.5" />
                                        <span>Fork Script</span>
                                    </button>
                                </div>
                            </div>

                            {/* Character Consequences & Thematic Shift */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-850 space-y-1.5">
                                    <span className="text-[10px] font-black uppercase text-amber-400 font-mono block">
                                        Character Repercussions
                                    </span>
                                    <ul className="list-disc list-inside space-y-1 text-neutral-300">
                                        {selectedBranch.characterConsequences.map((c, i) => (
                                            <li key={i}>{c}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-850 space-y-1.5">
                                    <span className="text-[10px] font-black uppercase text-blue-400 font-mono block">
                                        Thematic & World Shift
                                    </span>
                                    <p className="text-neutral-300 italic">
                                        "{selectedBranch.thematicShift}"
                                    </p>
                                </div>
                            </div>

                            {/* Screenplay Excerpt */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-neutral-400 font-mono tracking-wider block">
                                    Divergent Scene Screenplay Excerpt:
                                </span>
                                <div
                                    className="bg-black/80 border border-neutral-800 p-4 rounded-lg font-mono text-xs text-neutral-200 leading-relaxed max-h-56 overflow-y-auto custom-scrollbar whitespace-pre-wrap"
                                    style={{ fontFamily: 'Courier, "Courier New", monospace' }}
                                >
                                    {selectedBranch.screenplayExcerpt}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
