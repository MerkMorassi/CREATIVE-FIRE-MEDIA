
import React, { useState, useEffect, useRef } from 'react';
import { 
    EditIcon, 
    ScriptIcon, 
    DownloadIcon, 
    ShuffleIcon, 
    AutomationIcon, 
    ChevronDownIcon, 
    LoadingSpinner,
    LibraryIcon,
    BookmarkIcon
} from './icons.tsx';
import { DuplicateIcon } from './icons/DuplicateIcon';
import { WandIcon } from './icons/WandIcon';
import { runScribeAgent, runScribeOutlineAgent, ScribeOutlineOutput } from '../services/geminiService';
import { generateRandomConfig } from '../services/scribeRandomizer';
import { ScriptFile, ActiveView, PromptTemplate, DynamicPromptList } from '../types';
import { MythosData } from '../services/mythosData';
import { CONTENT_GUIDELINES } from '../services/contentGuidelines';
import { simpleMarkdownToHtml } from '../utils/textFormatting';

const cleanLiteralNewlines = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/\\n/g, '\n')
        .replace(/<[^>]*>/g, '')
        .trim();
};

const formatToWBStandard = (text: string): string => {
    const cleaned = cleanLiteralNewlines(text);
    return cleaned.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        if (trimmed.startsWith('INT.') || trimmed.startsWith('EXT.')) {
            return ' '.repeat(15) + trimmed.toUpperCase();
        }

        if (trimmed === trimmed.toUpperCase() && trimmed.endsWith(':')) {
            return ' '.repeat(55) + trimmed;
        }

        if (trimmed === trimmed.toUpperCase() && trimmed.length < 30 && !trimmed.includes('.') && !trimmed.includes(':')) {
            return ' '.repeat(35) + trimmed;
        }
        
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            return ' '.repeat(30) + trimmed;
        }

        if (trimmed !== trimmed.toUpperCase() && !trimmed.startsWith('(')) {
             return ' '.repeat(25) + trimmed;
        }

        return ' '.repeat(15) + trimmed;
    }).join('\n');
};

interface ScriptWriterStudioProps {
    onSendToScriptsBin: (script: Omit<ScriptFile, 'id' | 'date'>) => void;
    onNavigate: (view: ActiveView) => void;
    promptTemplates: PromptTemplate[];
    dynamicPromptLists: DynamicPromptList[];
}

