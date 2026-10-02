
import React, { useState, useEffect, useRef } from 'react';
import { GenerationOptions, PromptTemplate, DynamicPromptList } from '../types.ts';
import { DiceIcon, ClearIcon, ChevronDownIcon, ShuffleIcon } from './icons.tsx';

interface InputPanelProps {
  onGenerate: (options: GenerationOptions) => void;
  isLoading: boolean;
  editingImage?: { base64: string; mimeType: string } | null;
  lastUsedSeed?: string;
  scriptLocations?: string[];
  preparedOptions: Partial<GenerationOptions & { sceneType: string, location: string, timeOfDay: string, characters: string }> | null;
  onPreparationComplete: () => void;
  promptTemplates: PromptTemplate[];
  dynamicPromptLists: DynamicPromptList[];
}

const FormField: React.FC<{ label: string; children: React.ReactNode, className?: string, disabled?: boolean }> = ({ label, children, className = '', disabled=false }) => (
    <div className={`flex flex-col gap-2 ${className} ${disabled ? 'opacity-50' : ''}`}>
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider" dangerouslySetInnerHTML={{ __html: label }} />
        {children}
    </div>
);

const AccordionSection: React.FC<{ title: string; sectionId: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, isOpen, onToggle, children }) => (
    <div className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-800/30">
        <button type="button" className="w-full p-3 flex justify-between items-center bg-neutral-800/50 text-left font-bold text-neutral-200 hover:bg-neutral-700/50" onClick={onToggle}>
            <span>{title}</span>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
            <div className="p-4 space-y-4">
                {children}
            </div>
        )}
    </div>
);


