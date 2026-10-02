

import React, { useState } from 'react';
import { ActiveView } from '../../types';
import { MediaInput } from '../../components/MediaInput';
import { 
    AnalyzerIcon, CameraLensIcon, ChatIcon, ImageIcon, ClapperboardIcon, 
    StoryboardIcon, PinIcon, BlenderIcon, LayersIcon, SwapIcon, 
    PhotoRealismIcon, MagicIcon, FaceSparkleIcon, PuzzleIcon, ExpandIcon, ScissorsIcon, WandIcon, EditIcon,
    TransitionIcon, DollyIcon
} from '../../components/icons';
import { PlusIcon } from '../../components/icons/PlusIcon';
import { analyzeImage, analyzeVideo } from './service';
import { AnalysisResult } from '../../components/AnalysisResult';
import { AgentChatView } from '../../components/AgentChatView';
import { getAgent } from '../../services/agentService';

interface DirectorStudioProps {
    onNavigate?: (view: ActiveView) => void;
}

interface StudioCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    isExternal?: boolean;
    color?: string;
}

const StudioCard: React.FC<StudioCardProps> = ({ title, description, icon, onClick, isExternal, color = "text-neutral-400" }) => (
    <div 
        onClick={onClick}
        className="bg-neutral-800/50 border border-neutral-700 hover:border-blue-500/50 hover:bg-neutral-800 rounded-xl p-5 cursor-pointer transition-all group h-full flex flex-col shadow-sm hover:shadow-md"
    >
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 bg-neutral-900 rounded-lg ${color} group-hover:text-white group-hover:bg-blue-600/20 transition-colors`}>
                {icon}
            </div>
            {isExternal && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-500 border border-neutral-700 px-1.5 py-0.5 rounded">Ext</span>
            )}
        </div>
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{title}</h3>
        <p className="text-xs text-neutral-400 leading-relaxed flex-grow">{description}</p>
    </div>
);

const ToolCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-neutral-900/50 border border-neutral-800 hover:border-green-500/50 hover:bg-neutral-800/80 rounded-xl p-5 cursor-pointer transition-all group shadow-lg"
    >
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-neutral-800 rounded-lg text-green-400 group-hover:bg-green-900/30 transition-colors">
                {icon}
            </div>
            <h3 className="font-bold text-white group-hover:text-green-300 transition-colors">{title}</h3>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">{description}</p>
    </div>
);


const FOCUS_TAGS = {
    "Lighting": ["Key Light Direction", "Hard vs Soft Light", "Contrast Ratio", "Practical Sources", "Volumetric Lighting"],
    "Camera & Lens": ["Focal Length Est.", "Depth of Field", "Camera Angle", "Lens Distortion", "Sensor Size/Format"],
    "Color & Mood": ["Color Palette", "Skin Tones", "Grading Style", "Film Grain/Texture", "Emotional Tone"],
    "Composition": ["Rule of Thirds", "Leading Lines", "Framing/Blocking", "Negative Space", "Aspect Ratio"]
};

export const DirectorStudio: React.FC<DirectorStudioProps> = ({ onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'hub' | 'analyzer' | 'chat'>('hub');
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [clearKey, setClearKey] = useState(0);
    
    // New state for deferred analysis
    const [selectedMedia, setSelectedMedia] = useState<{ type: 'video' | 'image'; source: File | string | null } | null>(null);
    const [userDirectives, setUserDirectives] = useState('');

    const kineAgent = getAgent(); // Or specifically find Kine from team

    const handleMediaChange = (media: { type: 'video' | 'image'; source: File | string | null }) => {
        setSelectedMedia(media);
        setAnalysis(null); // Clear previous results but stay in "ready to analyze" state
    };

    const handleAddTag = (tag: string) => {
        setUserDirectives(prev => {
            const trimmed = prev.trim();
            if (trimmed.length > 0 && !trimmed.endsWith(',')) {
                return `${trimmed}, ${tag}`;
            }
            return trimmed ? `${trimmed} ${tag}` : tag;
        });
    };

    const handleAnalyze = async () => {
        if (!selectedMedia || !selectedMedia.source) return;
        
        setIsAnalyzing(true);
        setAnalysis(null);
        
        try {
            // FIX: No need to retrieve apiKey manually, it's handled in the service/SDK.
            let result;

            if (selectedMedia.type === 'image') {
                let base64 = '';
                let mimeType = '';

                if (typeof selectedMedia.source === 'string') {
                    // Handle URL if passed directly (uncommon for image unless from grid)
                    console.warn("URL analysis not fully implemented for images in this view");
                    setIsAnalyzing(false);
                    return;
                } else {
                    const file = selectedMedia.source;
                    mimeType = file.type;
                    const reader = new FileReader();
                    base64 = await new Promise<string>((resolve) => {
                        reader.onload = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                }
                
                // FIX: Remove apiKey argument
                result = await analyzeImage(base64, mimeType, userDirectives);

            } else if (selectedMedia.type === 'video') {
                let videoUrl = '';
                if (typeof selectedMedia.source === 'string') {
                    videoUrl = selectedMedia.source;
                } else {
                    videoUrl = URL.createObjectURL(selectedMedia.source);
                }
                
                // FIX: Remove apiKey argument
                result = await analyzeVideo(videoUrl, userDirectives);
            }

            if (result) {
                const formattedResult = `
### Subject
${result.subject}

### Lighting
${result.lighting}

### Camera & Lens
${result.camera}

### Color & Mood
${result.color}

### Composition
${result.composition}

### Extracted Prompt
\`${result.extractedPrompt}\`
                `;
                setAnalysis(formattedResult);
            }

        } catch (e) {
            console.error("Analysis failed", e);
            setAnalysis(`Analysis failed: ${e instanceof Error ? e.message : "Unknown error"}. Please check the logs.`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClear = () => {
        setAnalysis(null);
        setSelectedMedia(null);
        setUserDirectives('');
        setClearKey(prev => prev + 1);
    };

    const navigateTo = (view: ActiveView) => {
        if (onNavigate) onNavigate(view);
    };

    return (
        <div className="flex flex-col h-full bg-primary text-text-primary">
            {activeTab === 'hub' && (
                <div className="p-8 max-w-7xl mx-auto w-full overflow-y-auto custom-scrollbar">
                    <div className="mb-10 text-center">
                        <div className="inline-block p-4 rounded-full bg-neutral-800 mb-4 border border-neutral-700 shadow-xl">
                            <AnalyzerIcon className="w-12 h-12 text-blue-500" />
                        </div>
                        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Visual Director (Kine)</h1>
                        <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
                            Advanced cinematography analysis, asset generation, and visual effects command center.
                        </p>
                    </div>

                    <div className="space-y-8 pb-10">
                        {/* Agent Tool Arsenal */}
                        <div>
                            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-800 pb-2">Agent Tool Arsenal</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <ToolCard 
                                    title="Generate Image (MythOS)" 
                                    description="Autonomous agent tool to generate high-quality cinematic images from a text prompt. Any agent can call this to visualize concepts."
                                    icon={<ImageIcon className="w-5 h-5"/>}
                                    onClick={() => navigateTo('mythos-cinematic-engine')}
                                />
                                <ToolCard 
                                    title="Generate Video (Veo)" 
                                    description="Autonomous agent tool to create short video clips. Powered by Google's Veo model to animate scenes or establish mood."
                                    icon={<ClapperboardIcon className="w-5 h-5"/>}
                                    onClick={() => navigateTo('generative-video')}
                                />
                                <ToolCard 
                                    title="Prepare Generation" 
                                    description="Tool to formulate a detailed prompt and navigate the user to the correct studio, priming the engine for generation."
                                    icon={<WandIcon className="w-5 h-5"/>}
                                    onClick={() => navigateTo('image-generator')}
                                />
                            </div>
                        </div>

                        {/* Core Analysis & Chat */}
                        <div>
                            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-800 pb-2">Analysis & Direction</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <StudioCard 
                                    title="Visual Analyzer" 
                                    description="Upload reference images or video to extract cinematography data, lighting setups, and prompts."
                                    icon={<AnalyzerIcon className="w-6 h-6"/>}
                                    onClick={() => setActiveTab('analyzer')}
                                    color="text-blue-400"
                                />
                                <StudioCard 
                                    title="Director Chat" 
                                    description="Discuss visual style, lenses, and lighting with Kine, your AI Director of Photography."
                                    icon={<ChatIcon className="w-6 h-6"/>}
                                    onClick={() => setActiveTab('chat')}
                                    color="text-green-400"
                                />
                                <StudioCard 
                                    title="MythOS Cinematic" 
                                    description="Next-gen Illustrious SDXL engine for high-fidelity, cinematic still photography."
                                    icon={<CameraLensIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('mythos-cinematic-engine')}
                                    color="text-purple-400"
                                    isExternal
                                />
                            </div>
                        </div>

                        {/* Generation Tools */}
                        <div>
                            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-800 pb-2">Generation Suite</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StudioCard 
                                    title="Image Studio" 
                                    description="Generate conceptual images and storyboards using standard models."
                                    icon={<ImageIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('image-generator')}
                                />
                                <StudioCard 
                                    title="One-Shot Cinematic" 
                                    description="Generate a single, high-quality cinematic shot with a pre-defined style from a simple prompt."
                                    icon={<MagicIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('one-shot-cinematic')}
                                />
                                <StudioCard 
                                    title="UHD Generator" 
                                    description="Create massive 4K+ detailed renders for final assets."
                                    icon={<PhotoRealismIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('photorealism')}
                                />
                                <StudioCard 
                                    title="Video Creator" 
                                    description="Turn images into cinematic video clips using Wan 2.2."
                                    icon={<ClapperboardIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('generative-video')}
                                />
                                <StudioCard 
                                    title="Wanimate Studio" 
                                    description="Create continuous video by animating from a start frame to an optional end frame."
                                    icon={<ClapperboardIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('wanimate-studio')}
                                />
                                <StudioCard 
                                    title="Storyboard" 
                                    description="Assemble your generated assets into a narrative sequence."
                                    icon={<StoryboardIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('story')}
                                />
                            </div>
                        </div>

                        {/* VFX & Utilities */}
                        <div>
                            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-800 pb-2">VFX & Post-Production</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                 <StudioCard 
                                    title="Camera Dolly (LTX)"
                                    description="Apply professional camera movements like dolly, crane, and pan to static images."
                                    icon={<DollyIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('camera-movement')}
                                />
                                <StudioCard 
                                    title="Camera Moves (ReCam)"
                                    description="Apply simulated camera movements (orbit, pan, tilt) to existing video clips."
                                    icon={<DollyIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('camera-moves')}
                                />
                                <StudioCard 
                                    title="Transition Studio" 
                                    description="Generate a smooth video transition between a start and end keyframe."
                                    icon={<TransitionIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('transition-studio')}
                                />
                                <StudioCard 
                                    title="Blender" 
                                    description="Mix concepts and styles from multiple images."
                                    icon={<BlenderIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('blender')}
                                />
                                <StudioCard 
                                    title="Compositor" 
                                    description="Place characters into backgrounds with auto-masking."
                                    icon={<LayersIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('scene-compositor')}
                                />
                                <StudioCard 
                                    title="DreamO Composite" 
                                    description="Advanced identity and style fusion."
                                    icon={<PuzzleIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('composite')}
                                />
                                <StudioCard 
                                    title="Face Swap" 
                                    description="Replace actor identities in scenes."
                                    icon={<SwapIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('face-swap')}
                                />
                                <StudioCard 
                                    title="Face Repair" 
                                    description="Restore and enhance facial details."
                                    icon={<FaceSparkleIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('face-repair')}
                                />
                                <StudioCard 
                                    title="Resize / Outpaint" 
                                    description="Expand image borders and change aspect ratios."
                                    icon={<ExpandIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('resize')}
                                />
                                <StudioCard 
                                    title="Green Screen" 
                                    description="Remove video backgrounds automatically."
                                    icon={<ScissorsIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('green-screen')}
                                />
                                <StudioCard 
                                    title="BG Remover" 
                                    description="High-precision automatic background removal."
                                    icon={<ScissorsIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('background-removal')}
                                />
                                <StudioCard 
                                    title="Qwen Edit" 
                                    description="Multi-image composition and editing."
                                    icon={<EditIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('qwen-image-edit')}
                                />
                                <StudioCard 
                                    title="Enhance (Topaz)" 
                                    description="Professional upscaling and restoration."
                                    icon={<MagicIcon className="w-6 h-6"/>}
                                    onClick={() => navigateTo('topaz')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab !== 'hub' && (
                <div className="flex-shrink-0 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto flex items-center">
                        <button 
                            onClick={() => setActiveTab('hub')} 
                            className="px-6 py-4 text-sm font-bold text-neutral-400 hover:text-white border-r border-neutral-800 transition-colors"
                        >
                            ← Hub
                        </button>
                        <div className="flex">
                            <button 
                                onClick={() => setActiveTab('analyzer')} 
                                className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'analyzer' ? 'text-white border-blue-500 bg-neutral-800/50' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
                            >
                                <AnalyzerIcon className="w-4 h-4" /> Visual Analyzer
                            </button>
                            <button 
                                onClick={() => setActiveTab('chat')} 
                                className={`px-6 py-4 text-sm font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'chat' ? 'text-white border-blue-500 bg-neutral-800/50' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
                            >
                                <ChatIcon className="w-4 h-4" /> Director Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-grow overflow-hidden">
                {activeTab === 'analyzer' && (
                    <div className="h-full overflow-y-auto p-6 max-w-7xl mx-auto w-full custom-scrollbar">
                        <div className="flex flex-col gap-8 pb-20">
                            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg">
                                <h3 className="text-lg font-bold text-white mb-4">Input Reference</h3>
                                <MediaInput key={clearKey} onMediaChange={handleMediaChange} />
                                
                                {selectedMedia && selectedMedia.source && (
                                    <div className="mt-6 pt-6 border-t border-neutral-800 animate-fade-in">
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider block mb-3">Director's Focus / Questions</label>
                                                
                                                {/* Focus Tags / Pills */}
                                                <div className="space-y-3 mb-4">
                                                    {Object.entries(FOCUS_TAGS).map(([category, tags]) => (
                                                        <div key={category} className="flex flex-wrap items-center gap-2">
                                                            <span className="text-[10px] text-neutral-500 font-bold uppercase w-24 flex-shrink-0">{category}</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {tags.map(tag => (
                                                                    <button
                                                                        key={tag}
                                                                        onClick={() => handleAddTag(tag)}
                                                                        className="px-2 py-1 text-[10px] font-medium bg-neutral-800 border border-neutral-700 hover:border-blue-500 hover:text-blue-300 hover:bg-blue-900/20 text-neutral-300 rounded-md transition-all flex items-center gap-1"
                                                                    >
                                                                        <PlusIcon className="w-3 h-3" /> {tag}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <textarea 
                                                    value={userDirectives}
                                                    onChange={(e) => setUserDirectives(e.target.value)}
                                                    placeholder="e.g. Analyze the lighting ratios, identify the exact lens used, or describe the color palette mood..."
                                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-neutral-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-sm"
                                                />
                                            </div>

                                            <div className="flex justify-end gap-3 mt-2">
                                                <button 
                                                    onClick={handleClear}
                                                    className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                                                >
                                                    Cancel / Clear
                                                </button>
                                                <button 
                                                    onClick={handleAnalyze}
                                                    disabled={isAnalyzing}
                                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {isAnalyzing ? (
                                                        <>Analyzing...</>
                                                    ) : (
                                                        <><AnalyzerIcon className="w-4 h-4"/> Analyze Shot</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {isAnalyzing && (
                                <div className="text-center py-12">
                                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p className="text-neutral-400 animate-pulse">Kine is analyzing the shot...</p>
                                </div>
                            )}

                            {analysis && (
                                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-lg animate-fade-in">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-bold text-white">Cinematography Report</h3>
                                        <button onClick={handleClear} className="text-sm text-neutral-500 hover:text-white">Clear</button>
                                    </div>
                                    <AnalysisResult 
                                        result={analysis}
                                        onPlayAudio={() => {}} 
                                        onStopAudio={() => {}}
                                        onGenerateAudio={() => {}}
                                        onReEngineerPrompt={() => {}}
                                        isReEngineering={false}
                                        onForgeArtifact={() => {}}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'chat' && (
                    <AgentChatView agent={kineAgent} />
                )}
            </div>
        </div>
    );
};