export const ScriptWriterStudio: React.FC<ScriptWriterStudioProps> = ({ 
    onSendToScriptsBin, 
    onNavigate,
    promptTemplates,
    dynamicPromptLists
}) => {
    const [isStep1Open, setIsStep1Open] = useState(true);
    const [isStep2Open, setIsStep2Open] = useState(true);
    const [isStep3Open, setIsStep3Open] = useState(true);
    const [isStep4Open, setIsStep4Open] = useState(true);

    const [initialTitle, setInitialTitle] = useState('PROJ_ABSURDIST_784');
    const [genre, setGenre] = useState('EXPERIMENTAL');
    const [theme, setTheme] = useState('identity_crisis');
    const [setting, setSetting] = useState('Static TV Screen');
    const [tone, setTone] = useState('EXPERIMENTAL // ABSURDIST');
    const [cast, setCast] = useState('--- ROLE: PROTAGONIST ---\nARCHETYPE: The Hero\nNOTE: Must embody the traits of the ABSURDIST sub-genre.');
    const [beatSheet, setBeatSheet] = useState('--- GENRE PROTOCOL: ABSURDIST ---\nCharacters experience situations suggesting no central purpose to life.\n\n--- THEMATIC ANCHOR ---\n"Does the mask eventually become the face?"');
    
    const [rating, setRating] = useState('R');
    const [format, setFormat] = useState('Feature_Film');
    const [positiveConstraints, setPositiveConstraints] = useState('');
    const [negativeConstraints, setNegativeConstraints] = useState('');

    const [workingTitle, setWorkingTitle] = useState('');
    const [logline, setLogline] = useState('');
    const [treatment, setTreatment] = useState('');
    const [fundamentalStoryQuestions, setFundamentalStoryQuestions] = useState<string[]>([]);

    const [generatedOutline, setGeneratedOutline] = useState<ScribeOutlineOutput | null>(null);
    const [generatedScreenplay, setGeneratedScreenplay] = useState<string>('');
    const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
    const [isGeneratingScreenplay, setIsGeneratingScreenplay] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeOutputTab, setActiveOutputTab] = useState<'outline' | 'screenplay'>('outline');
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const genresData = MythosData.genres;

    useEffect(() => {
        if (!genre && Object.keys(genresData).length > 0) {
            setGenre(Object.keys(genresData)[0]);
        }
    }, [genre, genresData]);

    const showCopyFeedback = (msg: string) => {
        setCopyFeedback(msg);
        setTimeout(() => setCopyFeedback(null), 2000);
    };

    const handleApplyRating = (ratingKey: string) => {
        setRating(ratingKey);
        if (ratingKey === 'none') {
            setPositiveConstraints('');
            setNegativeConstraints('');
            return;
        }
        const guidelines = CONTENT_GUIDELINES.RATINGS[ratingKey as keyof typeof CONTENT_GUIDELINES.RATINGS];
        if (guidelines) {
            setPositiveConstraints(guidelines.positive);
            setNegativeConstraints((guidelines as any).negative || '');
            showCopyFeedback(`${guidelines.name} Protocols Set`);
        }
    };

    const handleRandomize = async () => {
        try {
            setError(null);
            setGeneratedScreenplay('');
            setGeneratedOutline(null);
            
            const config = await generateRandomConfig();
            setInitialTitle(config.title);
            setGenre(config.genre);
            setTheme(config.theme);
            setSetting(config.setting);
            setTone(config.tone);
            setCast(config.cast);
            setBeatSheet(config.beatSheet);
            setRating(config.rating || 'R');
            setFormat(config.format || 'Feature_Film');
            
            setWorkingTitle(config.workingTitle);
            setLogline(config.logline);
            setTreatment(config.treatment);
            setFundamentalStoryQuestions(config.fundamentalStoryQuestions.split('\n'));
            showCopyFeedback("Lattice Re-Rolled");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to randomize configuration.");
        }
    };

    const handleExecuteOutlineProtocol = async () => {
        if (!initialTitle.trim() || !genre.trim() || !theme.trim() || !beatSheet.trim() || !cast.trim()) {
            setError("Title, Genre, Theme, Cast, and Beats are required.");
            return;
        }
        setIsGeneratingOutline(true);
        setError(null);
        try {
            const result = await runScribeOutlineAgent({ 
                title: initialTitle, 
                genre, 
                theme, 
                setting, 
                tone, 
                cast, 
                beatSheet,
                rating: rating !== 'none' ? rating : undefined,
                format: format !== 'none' ? format : undefined,
                positiveConstraints: positiveConstraints.trim() || undefined,
                negativeConstraints: negativeConstraints.trim() || undefined,
                dynamicLists: dynamicPromptLists
            });
            setGeneratedOutline(result);
            setWorkingTitle(result.workingTitle);
            setLogline(result.logline);
            setTreatment(result.treatment);
            setFundamentalStoryQuestions(result.fundamentalStoryQuestions);
            setActiveOutputTab('outline');
            setIsStep3Open(true);
            setTimeout(() => {
                document.getElementById('step-3-outline')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Outline generation failed.");
        } finally {
            setIsGeneratingOutline(false);
        }
    };

    const handleGenerateScreenplay = async () => {
        if (!workingTitle.trim() || !isOutlineReady) {
            setError("Please execute Outline Protocol first.");
            return;
        }
        setIsGeneratingScreenplay(true);
        setError(null);
        try {
            const result = await runScribeAgent({ 
                workingTitle, 
                genre, 
                theme, 
                setting, 
                tone, 
                cast, 
                beatSheet, 
                logline, 
                treatment, 
                fundamentalStoryQuestions: fundamentalStoryQuestions.join('\n'), 
                archetypalCharacters: generatedOutline?.archetypalCharacters.join('\n') || '', 
                sceneGenerationQuestions: generatedOutline?.sceneGenerationQuestions.join('\n') || '',
                rating: rating !== 'none' ? rating : undefined,
                format: format !== 'none' ? format : undefined,
                positiveConstraints: positiveConstraints.trim() || undefined,
                negativeConstraints: negativeConstraints.trim() || undefined,
                dynamicLists: dynamicPromptLists
            });
            setGeneratedScreenplay(result);
            setActiveOutputTab('screenplay');
            setIsStep4Open(true);
            setTimeout(() => {
                document.getElementById('step-4-report')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Screenplay generation failed.");
        } finally {
            setIsGeneratingScreenplay(false);
        }
    };

    const handleSendToBin = () => {
        if (generatedScreenplay) {
            onSendToScriptsBin({
                title: workingTitle || initialTitle,
                content: generatedScreenplay,
                type: 'screenplay'
            });
            showCopyFeedback("Draft sent to Scripts Bin");
        }
    };

    const handleCopyStep1 = () => {
        const text = `STUDIO PROTOCOLS\nRating: ${rating}\nFormat: ${format}\nMust Include: ${positiveConstraints}\nForbidden: ${negativeConstraints}`;
        navigator.clipboard.writeText(text);
        showCopyFeedback("Protocols Copied");
    };

    const handleCopyStep2 = () => {
        const text = `PRODUCTION BLUEPRINT\nTitle: ${initialTitle}\nGenre: ${genre}\nTheme: ${theme}\nSetting: ${setting}\n\nCAST:\n${cast}\n\nBEATS:\n${beatSheet}`;
        navigator.clipboard.writeText(text);
        showCopyFeedback("Blueprint Copied");
    };

    const handleCopyStep3 = () => {
        const text = `AI SYNTHESIZED OUTLINE\nTitle: ${workingTitle}\nLogline: ${logline}\n\nTreatment:\n${treatment}`;
        navigator.clipboard.writeText(text);
        showCopyFeedback("Outline Copied");
    };

    const handleCopyStep4 = () => {
        const text = activeOutputTab === 'screenplay' ? generatedScreenplay : `FINAL REPORT\nTitle: ${workingTitle}\nLogline: ${logline}\n\nTreatment:\n${treatment}`;
        navigator.clipboard.writeText(text);
        showCopyFeedback(activeOutputTab === 'screenplay' ? "Screenplay Copied" : "Report Copied");
    };

    const isOutlineReady = workingTitle.trim() && logline.trim() && treatment.trim() && fundamentalStoryQuestions.length > 0;

    const StepHeader: React.FC<{ 
        number: number; 
        title: string; 
        isOpen: boolean; 
        onToggle: () => void;
        onCopy: () => void;
        icon: React.ReactNode;
        extra?: React.ReactNode;
        themeColor?: string;
        disabled?: boolean;
    }> = ({ number, title, isOpen, onToggle, onCopy, icon, extra, themeColor = "text-brand", disabled = false }) => (
        <div className={`w-full flex items-center justify-between px-6 py-4 bg-secondary border-b border-accent ${disabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
            <button onClick={onToggle} className="flex items-center gap-4 flex-grow text-left group">
                <div className={`${themeColor} p-1 transition-transform group-hover:scale-110`}>{icon}</div>
                <h3 className="text-sm font-black text-white uppercase tracking-[0.25em]">STEP {number}: {title}</h3>
            </button>
            <div className="flex items-center gap-3">
                {extra}
                <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="p-2 text-neutral-500 hover:text-white transition-colors" title="Copy text">
                    <DuplicateIcon className="w-4 h-4" />
                </button>
                <button onClick={onToggle} className="p-1">
                    <ChevronDownIcon className={`w-6 h-6 ${themeColor} transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-primary overflow-hidden">
            <div className="flex-shrink-0 flex justify-between items-center h-16 px-6 border-b border-accent bg-secondary/50 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand/20 rounded-lg text-brand"><EditIcon className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Script Writer Studio</h2>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest leading-none">MythOS Scribe / Version 4.2</p>
                    </div>
                </div>
                {copyFeedback && <div className="bg-green-600/20 text-green-400 px-4 py-1.5 rounded-full text-xs font-black border border-green-500/30 animate-fade-in shadow-xl">{copyFeedback}</div>}
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-8 pb-40">
                <div className="bg-surface border border-accent rounded-xl overflow-hidden shadow-2xl transition-all duration-500">
                    <StepHeader 
                        number={1} title="STUDIO PROTOCOLS" isOpen={isStep1Open} onToggle={() => setIsStep1Open(!isStep1Open)} 
                        onCopy={handleCopyStep1}
                        icon={<BookmarkIcon className="w-5 h-5" />}
                    />
                    {isStep1Open && (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-secondary animate-fade-in">
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase mb-2 block tracking-widest">Production Rating Standard</label>
                                <select value={rating} onChange={(e) => handleApplyRating(e.target.value)} className="w-full bg-primary border border-accent p-4 rounded-lg text-sm text-brand font-black outline-none focus:ring-2 focus:ring-brand appearance-none pr-10 cursor-pointer">
                                    <option value="none">- NONE (Unrestricted) -</option>
                                    {Object.entries(CONTENT_GUIDELINES.RATINGS).map(([key, val]) => (
                                        <option key={key} value={key}>{val.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-neutral-500 uppercase mb-2 block tracking-widest">Target Format</label>
                                <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full bg-primary border border-accent p-4 rounded-lg text-sm text-blue-400 font-black outline-none focus:ring-2 focus:ring-brand appearance-none pr-10 cursor-pointer">
                                    <option value="Feature_Film">Feature Film (Standard)</option>
                                    <option value="Netflix_Limited">Netflix Series (Binge)</option>
                                    <option value="AppleTV_Prestige">Apple TV+ (Prestige)</option>
                                    <option value="Network_Procedural">Network TV (Episodic)</option>
                                    <option value="Indie_Experimental">Indie / Experimental / Vogue</option>
                                    <option value="Short_Film">Short Film</option>
                                </select>
                            </div>
                            <textarea value={positiveConstraints} onChange={(e) => setPositiveConstraints(e.target.value)} placeholder="Must Include..." className="w-full h-32 bg-primary border border-accent rounded-lg text-sm text-neutral-100 p-4" />
                            <textarea value={negativeConstraints} onChange={(e) => setNegativeConstraints(e.target.value)} placeholder="Forbidden..." className="w-full h-32 bg-primary border border-accent rounded-lg text-sm text-neutral-100 p-4" />
                        </div>
                    )}
                </div>

                <div className="bg-surface border border-accent rounded-xl overflow-hidden shadow-2xl transition-all duration-500">
                    <StepHeader 
                        number={2} title="PRODUCTION BLUEPRINT" isOpen={isStep2Open} onToggle={() => setIsStep2Open(!isStep2Open)} 
                        onCopy={handleCopyStep2} icon={<ScriptIcon className="w-6 h-6" />} themeColor="text-blue-400"
                        extra={<button onClick={handleRandomize} className="px-3 py-1.5 bg-brand/10 hover:bg-brand text-brand hover:text-white rounded-lg flex items-center gap-2 border border-brand/20 font-black uppercase text-[9px] tracking-widest transition-all"><ShuffleIcon className="w-3.5 h-3.5" /> Re-Roll</button>}
                    />
                    {isStep2Open && (
                        <div className="p-8 space-y-10 animate-fade-in bg-secondary">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                <input type="text" value={initialTitle} onChange={(e) => setInitialTitle(e.target.value)} className="w-full bg-primary border border-accent p-4 rounded-lg text-base text-white focus:ring-2 focus:ring-brand outline-none font-black" placeholder="Title" />
                                <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-primary border border-accent p-4 rounded-lg text-base text-white focus:ring-2 focus:ring-brand outline-none">
                                    {Object.keys(genresData).map(g => <option key={g} value={g}>{g.replace(/_/g, ' ').toUpperCase()}</option>)}
                                </select>
                                <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full bg-primary border border-accent p-4 rounded-lg text-base text-white focus:ring-2 focus:ring-brand outline-none" placeholder="Theme" />
                                <input type="text" value={setting} onChange={(e) => setSetting(e.target.value)} className="w-full bg-primary border border-accent p-4 rounded-lg text-base text-white focus:ring-2 focus:ring-brand outline-none" placeholder="Setting" />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <textarea value={cast} onChange={(e) => setCast(e.target.value)} className="w-full h-64 bg-primary border border-accent p-6 rounded-xl text-sm text-neutral-300 font-mono" placeholder="Cast" />
                                <textarea value={beatSheet} onChange={(e) => setBeatSheet(e.target.value)} className="w-full h-64 bg-primary border border-accent p-6 rounded-xl text-sm text-neutral-300 font-mono" placeholder="Beats" />
                            </div>
                            <div className="pt-8 flex justify-center">
                                <button onClick={handleExecuteOutlineProtocol} disabled={isGeneratingOutline} className="px-16 py-6 bg-brand hover:bg-brand-hover text-white font-black uppercase text-xs tracking-[0.5em] rounded-xl transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 disabled:opacity-50">
                                    {isGeneratingOutline ? <LoadingSpinner className="w-6 h-6 text-white" /> : <><WandIcon className="w-6 h-6" /> Execute Protocol</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {(generatedOutline || isGeneratingOutline) && (
                    <div id="step-3-outline" className="bg-surface border border-accent rounded-xl overflow-hidden shadow-2xl transition-all duration-500">
                        <StepHeader 
                            number={3} title="AI SYNTHESIZED OUTLINE" isOpen={isStep3Open} onToggle={() => setIsStep3Open(!isStep3Open)} 
                            onCopy={handleCopyStep3} icon={<AutomationIcon className="w-5 h-5" />} themeColor="text-blue-500"
                        />
                        {isStep3Open && (
                            <div className="p-8 space-y-8 animate-fade-in bg-secondary">
                                {isGeneratingOutline ? (
                                    <div className="py-24 flex flex-col items-center justify-center gap-6 text-neutral-500">
                                        <LoadingSpinner className="w-12 h-12" />
                                        <p className="font-black uppercase tracking-[0.6em] text-xs animate-pulse">Calculating Story Dynamics...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8 max-w-5xl mx-auto">
                                        <div className="border-b border-accent pb-8">
                                            <h3 className="text-4xl font-black text-blue-400 tracking-tighter uppercase">{cleanLiteralNewlines(workingTitle)}</h3>
                                            <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-2">Active Production Cycle / Version 1.0</p>
                                        </div>

                                        <div className="grid grid-cols-1 gap-10">
                                            <div className="space-y-4">
                                                <label className="text-[11px] font-black text-neutral-500 uppercase tracking-widest block border-l-2 border-brand pl-3">Narrative Premise (Logline)</label>
                                                <div 
                                                    className="prose prose-invert prose-lg max-w-none text-neutral-200 italic font-serif leading-relaxed bg-primary/20 p-6 rounded-xl border border-white/5"
                                                    dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(logline) }}
                                                />
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[11px] font-black text-neutral-500 uppercase tracking-widest block border-l-2 border-brand pl-3">Production Beats (Treatment)</label>
                                                <div 
                                                    className="prose prose-invert prose-neutral max-w-none bg-primary/30 p-8 rounded-xl border border-white/5 min-h-[200px]"
                                                    dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(treatment) }}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-8 flex justify-center border-t border-accent">
                                            <button onClick={handleGenerateScreenplay} disabled={isGeneratingScreenplay || !isOutlineReady} className="w-full md:w-auto px-20 py-6 bg-brand hover:bg-brand-hover text-white font-black uppercase text-xs tracking-[0.5em] rounded-xl transition-all flex items-center justify-center gap-4 shadow-2xl active:scale-95 disabled:opacity-50">
                                                {isGeneratingScreenplay ? <LoadingSpinner className="w-6 h-6 text-white" /> : <><ScriptIcon className="w-6 h-6" /> Generate Full First Draft</>}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(generatedScreenplay || isGeneratingScreenplay) && (
                    <div id="step-4-report" className="bg-surface border border-accent rounded-xl overflow-hidden shadow-2xl transition-all duration-500">
                        <StepHeader 
                            number={4} title="FINAL PRODUCTION REPORT" isOpen={isStep4Open} onToggle={() => setIsStep4Open(!isStep4Open)} 
                            onCopy={handleCopyStep4} icon={<div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-lg shadow-green-900/50"></div>} themeColor="text-green-500"
                            extra={<button onClick={() => {}} className="text-[11px] font-black text-brand hover:text-brand-hover px-5 py-2.5 flex items-center gap-2 border border-brand/20 hover:border-brand/50 rounded-lg transition-all uppercase tracking-widest active:scale-95"><DownloadIcon className="w-4 h-4" /> Export .txt</button>}
                        />
                        {isStep4Open && (
                            <div className="animate-fade-in bg-secondary flex flex-col">
                                {isGeneratingScreenplay ? (
                                    <div className="py-32 flex flex-col items-center justify-center gap-8 text-neutral-500">
                                        <LoadingSpinner className="w-16 h-16" />
                                        <p className="font-black uppercase tracking-[1em] text-xs animate-pulse">Transcribing Vision into Narrative Structure...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-2.5 bg-primary/50 border-b border-accent flex gap-2.5">
                                            <button onClick={() => setActiveOutputTab('outline')} className={`flex-1 py-5 text-[11px] font-black uppercase tracking-[0.3em] rounded-lg transition-all ${activeOutputTab === 'outline' ? 'bg-surface text-white shadow-xl ring-1 ring-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}>Outline Analysis</button>
                                            <button onClick={() => setActiveOutputTab('screenplay')} className={`flex-1 py-5 text-[11px] font-black uppercase tracking-[0.3em] rounded-lg transition-all ${activeOutputTab === 'screenplay' ? 'bg-surface text-white shadow-xl ring-1 ring-white/10' : 'text-neutral-500 hover:text-neutral-300'}`}>First Draft</button>
                                        </div>

                                        <div className="flex-grow bg-primary/60 p-4 md:p-16 font-mono text-sm leading-loose overflow-y-auto min-h-[600px]">
                                            {activeOutputTab === 'outline' ? (
                                                <div className="text-neutral-300 animate-fade-in space-y-16 max-w-5xl mx-auto">
                                                    <div className="text-center border-b border-accent pb-12">
                                                        <h3 className="text-5xl font-black text-blue-400 mb-4 tracking-tighter uppercase">{cleanLiteralNewlines(workingTitle)}</h3>
                                                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.8em]">Technical Story Matrix / Final Review</p>
                                                    </div>
                                                    <div className="flex flex-col gap-16">
                                                        <div className="space-y-12">
                                                            <div>
                                                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.5em] block mb-6 border-l-4 border-blue-500 pl-4">Logline Premise</label>
                                                                <div className="prose prose-invert prose-lg max-w-none text-neutral-100 italic font-serif" dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(logline) }} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.5em] block mb-6 border-l-4 border-blue-500 pl-4">Treatment Breakdown (Production Beats)</label>
                                                                <div className="prose prose-invert prose-base prose-neutral max-w-none text-neutral-400 leading-loose" dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(treatment) }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-white animate-fade-in max-w-4xl mx-auto whitespace-pre-wrap" style={{ fontFamily: 'Courier, "Courier New", monospace' }}>
                                                    <div className="mb-12 md:mb-28 text-center opacity-30 text-[11px] font-black border-y border-white/10 py-8 tracking-[1.5em]">--- SCRIBE FIRST DRAFT ---</div>
                                                    <div className="px-4 md:px-12 text-base leading-relaxed">{formatToWBStandard(generatedScreenplay)}</div>
                                                    <div className="mt-24 md:mt-56 text-center opacity-30 text-[11px] tracking-[1em] font-black">FADE OUT.</div>
                                                </div>
                                            )}
                                        </div>
                                        {activeOutputTab === 'screenplay' && generatedScreenplay && (
                                            <div className="p-6 bg-surface border-t border-accent flex justify-center">
                                                <button onClick={handleSendToBin} className="px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-[0.5em] rounded-xl transition-all shadow-xl active:scale-95">Send to Scripts Bin</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {error && <div className="fixed bottom-10 right-10 p-6 bg-red-900/90 border-2 border-red-500 text-white rounded-xl text-xs font-black tracking-[0.2em] shadow-[0_0_40px_rgba(239,68,68,0.4)] backdrop-blur-2xl animate-slide-in-up z-[200]">{error}</div>}
        </div>
    );
};