export const InputPanel: React.FC<InputPanelProps> = ({ onGenerate, isLoading, editingImage, lastUsedSeed, scriptLocations = [], preparedOptions, onPreparationComplete, promptTemplates, dynamicPromptLists }) => {
  const [sceneType, setSceneType] = useState<'INT' | 'EXT'>('INT');
  const [location, setLocation] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<'DAY' | 'NIGHT'>('DAY');
  const [characters, setCharacters] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [numImages, setNumImages] = useState(6);
  const [aspectRatio, setAspectRatio] = useState<GenerationOptions['aspectRatio']>('16:9');
  const [guidanceScale, setGuidanceScale] = useState(8);
  const [seed, setSeed] = useState('');
  const [cameraAngle, setCameraAngle] = useState('Medium Shot');
  const [addLetterbox, setAddLetterbox] = useState(true);
  
  const [engine, setEngine] = useState<GenerationOptions['engine']>('mythos_sdxl');
  const [geminiModel, setGeminiModel] = useState<GenerationOptions['geminiModel']>('gemini-2.5-flash-image');
  const [deliveryMethod, setDeliveryMethod] = useState<GenerationOptions['deliveryMethod']>('internal');

  const [strength, setStrength] = useState(80); // For image-to-image
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['prompt', 'settings']));
  const [maskData, setMaskData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);

  useEffect(() => {
    if (lastUsedSeed) {
      setSeed(lastUsedSeed);
    }
  }, [lastUsedSeed]);

  useEffect(() => {
    if (editingImage) {
      setOpenSections(prev => new Set(prev).add('editing'));
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx?.drawImage(img, 0, 0);
          };
          img.src = `data:${editingImage.mimeType};base64,${editingImage.base64}`;
      }
    }
  }, [editingImage]);
  
  useEffect(() => {
    if (preparedOptions) {
        setSceneType(preparedOptions.sceneType === 'EXT' ? 'EXT' : 'INT');
        setLocation(preparedOptions.location || '');
        setTimeOfDay(preparedOptions.timeOfDay === 'NIGHT' ? 'NIGHT' : 'DAY');
        setCharacters(preparedOptions.characters || '');
        setPrompt(preparedOptions.prompt || '');
        setNegativePrompt(preparedOptions.negativePrompt || '');
        setCameraAngle(preparedOptions.cameraAngle || 'Medium Shot');
        setOpenSections(prev => new Set(prev).add('prompt').add('settings'));
        onPreparationComplete();
    }
  }, [preparedOptions, onPreparationComplete]);


  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleRandomSeed = () => setSeed(String(Math.floor(Math.random() * 1000000000)));

  const handleClearForm = () => {
    setSceneType('INT');
    setLocation('');
    setTimeOfDay('DAY');
    setCharacters('');
    setPrompt('');
    setNegativePrompt('');
    setSeed('');
  };

  const handleApplyTemplate = (templateId: string) => {
    const template = promptTemplates.find(t => t.id === templateId);
    if (template) {
        setPrompt(p => `${p}${p ? ', ' : ''}${template.positivePrompt}`);
        setNegativePrompt(n => `${n}${n ? ', ' : ''}${template.negativePrompt}`);
    }
  };
  
  const handleInsertDynamic = (listName: string) => {
    setPrompt(p => `${p} [${listName}]`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const sceneHeader = `${sceneType}. ${location.toUpperCase() || 'LOCATION'} - ${timeOfDay}`;
    const characterInfo = characters ? `CHARACTERS: ${characters}.` : '';
    const angleInfo = cameraAngle ? `CAMERA ANGLE: ${cameraAngle}.` : '';
    const fullPrompt = [sceneHeader, characterInfo, angleInfo, prompt].filter(Boolean).join('\n');

    const options: GenerationOptions = {
        prompt: fullPrompt,
        negativePrompt,
        numImages,
        aspectRatio,
        guidanceScale,
        seed,
        cameraAngle,
        addLetterbox,
        engine,
        geminiModel,
        deliveryMethod,
    };

    if (editingImage) {
        options.base64Image = editingImage.base64;
        options.mimeType = editingImage.mimeType;
        options.strength = strength / 100;
        if (maskData) {
            options.maskBase64 = maskData;
        }
    }

    onGenerate(options);
  };
  
  // Inpainting canvas logic
    const getMousePos = (canvas: HTMLCanvasElement, evt: React.MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) * (canvas.width / rect.width),
            y: (evt.clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        setIsDrawing(true);
        const { x, y } = getMousePos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { x, y } = getMousePos(canvas, e);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "white";
        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    };

    const stopDrawing = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.closePath();
        setIsDrawing(false);
        setMaskData(canvas.toDataURL().split(',')[1]);
    };
    
    const clearMask = () => {
        const canvas = canvasRef.current;
        if (!canvas || !editingImage) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
        };
        img.src = `data:${editingImage.mimeType};base64,${editingImage.base64}`;
        setMaskData(null);
    };
  
    const maxImages = engine === 'gemini' && geminiModel === 'imagen-4.0-generate-001' ? 8 : 16;
    if (numImages > maxImages) {
        setNumImages(maxImages);
    }

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col text-neutral-200">
      <div className="flex-grow overflow-y-auto pr-2 space-y-2">
        {editingImage && (
             <AccordionSection title="INPAINTING / IMAGE-TO-IMAGE" sectionId="editing" isOpen={openSections.has('editing')} onToggle={() => toggleSection('editing')}>
                <div className="relative w-full aspect-video bg-black/50 mx-auto rounded-lg overflow-hidden">
                    <canvas ref={canvasRef} className="w-full h-full object-contain" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing}/>
                </div>
                 <FormField label={`Brush Size: ${brushSize}px`}>
                    <input type="range" min="10" max="150" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="w-full" />
                </FormField>
                <FormField label={`Strength: ${strength}%`}>
                    <input type="range" min="1" max="100" value={strength} onChange={e => setStrength(parseInt(e.target.value))} className="w-full" />
                </FormField>
                <button type="button" onClick={clearMask} className="text-sm text-neutral-400 hover:text-white">Clear Mask</button>
            </AccordionSection>
        )}
        <AccordionSection title="1. PROMPT & SCENE" sectionId="prompt" isOpen={openSections.has('prompt')} onToggle={() => toggleSection('prompt')}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Scene Type" className="sm:col-span-1">
                    <select value={sceneType} onChange={(e) => setSceneType(e.target.value as any)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="INT">INT.</option>
                        <option value="EXT">EXT.</option>
                    </select>
                </FormField>
                <FormField label="Location" className="sm:col-span-1">
                     <input type="text" list="locations" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., COFFEE SHOP" className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none" />
                     {scriptLocations.length > 0 && <datalist id="locations">{scriptLocations.map(loc => <option key={loc} value={loc} />)}</datalist>}
                </FormField>
                <FormField label="Time" className="sm:col-span-1">
                    <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value as any)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="DAY">DAY</option>
                        <option value="NIGHT">NIGHT</option>
                    </select>
                </FormField>
            </div>
            <FormField label="Characters">
                <input type="text" value={characters} onChange={(e) => setCharacters(e.target.value)} placeholder="e.g., JANE DOE, a mysterious stranger" className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none" />
            </FormField>
            <FormField label="Positive Prompt">
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A detailed description of the scene, action, emotion, and style." className="w-full h-32 bg-black border border-neutral-800 p-3 rounded-lg text-white focus:ring-2 focus:ring-brand outline-none resize-y" />
            </FormField>
            <FormField label="Negative Prompt">
                <textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="Things to avoid, e.g., blurry, watermark, text" className="w-full h-16 bg-black border border-neutral-800 p-3 rounded-lg text-white focus:ring-2 focus:ring-brand outline-none resize-y" />
            </FormField>
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-grow">
                    <select onChange={(e) => handleApplyTemplate(e.target.value)} defaultValue="" className="w-full text-sm bg-black border border-neutral-800 p-2 pr-8 appearance-none text-white rounded-lg focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="" disabled>Apply a Style Template...</option>
                        {promptTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                     <ChevronDownIcon className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                </div>
                 <div className="relative flex-grow">
                    <select onChange={(e) => handleInsertDynamic(e.target.value)} defaultValue="" className="w-full text-sm bg-black border border-neutral-800 p-2 pr-8 appearance-none text-white rounded-lg focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="" disabled>Insert Dynamic List...</option>
                        {dynamicPromptLists.map(l => <option key={l.id} value={l.name}>[{l.name}]</option>)}
                    </select>
                     <ChevronDownIcon className="h-4 w-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500" />
                </div>
                <button type="button" onClick={handleClearForm} title="Clear prompts" className="p-2 text-sm flex items-center hover:text-white transition-colors"><ClearIcon /></button>
            </div>
        </AccordionSection>
        <AccordionSection title="2. IMAGE SETTINGS" sectionId="settings" isOpen={openSections.has('settings')} onToggle={() => toggleSection('settings')}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <FormField label={`Images: ${numImages}`} className="col-span-2">
                    <div className="flex gap-2 items-center">
                        <input type="range" min="1" max={maxImages} value={numImages} onChange={(e) => setNumImages(parseInt(e.target.value))} className="w-full accent-blue-500" disabled={prompt.includes('[') && prompt.includes(']')} />
                        <input type="number" min="1" max={maxImages} value={numImages} onChange={(e) => setNumImages(parseInt(e.target.value))} className="w-12 bg-black border border-neutral-800 rounded-lg text-center text-sm p-1 text-white" />
                    </div>
                </FormField>
                 <FormField label="Aspect Ratio" className="col-span-2">
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="2.39:1">2.39:1 (Cinematic)</option>
                    </select>
                </FormField>
                 <FormField label={`Guidance: ${guidanceScale}`} className="col-span-2">
                    <input type="range" min="0" max="20" value={guidanceScale} onChange={(e) => setGuidanceScale(parseInt(e.target.value))} className="w-full accent-blue-500" />
                </FormField>
                <FormField label="Seed" className="col-span-2">
                    <div className="flex gap-1">
                        <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Leave blank for random" className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none" />
                        <button type="button" onClick={handleRandomSeed} className="p-2 hover:text-white transition-colors"><DiceIcon /></button>
                    </div>
                </FormField>
                <FormField label="Camera Angle" className="col-span-4">
                    <select value={cameraAngle} onChange={(e) => setCameraAngle(e.target.value)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        {['Medium Shot', 'Close-up Shot', 'Wide Angle Shot', 'Establishing Shot', 'Point of View (POV)', 'Low Angle Shot', 'High Angle Shot', 'Dutch Angle', 'Over the Shoulder Shot', 'Long Shot', 'Extreme Close-up', 'Full Shot'].map(angle => <option key={angle} value={angle}>{angle}</option>)}
                    </select>
                </FormField>
                 <FormField label="Generation Engine" className="col-span-2">
                    <select value={engine} onChange={(e) => setEngine(e.target.value as any)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="mythos_sdxl">MythOS SDXL (Superior)</option>
                        <option value="gemini">Google Gemini</option>
                    </select>
                </FormField>
                {engine === 'gemini' && (
                    <FormField label="Gemini Model" className="col-span-2">
                        <select value={geminiModel} onChange={(e) => setGeminiModel(e.target.value as any)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                            <option value="gemini-3.1-flash-lite-image">Gemini 3.1 Flash Lite Image (Fast)</option>
                            <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (High Quality 1K/2K)</option>
                            <option value="gemini-3-pro-image">Gemini 3 Pro Image (Advanced Art 2K/4K)</option>
                            <option value="imagen-4.0-generate-001">Imagen 4.0 Image (Legacy Quality)</option>
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Legacy Fast)</option>
                        </select>
                    </FormField>
                )}
                 <FormField label="Delivery Method" className="col-span-2">
                    <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as any)} className="w-full bg-black border border-neutral-800 p-2 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer">
                        <option value="internal">Internal (This App)</option>
                        <option value="external">External (Webhook)</option>
                    </select>
                </FormField>
                 <FormField label="Post-Processing" className="col-span-4">
                     <label className="flex items-center gap-2 text-sm text-neutral-300">
                        <input type="checkbox" checked={addLetterbox} onChange={(e) => setAddLetterbox(e.target.checked)} className="accent-brand" />
                        Add Cinematic Letterbox (2.39:1)
                    </label>
                </FormField>
            </div>
        </AccordionSection>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-700">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-600 disabled:cursor-wait transition-colors rounded-lg shadow-lg"
          >
            {isLoading ? 'Generating...' : (deliveryMethod === 'external' ? 'Send Generation Request' : 'Generate Images')}
          </button>
      </div>
    </form>
  );
};