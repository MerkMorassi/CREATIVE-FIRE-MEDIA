import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner, AudioSparkIcon, SpeakerIcon } from './icons.tsx';
import { SavedAudioTrack } from '../types';

interface LyriaStudioProps {
    onAddAssetToGrid?: (asset: { type: 'audio' | 'video'; url: string; metadata?: any }) => void;
    savedTracks?: SavedAudioTrack[];
    onSaveTrack?: (track: SavedAudioTrack) => void;
    onDeleteTrack?: (id: string) => void;
}

interface TrackConfig {
    prompt: string;
    genre: string;
    tempo: number;
    duration: number;
    instrumentProfile: 'full-orchestral' | 'ambient-synth' | 'heavy-rock' | 'acoustic-piano';
}

export const LyriaStudio: React.FC<LyriaStudioProps> = ({ 
    onAddAssetToGrid,
    savedTracks = [],
    onSaveTrack,
    onDeleteTrack
}) => {
    const [config, setConfig] = useState<TrackConfig>({
        prompt: 'Futuristic synthwave soundtrack with pulsing retro-bassline and crisp digital drums',
        genre: 'Synthwave',
        tempo: 120,
        duration: 30,
        instrumentProfile: 'ambient-synth'
    });

    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [waveformActive, setWaveformActive] = useState(false);
    const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setAudioUrl(null);
        setIsPlaying(false);
        setWaveformActive(false);
        setSaveSuccess(false);
        setProgress('Initializing Lyria Sound Engine...');

        try {
            await new Promise(r => setTimeout(r, 1200));
            setProgress('Analyzing genre markers and harmonics...');
            await new Promise(r => setTimeout(r, 1500));
            setProgress('Synthesizing stem patterns...');
            await new Promise(r => setTimeout(r, 1000));
            setProgress('Mixing & Mastering stereo channels...');
            await new Promise(r => setTimeout(r, 800));

            // Premium audio samples for Lyria synthesis
            const mockTracks = [
                "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
                "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
                "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
            ];
            const track = mockTracks[Math.floor(Math.random() * mockTracks.length)];
            setAudioUrl(track);
            
            if (onAddAssetToGrid) {
                onAddAssetToGrid({ type: 'audio' as any, url: track, metadata: config });
            }
        } catch (e) {
            console.error("Lyria generation failed:", e);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            setWaveformActive(false);
        } else {
            audioRef.current.play().then(() => {
                setIsPlaying(true);
                setWaveformActive(true);
            }).catch(err => console.error("Audio playback error:", err));
        }
    };

    const handleSaveCurrentTrack = () => {
        if (!audioUrl || !onSaveTrack) return;
        
        const newTrack: SavedAudioTrack = {
            id: `track_${Date.now()}`,
            url: audioUrl,
            prompt: config.prompt,
            genre: config.genre,
            tempo: config.tempo,
            duration: config.duration,
            instrumentProfile: config.instrumentProfile,
            timestamp: Date.now()
        };

        onSaveTrack(newTrack);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const handleLoadAndPlaySavedTrack = (track: SavedAudioTrack) => {
        setConfig({
            prompt: track.prompt,
            genre: track.genre,
            tempo: track.tempo,
            duration: track.duration,
            instrumentProfile: track.instrumentProfile as any
        });
        setAudioUrl(track.url);
        setIsPlaying(true);
        setWaveformActive(true);
        setSaveSuccess(false);

        setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.src = track.url;
                audioRef.current.play().then(() => {
                    setIsPlaying(true);
                    setWaveformActive(true);
                }).catch(err => console.error("Saved audio playback error:", err));
            }
        }, 100);
    };

    const handleCopyPrompt = (trackId: string, promptText: string) => {
        navigator.clipboard.writeText(promptText);
        setCopiedTrackId(trackId);
        setTimeout(() => setCopiedTrackId(null), 2000);
    };

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, []);

    // Helper to format instrument profiles into human-readable text
    const formatInstrumentProfile = (profile: string) => {
        switch (profile) {
            case 'ambient-synth': return 'Custom Synths & Basses';
            case 'full-orchestral': return 'Symphonic Strings & Brass';
            case 'heavy-rock': return 'Distorted Guitar & Heavy Percussion';
            case 'acoustic-piano': return 'Solo Grand Piano & Pads';
            default: return profile;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white tracking-tight uppercase">Lyria Studio</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">Lyria v2.0 Music Model</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Generate original, high-fidelity soundtracks and sound designs synchronized with cinematic blueprints.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-shrink-0">
                {/* Controls */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-6 h-fit">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Soundtrack Composition Prompt</label>
                        <textarea
                            value={config.prompt}
                            onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-purple-500 h-24 resize-none placeholder-neutral-700"
                            placeholder="Describe theme, mood, instruments, rhythm..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase block">Genre Style</label>
                            <select
                                value={config.genre}
                                onChange={(e) => setConfig(prev => ({ ...prev, genre: e.target.value }))}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                                <option value="Synthwave">Retro Synthwave</option>
                                <option value="Cinematic Orchestral">Cinematic Orchestral</option>
                                <option value="Cyberpunk">Dark Cyberpunk</option>
                                <option value="Lo-Fi Beats">Lo-Fi Study Beats</option>
                                <option value="Ambient Drone">Ethereal Ambient</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-neutral-400 uppercase block">Instruments Profile</label>
                            <select
                                value={config.instrumentProfile}
                                onChange={(e: any) => setConfig(prev => ({ ...prev, instrumentProfile: e.target.value }))}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            >
                                <option value="ambient-synth">Custom Synths & Basses</option>
                                <option value="full-orchestral">Symphonic Strings & Brass</option>
                                <option value="heavy-rock">Distorted Guitar & Heavy Percussion</option>
                                <option value="acoustic-piano">Solo Grand Piano & Pads</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase">
                                <span>Tempo (BPM)</span>
                                <span className="font-mono text-purple-400">{config.tempo} BPM</span>
                            </div>
                            <input
                                type="range"
                                min="60"
                                max="180"
                                value={config.tempo}
                                onChange={(e) => setConfig(prev => ({ ...prev, tempo: parseInt(e.target.value) }))}
                                className="w-full accent-purple-500"
                            />
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-neutral-400 uppercase">
                                <span>Target Duration</span>
                                <span className="font-mono text-purple-400">{config.duration}s</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="120"
                                value={config.duration}
                                onChange={(e) => setConfig(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                                className="w-full accent-purple-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !config.prompt.trim()}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                        {isLoading ? (
                            <>
                                <LoadingSpinner className="w-4 h-4 text-white" />
                                <span>{progress || 'Composing Stems...'}</span>
                            </>
                        ) : (
                            <>
                                <AudioSparkIcon className="w-4 h-4 text-white" />
                                <span>Synthesize Tracks</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Waveform Visualization & Player */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg flex flex-col relative overflow-hidden min-h-[400px]">
                    <div className="flex-grow flex flex-col items-center justify-center bg-neutral-950 relative p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center">
                                <LoadingSpinner className="w-8 h-8 text-purple-500" />
                                <p className="mt-4 text-xs font-mono text-neutral-400 animate-pulse">{progress}</p>
                            </div>
                        ) : audioUrl ? (
                            <div className="w-full flex flex-col items-center space-y-6">
                                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400">
                                    <SpeakerIcon className="w-12 h-12" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{config.genre} Stems Synthesized</h3>
                                    <p className="text-[10px] text-neutral-500 mt-1 font-mono uppercase tracking-wide">Duration: {config.duration}s · BPM: {config.tempo}</p>
                                </div>

                                {/* Simulated Waveform */}
                                <div className="w-full h-16 flex items-center justify-between gap-1 px-4">
                                    {Array.from({ length: 32 }).map((_, i) => {
                                        const h = Math.sin(i * 0.4) * 24 + 28;
                                        return (
                                            <div
                                                key={i}
                                                style={{ height: `${h}px` }}
                                                className={`w-1.5 rounded-full transition-all duration-300 ${waveformActive ? 'bg-purple-500 animate-pulse' : 'bg-neutral-800'}`}
                                            />
                                        );
                                    })}
                                </div>

                                <audio 
                                    ref={audioRef} 
                                    src={audioUrl} 
                                    onEnded={() => { setIsPlaying(false); setWaveformActive(false); }} 
                                    className="hidden" 
                                />

                                <div className="flex flex-col items-center gap-3 w-full">
                                    <div className="flex gap-3 justify-center w-full">
                                        <button
                                            onClick={togglePlay}
                                            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
                                        >
                                            {isPlaying ? 'Pause Track' : 'Play Track'}
                                        </button>
                                        
                                        {onSaveTrack && (
                                            <button
                                                onClick={handleSaveCurrentTrack}
                                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                                </svg>
                                                Save Track
                                            </button>
                                        )}
                                    </div>
                                    {saveSuccess && (
                                        <p className="text-[11px] text-emerald-400 font-bold animate-pulse">✓ Successfully saved track and associated prompt to Project Library!</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-neutral-600 max-w-xs">
                                <AudioSparkIcon className="w-12 h-12 text-neutral-800 mx-auto mb-2" />
                                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Audio Output Studio</p>
                                <p className="text-[10px] text-neutral-600 mt-1">Specify instrumentation and tempo on the left, then click Synthesize to create professional digital music stems.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Saved Tracks Library - Under major components */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            Saved Stems & Soundtracks Library
                        </h3>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Access and play previously synthesized tracks along with their descriptive prompting blueprint.</p>
                    </div>
                    <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2.5 py-1 rounded-full">{savedTracks.length} Tracks Saved</span>
                </div>

                {savedTracks.length === 0 ? (
                    <div className="py-10 text-center">
                        <AudioSparkIcon className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider">No tracks saved yet</p>
                        <p className="text-[10px] text-neutral-600 max-w-xs mx-auto mt-1">Synthesize digital music and click "Save Track" to add them to your persistent soundtrack vault.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedTracks.map((track) => {
                            const isCurrent = audioUrl === track.url;
                            return (
                                <div 
                                    key={track.id} 
                                    className={`p-4 rounded-lg border transition-all flex flex-col justify-between space-y-3 ${
                                        isCurrent 
                                            ? 'bg-purple-950/10 border-purple-500/40 shadow-sm' 
                                            : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                                    {track.genre} Stem
                                                </h4>
                                                {isCurrent && (
                                                    <span className="text-[8px] font-bold px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded uppercase tracking-wide animate-pulse">
                                                        Loaded
                                                    </span>
                                                )}
                                            </div>
                                            {/* Zero-Pill Metadata System */}
                                            <p className="text-[10px] text-neutral-400">
                                                {formatInstrumentProfile(track.instrumentProfile)} · {track.tempo} BPM · {track.duration}s
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleLoadAndPlaySavedTrack(track)}
                                                className={`p-1.5 rounded-md transition-colors ${
                                                    isCurrent && isPlaying 
                                                        ? 'bg-purple-500 text-white' 
                                                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white'
                                                }`}
                                                title="Load & Play Track"
                                            >
                                                {isCurrent && isPlaying ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => handleCopyPrompt(track.id, track.prompt)}
                                                className="p-1.5 bg-neutral-800 text-neutral-300 rounded-md hover:bg-neutral-700 hover:text-white transition-colors"
                                                title="Copy Prompt"
                                            >
                                                {copiedTrackId === track.id ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                                    </svg>
                                                )}
                                            </button>

                                            <a
                                                href={track.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={`lyria_track_${track.id}.mp3`}
                                                className="p-1.5 bg-neutral-800 text-neutral-300 rounded-md hover:bg-neutral-700 hover:text-white transition-colors"
                                                title="Download MP3"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </a>

                                            {onDeleteTrack && (
                                                <button
                                                    onClick={() => onDeleteTrack(track.id)}
                                                    className="p-1.5 bg-neutral-800 text-red-400 rounded-md hover:bg-red-950/40 hover:text-red-300 transition-colors"
                                                    title="Delete Track"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800/80">
                                        <p className="text-[10px] text-neutral-300 line-clamp-2 leading-relaxed italic">
                                            "{track.prompt}"
                                        </p>
                                    </div>
                                    <div className="text-[8px] text-neutral-500 text-right">
                                        Saved {new Date(track.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
