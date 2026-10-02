
import React, { useState, useEffect } from 'react';
import { generateImageSDXL } from '../services/huggingFaceService';
import { CameraLensIcon, MagicIcon, LoadingSpinner, LibraryIcon, ShuffleIcon } from './icons.tsx';
import { WarningIcon } from './icons/WarningIcon';
import { AssetActions } from './AssetActions';
import { PromptTemplate, DynamicPromptList } from '../types.ts';

interface MythosCinematicStudioProps {
    hfToken: string;
    promptTemplates: PromptTemplate[];
    dynamicPromptLists: DynamicPromptList[];
    onAddAssetToGrid: (asset: { type: 'image' | 'video'; base64?: string; url?: string; mimeType?: string; metadata?: any }) => void;
    onAddToStoryboard: (base64: string) => void;
    onAddToInspiration: (base64: string) => void;
    initialPrompt?: string;
    onClearInitialPrompt: () => void;
}

const RATIOS = [
    { label: '2.39:1 (Cinema)', w: 1536, h: 640 },
    { label: '16:9 (Wide)', w: 1024, h: 576 },
    { label: '1:1 (Square)', w: 1024, h: 1024 },
    { label: '9:16 (Vertical)', w: 576, h: 1024 },
    { label: '3:2 (Classic)', w: 1024, h: 683 }
];

const CINEMATIC_TIERS = {
    framing: [
        { label: 'Select Framing...', value: '' },
        { label: 'Extreme Long Shot (ELS)', value: '(extreme long shot:1.4), (establishing shot:1.2), wide view' },
        { label: 'Long Shot (LS)', value: '(long shot:1.3), full body visible, environmental context' },
        { label: 'Full Shot (FS)', value: '(full shot:1.3), head to toe visible' },
        { label: 'Medium Shot (MS)', value: '(medium shot:1.2), waist up framing' },
        { label: 'Cowboy Shot (CS)', value: '(cowboy shot:1.2), knees up framing' },
        { label: 'Medium Close Up (MCU)', value: '(medium close up:1.3), chest up framing, dialogue focus' },
        { label: 'Close Up (CU)', value: '(close up:1.4), face focus, emotional' },
        { label: 'Extreme Close Up (ECU)', value: '(extreme close up:1.5), macro details, eye focus, intense' }
    ],
    angle: [
        { label: 'Select Angle...', value: '' },
        { label: 'Eye Level (Neutral)', value: '(eye level shot:1.0), neutral perspective' },
        { label: 'Low Angle (Heroic)', value: '(low angle shot:1.3), looking up, imposing, heroic' },
        { label: 'High Angle (Vulnerable)', value: '(high angle shot:1.3), looking down, vulnerable' },
        { label: 'Dutch Angle (Tension)', value: '(dutch angle:1.3), tilted frame, disorienting, dynamic' },
        { label: 'Bird\'s Eye (Overhead)', value: '(overhead shot:1.4), aerial view, top-down perspective' },
        { label: 'Worm\'s Eye (Ground)', value: '(worm\'s eye view:1.3), ground level, bug perspective' },
        { label: 'Over the Shoulder (OTS)', value: '(over the shoulder shot:1.2), conversational depth' },
        { label: 'Point of View (POV)', value: '(pov shot:1.3), first person perspective' }
    ],
    lens: [
        { label: 'Select Lens...', value: '' },
        { label: 'Wide Angle (14mm-24mm)', value: '(wide angle lens:1.3), (14mm:1.1), deep depth of field, expansive' },
        { label: 'Cinematic Prime (35mm-50mm)', value: '(35mm lens:1.2), natural depth of field, storytelling lens' },
        { label: 'Portrait Telephoto (85mm)', value: '(85mm lens:1.2), flattering perspective, soft background' },
        { label: 'Telephoto (100mm-200mm)', value: '(telephoto lens:1.3), (200mm:1.1), compressed background, strong bokeh' },
        { label: 'Anamorphic (Cinema)', value: '(anamorphic lens:1.4), (oval bokeh:1.2), cinematic flare, horizontal lens flare' },
        { label: 'Macro Lens', value: '(macro lens:1.4), extreme detail, shallow focus' },
        { label: 'Fisheye Lens', value: '(fisheye lens:1.3), distorted edges, ultra wide' }
    ],
    lighting: [
        { label: 'Select Lighting...', value: '' },
        { label: 'Standard / Balanced', value: 'balanced studio lighting, professional exposure' },
        { label: 'Golden Hour', value: '(golden hour:1.3), warm soft lighting, long shadows, sun flare, magic hour' },
        { label: 'Blue Hour', value: '(blue hour:1.3), cold lighting, twilight, moody' },
        { label: 'High-Key (Bright)', value: '(high-key lighting:1.3), bright, low contrast, soft shadows, optimistic' },
        { label: 'Low-Key / Noir', value: '(low-key lighting:1.4), (chiaroscuro:1.3), high contrast, deep shadows, dramatic, mystery' },
        { label: 'Volumetric (Haze)', value: '(volumetric lighting:1.3), god rays, atmospheric haze, fog, depth' },
        { label: 'Rembrandt', value: '(rembrandt lighting:1.3), triangle of light, dramatic portrait' },
        { label: 'Neon / Cyberpunk', value: '(neon lighting:1.3), cyan and magenta, rim lighting, glow' },
        { label: 'Practical / Diegetic', value: 'practical lighting, lamp light, candle light, realistic source' }
    ]
};

