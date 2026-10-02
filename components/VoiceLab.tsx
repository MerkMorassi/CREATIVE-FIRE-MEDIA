
import React, { useState, useEffect, useRef } from 'react';
import { Client } from "@gradio/client";
import { Agent } from '../types';
import { getHfApiKey } from '../services/apiKeyService';
import { EXTERNAL_MODEL_ENDPOINTS } from '../services/externalRouter';
import { SpeakerIcon, UploadIcon, WarningIcon, LoadingSpinner, UserIcon } from './icons';

interface VoiceLabProps {
    agents: Agent[];
    onAudioGenerated?: (audioUrl: string) => void;
}

// Helper to convert data URL to Blob for Gradio Client
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
};

export const VoiceLab: React.FC<VoiceLabProps> = ({ agents, onAudioGenerated }) => {
    const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
    const [text, setText] = useState('');
    
    // Gradio Specific State
    const [status, setStatus] = useState<'IDLE' | 'LOADING_PROFILE' | 'CONNECTING' | 'PROCESSING' | 'COMPLETE' | 'ERROR'>('IDLE');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Voice Profile State
    const [voiceRefBlob, setVoiceRefBlob] = useState<Blob | null>(null);
    const [voiceRefName, setVoiceRefName] = useState<string>('');
    const [isUsingOverride, setIsUsingOverride] = useState(false);
    const [voiceRefUrl, setVoiceRefUrl] = useState<string | null>(null); // For playback

    // Synthesis Parameters
    const [params, setParams] = useState({
        exaggeration: 0.5,
        temperature: 0.8,
        seed_num: 0,
        cfg_weight: 0.5
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    // 1. Load Agent's Saved Voice Reference on Selection
    useEffect(() => {
        const loadVoice = async () => {
            if (!selectedAgentId) return;
            
            setStatus('LOADING_PROFILE');
            setVoiceRefBlob(null);
            setVoiceRefUrl(null);
            setVoiceRefName('');
            setError(null);

            try {
                const agent = agents.find(a => a.id === selectedAgentId);
                const refString = agent?.voiceReference;

                if (refString) {
                    const blob = await dataUrlToBlob(refString);
                    setVoiceRefBlob(blob);
                    setVoiceRefUrl(refString);
                    setVoiceRefName('System Profile');
                    setIsUsingOverride(false);
                } else {
                     setVoiceRefBlob(null);
                     setVoiceRefUrl(null);
                }
            } catch (e) {
                console.error("Failed to load agent voice config", e);
                setError("Failed to load voice profile audio.");
                setStatus('ERROR');
            } finally {
                setStatus('IDLE');
            }
        };
        loadVoice();
    }, [selectedAgentId, agents]);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (voiceRefUrl && voiceRefUrl.startsWith('blob:')) {
                URL.revokeObjectURL(voiceRefUrl);
            }
        }
    }, [voiceRefUrl]);

    // 2. Main Synthesis Function using @gradio/client
    const handleSynthesize = async () => {
        if (!voiceRefBlob || !text) {
            setError("Missing text or voice reference.");
            return;
        }

        setStatus('CONNECTING');
        setError(null);
        setAudioUrl(null);

        try {
            const token = getHfApiKey();
            const endpoint = EXTERNAL_MODEL_ENDPOINTS.CHATTERBOX_TTS?.url || EXTERNAL_MODEL_ENDPOINTS.CHATTERBOX_TTS.space;
            
            if (!endpoint) {
                throw new Error("Voice Lab URL is not configured in settings or router.");
            }

            const app = await Client.connect(endpoint, { 
                hf_token: token ? (token as `hf_${string}`) : undefined
            });

            setStatus('PROCESSING');

            const result = await app.predict("/generate", { 
                text: text, 
                audio_prompt: voiceRefBlob, 
                exaggeration: params.exaggeration, 
                temperature: params.temperature, 
                seed_num: params.seed_num, 
                cfg_weight: params.cfg_weight, 
            });

            if (result.data && result.data[0]) {
                const audioResult = result.data[0];
                const finalUrl = (typeof audioResult === 'object' && audioResult.url) ? audioResult.url : audioResult;
                
                setAudioUrl(finalUrl);
                if (onAudioGenerated) onAudioGenerated(finalUrl);
                setStatus('COMPLETE');
            } else {
                 throw new Error("API returned no data or an unexpected format.");
            }

        } catch (err: any) {
            console.error("Gradio Error:", err);
            setError(err.message || "Synthesis failed. Check console for details.");
            setStatus('ERROR');
        }
    };
    
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVoiceRefBlob(file);
            setVoiceRefName(file.name);
            setIsUsingOverride(true);
            
            const fileUrl = URL.createObjectURL(file);
            setVoiceRefUrl(fileUrl);
        }
    };

    const isLoading = status === 'CONNECTING' || status === 'PROCESSING' || status === 'LOADING_PROFILE';

    return (
        <div className="p-6 max-w-4xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Voice Lab</h2>
                <p className="text-neutral-400">Grounded voice synthesis for generating agent dialogue.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Controls */}
                <div className="space-y-6 bg-neutral-800/50 p-6 border border-neutral-700 rounded-xl h-fit">
                    <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 block">Target Voice Profile</label>
                        <div className="flex items-center gap-3">
                            {selectedAgent?.avatar ? (
                                <img src={selectedAgent.avatar} alt={selectedAgent.name} className="w-12 h-12 rounded-full object-cover border-2 border-neutral-700 shrink-0" />
                            ) : (
                                <div className="w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center shrink-0 border-2 border-neutral-600">
                                    <UserIcon className="w-6 h-6 text-neutral-500" />
                                </div>
                            )}
                            <select 
                                className="w-full bg-neutral-800 border border-neutral-700 p-3 rounded-lg text-sm text-white"
                                value={selectedAgentId} 
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                disabled={isLoading}
                            >
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name.toUpperCase()}</option>
                                ))}
                            </select>
                            <button className="px-4 py-3 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-bold rounded-lg" title="Upload Override Wav" onClick={() => fileInputRef.current?.click()}>
                                <UploadIcon className="w-4 h-4" />
                            </button>
                            <input type="file" accept="audio/*" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
                        </div>
                        <div className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${isUsingOverride ? 'text-yellow-400' : (voiceRefBlob ? 'text-green-400' : 'text-red-400')}`}>
                            {isUsingOverride ? `⚠️ OVERRIDE: ${voiceRefName}` : (voiceRefBlob ? "✓ SYSTEM PROFILE LOADED" : "❌ NO VOICE REFERENCE FOUND")}
                        </div>
                        {voiceRefUrl && (
                            <div className="mt-3">
                                <audio
                                    key={voiceRefUrl}
                                    controls
                                    src={voiceRefUrl}
                                    className="w-full h-10"
                                    ref={audioRef}
                                />
                            </div>
                        )}
                    </div>

                    <textarea
                        className="w-full bg-neutral-900 border border-neutral-700 p-3 rounded-lg text-sm text-white resize-y"
                        placeholder="Enter text to synthesize..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={5}
                        disabled={isLoading}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex justify-between text-xs text-neutral-400"><span>Exaggeration</span><span>{params.exaggeration}</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={params.exaggeration} onChange={(e) => setParams(p => ({...p, exaggeration: parseFloat(e.target.value)}))} className="w-full accent-blue-500" disabled={isLoading}/>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs text-neutral-400"><span>Stability (Temp)</span><span>{params.temperature}</span></div>
                            <input type="range" min="0.1" max="1.5" step="0.05" value={params.temperature} onChange={(e) => setParams(p => ({...p, temperature: parseFloat(e.target.value)}))} className="w-full accent-blue-500" disabled={isLoading}/>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs text-neutral-400"><span>Pace (CFG)</span><span>{params.cfg_weight}</span></div>
                            <input type="range" min="0" max="1" step="0.1" value={params.cfg_weight} onChange={(e) => setParams(p => ({...p, cfg_weight: parseFloat(e.target.value)}))} className="w-full accent-blue-500" disabled={isLoading}/>
                        </div>
                        <div>
                            <label className="text-xs text-neutral-400">Seed</label>
                            <input type="number" value={params.seed_num} onChange={(e) => setParams(p => ({...p, seed_num: parseInt(e.target.value) || 0}))} className="w-full bg-neutral-900 border border-neutral-700 p-1 rounded-lg text-sm text-center" disabled={isLoading}/>
                        </div>
                    </div>
                </div>

                {/* Right Column: Output */}
                <div className="flex flex-col gap-6">
                    <button 
                        className={`w-full py-4 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${isLoading ? 'bg-neutral-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                        onClick={handleSynthesize}
                        disabled={isLoading || !voiceRefBlob || !text}
                    >
                        {isLoading ? <><LoadingSpinner className="w-5 h-5"/> {status}...</> : <><SpeakerIcon className="w-5 h-5"/> Generate Speech</>}
                    </button>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-2">
                            <WarningIcon className="w-4 h-4"/>
                            {error}
                        </div>
                    )}

                    {audioUrl && status === 'COMPLETE' && (
                        <div className="mt-4 p-4 border border-neutral-700 rounded-lg bg-neutral-900/50">
                            <audio controls src={audioUrl} className="w-full" autoPlay />
                            <div className="flex justify-between mt-2">
                                <span className="text-xs text-green-400 font-bold">✓ Audio Generated</span>
                                <a href={audioUrl} download={`voice_${selectedAgentId}_${Date.now()}.wav`} className="text-xs underline hover:text-blue-300 text-blue-400">
                                    Download WAV
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};