export const MythosCinematicStudio: React.FC<MythosCinematicStudioProps> = ({ 
    hfToken, 
    promptTemplates,
    dynamicPromptLists,
    onAddAssetToGrid,
    onAddToStoryboard,
    onAddToInspiration,
    initialPrompt,
    onClearInitialPrompt
}) => {
    const [prompt, setPrompt] = useState('masterpiece, high fidelity, highly detailed technical photography, award winning cinematography, movie still');
    const [negativePrompt, setNegativePrompt] = useState('blurry, low quality, text, watermark, bad anatomy, deformed, sketch, cartoon, 3d render, illustration');
    const [width, setWidth] = useState(RATIOS[0].w);
    const [height, setHeight] = useState(RATIOS[0].h);
    const [seed, setSeed] = useState<number | undefined>(undefined);
    
    const [framing, setFraming] = useState('');
    const [angle, setAngle] = useState('');
    const [lens, setLens] = useState('');
    const [lighting, setLighting] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ base64: string; mimeType: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [wakingError, setWakingError] = useState<string | null>(null);

    useEffect(() => {
        if (initialPrompt) {
            setPrompt(initialPrompt);
            onClearInitialPrompt();
        }
    }, [initialPrompt, onClearInitialPrompt]);

    const handleMatrixChange = (category: keyof typeof CINEMATIC_TIERS, newValue: string) => {
        if (category === 'framing') setFraming(newValue);
        if (category === 'angle') setAngle(newValue);
        if (category === 'lens') setLens(newValue);
        if (category === 'lighting') setLighting(newValue);

        if (!newValue) return;

        setPrompt(current => {
            let updated = current;
            const options = CINEMATIC_TIERS[category];
            
            const existingOption = options.find(opt => opt.value && updated.includes(opt.value));
            
            if (existingOption) {
                updated = updated.replace(existingOption.value, newValue);
            } else {
                updated = `${newValue}, ${updated}`;
            }
            
            return updated.replace(/,\s*,/g, ',').trim();
        });
    };

    const handleInsertPositiveFromTemplate = (templateId: string) => {
        const template = promptTemplates.find(t => t.id === templateId);
        if (template) {
            const cleanContent = template.positivePrompt.replace('{{ANALYSIS_TEXT}}', '').trim();
            if (cleanContent) {
                setPrompt(p => p ? `${cleanContent}, ${p}` : cleanContent);
            }
        }
    };

    const handleInsertNegativeFromTemplate = (templateId: string) => {
        const template = promptTemplates.find(t => t.id === templateId);
        if (template && template.negativePrompt) {
            setNegativePrompt(n => n ? `${template.negativePrompt}, ${n}` : template.negativePrompt);
        }
    };

    const handleInsertDynamic = (listName: string, target: 'positive' | 'negative') => {
        const insertion = `[${listName}]`;
        if (target === 'positive') {
            setPrompt(p => p ? `${p}, ${insertion}` : insertion);
        } else {
            setNegativePrompt(n => n ? `${n}, ${insertion}` : `[${listName}]`);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Subject blueprint required.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setWakingError(null);
        setResult(null);

        try {
            const usedSeed = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
            
            const blob = await generateImageSDXL({
                prompt: prompt,
                negative_prompt: negativePrompt,
                width: width,
                height: height,
                seed: usedSeed,
                num_inference_steps: 50, 
                guidance_scale: 7.5,
                useSuperiorEngine: true 
            }, hfToken);

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                const base64 = base64data.split(',')[1];
                const mimeType = blob.type;
                
                const asset = { base64, mimeType };
                setResult(asset);
                
                onAddAssetToGrid({ 
                    type: 'image', 
                    ...asset, 
                    metadata: { 
                        engine: 'MythOS Docker Core v4.2', 
                        prompt: prompt, 
                        seed: usedSeed, 
                        width, 
                        height,
                        framing,
                        angle,
                        lens,
                        lighting,
                        interface: 'Direct Hardware Link'
                    } 
                });
            };
            reader.readAsDataURL(blob);

        } catch (e) {
            console.error("MythOS Core Error:", e);
            const msg = e instanceof Error ? e.message : "Proprietary GPU Link Refused.";
            if (msg.includes("Hardware Sleeping")) {
                setWakingError(msg);
                setError(null);
            } else {
                setError(msg);
                setWakingError(null);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const TierSelect: React.FC<{ 
        label: string; 
        options: { label: string, value: string }[]; 
        value: string; 
        onChange: (val: string) => void 
    }> = ({ label, options, value, onChange }) => (
        <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{label}</label>
            <select 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-secondary border border-accent p-2 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand transition-shadow"
            >
                {options.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">Engine: MythOS Cinematic Core <span className="text-lg font-normal text-brand">v4.2 (Direct Hardware)</span></h2>
                    <p className="text-neutral-400 font-medium">Native hardware acceleration active. Subdomain: merkmorassi-mythos-engine.hf.space</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`px-3 py-1 border rounded-full text-xs font-bold animate-pulse ${hfToken ? 'bg-blue-900/30 border-blue-500/30 text-blue-300' : 'bg-red-900/30 border-red-500/30 text-red-300'}`}>
                        {hfToken ? 'HARDWARE LINK ACTIVE' : 'AUTH REQUIRED'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-surface p-6 border border-accent rounded-xl space-y-6 h-fit">
                    <div className="bg-secondary/50 p-4 rounded-lg border border-accent space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <CameraLensIcon className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">Cinematography Matrix</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <TierSelect 
                                label="Shot Framing" 
                                options={CINEMATIC_TIERS.framing} 
                                value={framing} 
                                onChange={(val) => handleMatrixChange('framing', val)} 
                            />
                            <TierSelect 
                                label="Camera Angle" 
                                options={CINEMATIC_TIERS.angle} 
                                value={angle} 
                                onChange={(val) => handleMatrixChange('angle', val)} 
                            />
                            <TierSelect 
                                label="Optics / Lens" 
                                options={CINEMATIC_TIERS.lens} 
                                value={lens} 
                                onChange={(val) => handleMatrixChange('lens', val)} 
                            />
                            <TierSelect 
                                label="Lighting Setup" 
                                options={CINEMATIC_TIERS.lighting} 
                                value={lighting} 
                                onChange={(val) => handleMatrixChange('lighting', val)} 
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex flex-col gap-2 mb-2">
                            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Subject Blueprint (Positive)</label>
                            <div className="flex gap-2">
                                <div className="relative group flex-grow">
                                    <select 
                                        onChange={(e) => {
                                            handleInsertPositiveFromTemplate(e.target.value);
                                            e.target.value = "";
                                        }} 
                                        defaultValue="" 
                                        className="w-full appearance-none bg-secondary border border-accent rounded px-2 py-1 text-[10px] text-blue-300 font-bold outline-none cursor-pointer hover:border-brand pr-6"
                                    >
                                        <option value="" disabled>+ Add Positive from Template...</option>
                                        {promptTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <LibraryIcon className="w-3 h-3 text-blue-300 absolute right-2 top-1.5 pointer-events-none" />
                                </div>
                                <div className="relative group flex-grow">
                                    <select 
                                        onChange={(e) => {
                                            handleInsertDynamic(e.target.value, 'positive');
                                            e.target.value = "";
                                        }} 
                                        defaultValue="" 
                                        className="w-full appearance-none bg-secondary border border-accent rounded px-2 py-1 text-[10px] text-green-300 font-bold outline-none cursor-pointer hover:border-green-500 pr-6"
                                    >
                                        <option value="" disabled>+ Dyn 1</option>
                                        {dynamicPromptLists.map(l => <option key={l.id} value={l.name}>[{l.name}]</option>)}
                                    </select>
                                    <ShuffleIcon className="w-3 h-3 text-green-300 absolute right-2 top-1.5 pointer-events-none" />
                                </div>
                                <div className="relative group flex-grow">
                                    <select 
                                        onChange={(e) => {
                                            handleInsertDynamic(e.target.value, 'positive');
                                            e.target.value = "";
                                        }} 
                                        defaultValue="" 
                                        className="w-full appearance-none bg-secondary border border-accent rounded px-2 py-1 text-[10px] text-green-300 font-bold outline-none cursor-pointer hover:border-green-500 pr-6"
                                    >
                                        <option value="" disabled>+ Dyn 2</option>
                                        {dynamicPromptLists.map(l => <option key={l.id} value={l.name}>[{l.name}]</option>)}
                                    </select>
                                    <ShuffleIcon className="w-3 h-3 text-green-300 absolute right-2 top-1.5 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <textarea 
                            value={prompt} 
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe the physical elements for raw GPU synthesis..." 
                            className="w-full h-32 bg-secondary border border-accent p-3 rounded-lg focus:ring-2 focus:ring-brand outline-none resize-none text-neutral-200 text-sm shadow-inner"
                        />
                    </div>

                    <div>
                        <div className="flex flex-col gap-2 mb-2">
                            <label className="block text-xs font-bold text-red-400 uppercase tracking-wider">Negative Blueprint (Avoid)</label>
                            <div className="flex gap-2">
                                <div className="relative group flex-grow">
                                    <select 
                                        onChange={(e) => {
                                            handleInsertNegativeFromTemplate(e.target.value);
                                            e.target.value = "";
                                        }} 
                                        defaultValue="" 
                                        className="w-full appearance-none bg-secondary border border-accent rounded px-2 py-1 text-[10px] text-red-300 font-bold outline-none cursor-pointer hover:border-red-500 pr-6"
                                    >
                                        <option value="" disabled>+ Add Negative from Template...</option>
                                        {promptTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <LibraryIcon className="w-3 h-3 text-red-300 absolute right-2 top-1.5 pointer-events-none" />
                                </div>
                                <div className="relative group flex-grow">
                                    <select 
                                        onChange={(e) => {
                                            handleInsertDynamic(e.target.value, 'negative');
                                            e.target.value = "";
                                        }} 
                                        defaultValue="" 
                                        className="w-full appearance-none bg-secondary border border-accent rounded px-2 py-1 text-[10px] text-orange-300 font-bold outline-none cursor-pointer hover:border-orange-500 pr-6"
                                    >
                                        <option value="" disabled>+ Neg Dyn 1</option>
                                        {dynamicPromptLists.map(l => <option key={l.id} value={l.name}>[{l.name}]</option>)}
                                    </select>
                                    <ShuffleIcon className="w-3 h-3 text-orange-300 absolute right-2 top-1.5 pointer-events-none" />
                                </div>
                                <div className="relative group flex-grow">
                                    <select 
                                        onChange={(e) => {
                                            handleInsertDynamic(e.target.value, 'negative');
                                            e.target.value = "";
                                        }} 
                                        defaultValue="" 
                                        className="w-full appearance-none bg-secondary border border-accent rounded px-2 py-1 text-[10px] text-orange-300 font-bold outline-none cursor-pointer hover:border-orange-500 pr-6"
                                    >
                                        <option value="" disabled>+ Neg Dyn 2</option>
                                        {dynamicPromptLists.map(l => <option key={l.id} value={l.name}>[{l.name}]</option>)}
                                    </select>
                                    <ShuffleIcon className="w-3 h-3 text-orange-300 absolute right-2 top-1.5 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <textarea 
                            value={negativePrompt} 
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="blurry, low quality, distortion..." 
                            className="w-full h-20 bg-secondary border border-accent p-3 rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none text-neutral-200 text-sm shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Aspect Ratio</label>
                        <div className="grid grid-cols-2 gap-2">
                            {RATIOS.map(r => (
                                <button 
                                    key={r.label}
                                    onClick={() => { setWidth(r.w); setHeight(r.h); }}
                                    className={`px-2 py-2 rounded text-xs font-medium border transition-colors ${
                                        width === r.w && height === r.h 
                                            ? 'bg-brand border-brand text-white shadow-lg shadow-blue-900/20' 
                                            : 'bg-secondary border-accent text-neutral-400 hover:text-white'
                                    }`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Deterministic Seed</label>
                        <input 
                            type="number" 
                            placeholder="Optional Constant" 
                            value={seed ?? ''} 
                            onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-full bg-secondary border border-accent p-2 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !prompt.trim()}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <><LoadingSpinner className="w-5 h-5 text-white" /> Synthesizing...</>
                        ) : (
                            <><CameraLensIcon className="w-5 h-5" /> Engage Docker Core</>
                        )}
                    </button>

                    {wakingError && (
                        <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <WarningIcon className="w-5 h-5 text-yellow-500" />
                                <span className="font-bold uppercase tracking-wider">GPU Core is Sleeping</span>
                            </div>
                            <p className="font-mono text-[11px] leading-tight text-yellow-300">
                                The dedicated hardware has entered sleep mode to conserve resources.
                            </p>
                            <ol className="text-xs list-decimal list-inside space-y-1 pl-1">
                                <li><a href="https://merkmorassi-mythos-engine.hf.space" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:text-white">Click here to wake the GPU</a>.</li>
                                <li>Wait about 60 seconds for it to initialize.</li>
                                <li>Then, try your generation again.</li>
                            </ol>
                        </div>
                    )}

                    {error && !wakingError && (
                        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <WarningIcon className="w-4 h-4 text-red-500" />
                                <span className="font-bold uppercase tracking-wider">System Fault</span>
                            </div>
                            <p className="font-mono text-[11px] leading-tight text-red-300">
                                {error}
                            </p>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 bg-surface border border-accent rounded-xl flex flex-col relative overflow-hidden min-h-[600px]">
                    <div className="flex-grow flex items-center justify-center bg-primary relative p-8">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <LoadingSpinner className="w-12 h-12 text-blue-500" />
                                <p className="mt-4 text-neutral-400 animate-pulse font-mono text-sm uppercase tracking-[0.2em]">Developing Analog Negative...</p>
                            </div>
                        ) : result ? (
                            <img 
                                src={`data:${result.mimeType};base64,${result.base64}`} 
                                alt="Proprietary Docker Result" 
                                className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-sm ring-1 ring-white/10" 
                            />
                        ) : (
                            <div className="text-neutral-600 flex flex-col items-center select-none opacity-50">
                                <div className="w-24 h-24 border-2 border-dashed border-neutral-700 rounded-full flex items-center justify-center mb-4">
                                    <MagicIcon className="w-10 h-10" />
                                </div>
                                <p className="text-sm font-bold uppercase tracking-[0.3em]">Proprietary Core Standby</p>
                                <p className="text-xs mt-1">Docker GPU hardware is idle and ready.</p>
                            </div>
                        )}
                    </div>

                    {result && !isLoading && (
                        <div className="p-4 border-t border-accent bg-secondary/90 backdrop-blur-sm flex justify-center">
                            <AssetActions 
                                asset={{ type: 'image', base64: result.base64, mimeType: result.mimeType }}
                                onSaveToGrid={() => onAddAssetToGrid({ type: 'image', base64: result.base64, mimeType: result.mimeType })}
                                onSaveToStoryboard={() => onAddToStoryboard(result.base64)}
                                onSaveToInspiration={() => onAddToInspiration(result.base64)}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
