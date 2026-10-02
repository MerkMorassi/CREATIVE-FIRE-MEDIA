import React, { useState, useEffect, useRef } from 'react';
import { LoadingSpinner, AudioSparkIcon, SpeakerIcon } from './icons.tsx';
import { SavedAudioTrack } from '../types';
import { getMusicApiKey } from '../services/apiKeyService';

interface ComposerStudioProps {
    onAddAssetToGrid?: (asset: { type: 'audio' | 'video'; url: string; metadata?: any }) => void;
    savedTracks?: SavedAudioTrack[];
    onSaveTrack?: (track: SavedAudioTrack) => void;
    onDeleteTrack?: (id: string) => void;
}

interface ComposerConfig {
    customMode: boolean;
    mv: string;
    gptDescriptionPrompt: string; // Used when customMode = false
    prompt: string;               // Lyrics, used when customMode = true
    title: string;                // Used when customMode = true
    tags: string;                 // Style/genre, used when customMode = true
    instrumental: boolean;        // Available in both modes now
    taskType: 'create_music' | 'extend_music' | 'cover_music';
    styleWeight: number;          // Controls tag influence (1.0 to 5.0)
    weirdnessConstraint: number;  // Randomness (0.0 to 1.0)
    negativeTags: string;         // Styles to avoid
    continueClipId: string;       // ID of previous clip for extend/cover
    audioWeight: number;          // Cover similarity (0.1 to 1.0)
}

export const ComposerStudio: React.FC<ComposerStudioProps> = ({
    onAddAssetToGrid,
    savedTracks = [],
    onSaveTrack,
    onDeleteTrack
}) => {
    const [config, setConfig] = useState<ComposerConfig>({
        customMode: false,
        mv: 'sonic-v6',
        gptDescriptionPrompt: 'uplifting synthwave with female vocals',
        prompt: '[Verse 1]\nNeon lights guide the lonely street\nPulse of the city beneath our feet\n[Chorus]\nWe are the rhythm, we are the sound\nLost in the synthwave, never to be found...',
        title: 'Neon Pulse',
        tags: 'uplifting synthwave, female vocals, driving bass',
        instrumental: false,
        taskType: 'create_music',
        styleWeight: 2.5,
        weirdnessConstraint: 0.1,
        negativeTags: '',
        continueClipId: '',
        audioWeight: 0.6
    });

    const [showAdvanced, setShowAdvanced] = useState(false);

    // API Generation states
    const [isLoading, setIsLoading] = useState(false);
    const [taskState, setTaskState] = useState<'IDLE' | 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'>('IDLE');
    const [taskId, setTaskId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [progressLog, setProgressLog] = useState<string>('');
    const [timeElapsed, setTimeElapsed] = useState<number>(0);

    // Audio player states
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [activeTrackTitle, setActiveTrackTitle] = useState<string>('');
    const [activeTrackPrompt, setActiveTrackPrompt] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    
    // Notification success message
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track elapsed time during generation
    useEffect(() => {
        let elapsedTimer: NodeJS.Timeout;
        if (isLoading) {
            elapsedTimer = setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
        } else {
            setTimeElapsed(0);
        }
        return () => clearInterval(elapsedTimer);
    }, [isLoading]);

    // Cleanup timers and audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Format seconds into MM:SS format
    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds)) return '0:00';
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    // Handle play / pause toggle
    const handlePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play()
                .then(() => setIsPlaying(true))
                .catch(err => console.error("Playback failed:", err));
        }
    };

    // Handle Volume change
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        setIsMuted(val === 0);
        if (audioRef.current) {
            audioRef.current.volume = val;
            audioRef.current.muted = val === 0;
        }
    };

    // Handle mute toggle
    const handleToggleMute = () => {
        const nextMute = !isMuted;
        setIsMuted(nextMute);
        if (audioRef.current) {
            audioRef.current.muted = nextMute;
            audioRef.current.volume = nextMute ? 0 : volume;
        }
    };

    // Handle seeking in progress bar
    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        setCurrentTime(newTime);
        if (audioRef.current) {
            audioRef.current.currentTime = newTime;
        }
    };

    // Poll the status of the sonic task using /api/music/task/{taskId}
    const startPollingTask = (id: string) => {
        setTaskState('QUEUED');
        setProgressLog('Task sent to Music API queue. Polling for results...');
        
        let attempts = 0;
        const maxAttempts = 120; // 10 minutes max polling time (5s interval)

        const customKey = getMusicApiKey() || '';

        pollIntervalRef.current = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                setTaskState('FAILED');
                setErrorMessage('Generation timed out. Please try again.');
                setIsLoading(false);
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                return;
            }

            try {
                const response = await fetch(`/api/music/task/${id}`, {
                    headers: {
                        'X-Music-Api-Key': customKey
                    }
                });
                if (!response.ok) {
                    throw new Error(`API returned error code ${response.status}`);
                }
                const resData = await response.json();
                
                // Read state from data object
                const taskInfo = resData.data;
                const status = taskInfo?.state || taskInfo?.status || resData.state || resData.status || '';
                
                if (status === 'succeeded' || status === 'SUCCESS') {
                    setTaskState('SUCCESS');
                    const audioUrlResult = taskInfo?.audio_url || resData.audio_url || '';
                    if (audioUrlResult) {
                        setAudioUrl(audioUrlResult);
                        setActiveTrackTitle(config.customMode ? config.title : 'Sonic Composition');
                        setActiveTrackPrompt(config.customMode ? config.tags : config.gptDescriptionPrompt);
                        setProgressLog('Composition successfully synthesized and ready!');
                        
                        // Automatically push to asset grid if enabled
                        if (onAddAssetToGrid) {
                            onAddAssetToGrid({
                                type: 'audio',
                                url: audioUrlResult,
                                metadata: {
                                    prompt: config.customMode ? config.tags : config.gptDescriptionPrompt,
                                    title: config.customMode ? config.title : 'Sonic Composition',
                                    mode: config.customMode ? 'custom' : 'prompt',
                                    mv: config.mv,
                                    task_type: config.taskType
                                }
                            });
                        }
                    } else {
                        setTaskState('FAILED');
                        setErrorMessage('Task succeeded but no audio URL was returned.');
                    }
                    setIsLoading(false);
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                } else if (status === 'failed' || status === 'FAILED' || status === 'error') {
                    setTaskState('FAILED');
                    setErrorMessage(taskInfo?.error_msg || resData.message || 'Generation failed on Music API server.');
                    setIsLoading(false);
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                } else if (status === 'running' || status === 'RUNNING') {
                    setTaskState('RUNNING');
                    setProgressLog('Music engine is actively composing tracks and synthesizing vocals...');
                } else {
                    // Retain queued or show details
                    setProgressLog(`Engine status: ${status.toUpperCase()} (Synthesizing chords & percussion)`);
                }
            } catch (err) {
                console.error("Polling error:", err);
                setProgressLog("Temporary network issue... retrying connection to Music API.");
            }
        }, 5000);
    };

    // Handle Generation Action
    const handleGenerate = async () => {
        setIsLoading(true);
        setTaskId(null);
        setErrorMessage(null);
        setAudioUrl(null);
        setIsPlaying(false);
        setTaskState('QUEUED');
        setProgressLog('Initiating connection to Music API server...');

        const customKey = getMusicApiKey() || '';

        // Build core payload options
        const basePayload: any = {
            custom_mode: config.customMode,
            mv: config.mv,
            task_type: config.taskType,
            style_weight: config.styleWeight,
            weirdness_constraint: config.weirdnessConstraint,
            make_instrumental: config.instrumental
        };

        if (config.negativeTags.trim()) {
            basePayload.negative_tags = config.negativeTags.trim();
        }

        if (config.taskType === 'extend_music' || config.taskType === 'cover_music') {
            if (!config.continueClipId.trim()) {
                setTaskState('FAILED');
                setErrorMessage('A Continue Clip ID is required for Extend and Cover tasks.');
                setIsLoading(false);
                return;
            }
            basePayload.continue_clip_id = config.continueClipId.trim();
            if (config.taskType === 'cover_music') {
                basePayload.audio_weight = config.audioWeight;
            }
        }

        // Set up request body based on mode
        const requestPayload = config.customMode 
            ? {
                ...basePayload,
                prompt: config.prompt,
                title: config.title,
                tags: config.tags
              }
            : {
                ...basePayload,
                gpt_description_prompt: config.gptDescriptionPrompt
              };

        try {
            const response = await fetch('/api/music/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Music-Api-Key': customKey
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with status code ${response.status}`);
            }

            const data = await response.json();
            
            // Expected task_id in response
            const spawnedTaskId = data.task_id || data.data?.task_id;
            
            if (spawnedTaskId) {
                setTaskId(spawnedTaskId);
                startPollingTask(spawnedTaskId);
            } else {
                throw new Error('Music API did not return a valid Task ID.');
            }
        } catch (e) {
            console.error("Initiation failed:", e);
            setTaskState('FAILED');
            setErrorMessage(e instanceof Error ? e.message : 'An unknown error occurred during initialization.');
            setIsLoading(false);
        }
    };

    // Save Track locally or in Firebase Project
    const handleSaveCurrentTrack = () => {
        if (!audioUrl || !onSaveTrack) return;
        
        // Use actual musicapi taskId as document ID if available to enable extend/cover referencing
        const newTrack: SavedAudioTrack = {
            id: taskId || `track_${Date.now()}`,
            url: audioUrl,
            prompt: activeTrackPrompt,
            genre: config.customMode ? config.tags : 'Sonic AI Synthesis',
            tempo: 120, // default placeholder
            duration: Math.round(duration) || 60,
            instrumentProfile: config.mv,
            timestamp: Date.now()
        };

        onSaveTrack(newTrack);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    // Load saved track into player
    const handleLoadSavedTrack = (track: SavedAudioTrack) => {
        setAudioUrl(track.url);
        setActiveTrackTitle(track.genre || 'Sonic Track');
        setActiveTrackPrompt(track.prompt);
        setIsPlaying(true);
        
        // Also populate as fallback for extend/cover referencing
        setConfig(prev => ({ ...prev, continueClipId: track.id }));

        setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.src = track.url;
                audioRef.current.play()
                    .then(() => setIsPlaying(true))
                    .catch(err => console.error("Saved audio playback failed:", err));
            }
        }, 100);
    };

    // Copy Prompt to clipboard
    const handleCopyPrompt = (trackId: string, promptText: string) => {
        navigator.clipboard.writeText(promptText);
        setCopiedTrackId(trackId);
        setTimeout(() => setCopiedTrackId(null), 2000);
    };

    // Trigger template selection
    const handleApplyTemplate = (promptText: string, tagsText: string) => {
        setConfig(prev => ({
            ...prev,
            gptDescriptionPrompt: promptText,
            tags: tagsText,
            title: promptText.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        }));
    };

    // Advanced quick actions for Vault Tracks
    const handleTriggerExtend = (track: SavedAudioTrack) => {
        setConfig(prev => ({
            ...prev,
            taskType: 'extend_music',
            continueClipId: track.id,
            customMode: true,
            title: `${track.genre || 'Sonic'} Extended`,
            tags: track.genre || prev.tags
        }));
        setShowAdvanced(true);
        
        // Smooth scroll to advanced settings container
        const el = document.getElementById('advanced-settings-header');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    const handleTriggerCover = (track: SavedAudioTrack) => {
        setConfig(prev => ({
            ...prev,
            taskType: 'cover_music',
            continueClipId: track.id,
            customMode: false,
            gptDescriptionPrompt: `cinematic style transformation of ${track.genre || 'original track'}`
        }));
        setShowAdvanced(true);
        
        const el = document.getElementById('advanced-settings-header');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white tracking-tight uppercase">Composer Studio</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 border border-neutral-700 text-neutral-300 rounded">Sonic API Engine</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Compose cinematic scores, synthetic vocals, and full musical arrangements directly from description prompts or custom lyrics using musicapi.ai Sonic.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-shrink-0">
                {/* Generation Configuration controls */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-5 h-fit">
                    {/* Mode Toggle Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-neutral-950 rounded-lg">
                        <button 
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, customMode: false }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${!config.customMode ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                        >
                            Prompt Mode
                        </button>
                        <button 
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, customMode: true }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${config.customMode ? 'bg-blue-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
                        >
                            Custom Lyrics Mode
                        </button>
                    </div>

                    {/* Model Engine Selector */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Sonic Model Version</label>
                        <select
                            value={config.mv}
                            onChange={(e) => setConfig(prev => ({ ...prev, mv: e.target.value }))}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="sonic-v6">Sonic v6 (Flagship Vocal & Instrumental Model)</option>
                            <option value="sonic-v6-wild">Sonic v6 Wild (Creative & Experimental Mixes)</option>
                            <option value="sonic-v6-mini">Sonic v6 Mini (Fast & Optimized Synthesis)</option>
                            <option value="sonic-v5-5">Sonic v5.5 (Premium Stereophonic Mastering)</option>
                            <option value="sonic-v5">Sonic v5 (High Fidelity, Detailed Stereo)</option>
                            <option value="sonic-v4">Sonic v4 (Consistent Vocals, Crisp Mix)</option>
                            <option value="sonic-v3-custom">Sonic v3 Custom (Legacy Retro Fidelity)</option>
                        </select>
                    </div>

                    {!config.customMode ? (
                        /* Prompt Mode Form */
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Description Prompt</label>
                                <textarea
                                    value={config.gptDescriptionPrompt}
                                    onChange={(e) => setConfig(prev => ({ ...prev, gptDescriptionPrompt: e.target.value }))}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 h-24 resize-none placeholder-neutral-700"
                                    placeholder="e.g., uplifting synthwave with driving drums, celestial female chorus and neon vibes..."
                                />
                            </div>

                            {/* Templates Quick-select */}
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider block">Quick Style Presets</span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button 
                                        onClick={() => handleApplyTemplate('uplifting synthwave with female vocals', 'uplifting synthwave, female vocals, cyber beats')}
                                        className="text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2.5 py-1 rounded transition-colors"
                                    >
                                        Synthwave Vocals
                                    </button>
                                    <button 
                                        onClick={() => handleApplyTemplate('dark industrial techno with modular bassline', 'industrial techno, dark modular synthesizer, mechanical rhythms')}
                                        className="text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2.5 py-1 rounded transition-colors"
                                    >
                                        Industrial Techno
                                    </button>
                                    <button 
                                        onClick={() => handleApplyTemplate('epic cinematic orchestral theme with brass and soaring strings', 'cinematic orchestra, epic brass, dramatic choir, swelling strings')}
                                        className="text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2.5 py-1 rounded transition-colors"
                                    >
                                        Epic Orchestral
                                    </button>
                                    <button 
                                        onClick={() => handleApplyTemplate('chilled lofi study beats with ambient electric piano', 'lofi hip hop, chillhop, smooth electric piano, vinyl static crackle')}
                                        className="text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2.5 py-1 rounded transition-colors"
                                    >
                                        Chilled Lo-Fi
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Custom Mode Form */
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Song Title</label>
                                    <input
                                        type="text"
                                        value={config.title}
                                        onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g. Skyline Horizon"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block font-mono">Genre / Style Tags</label>
                                    <input
                                        type="text"
                                        value={config.tags}
                                        onChange={(e) => setConfig(prev => ({ ...prev, tags: e.target.value }))}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g. rock, energetic male voice, 80s drums"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Custom Lyrics (or structure blocks)</label>
                                    <button
                                        type="button"
                                        onClick={() => setConfig(prev => ({
                                            ...prev,
                                            prompt: `[Verse 1]\nDeep in the wires, a message appears\nSilent vibrations defeating our fears\n\n[Chorus]\nFly through the digital space tonight\nGuided by echoes of laser light\nInto the mainframe we take our flight...`
                                        }))}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        Auto-Generate Sample Lyrics
                                    </button>
                                </div>
                                <textarea
                                    value={config.prompt}
                                    onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500 h-32 resize-none placeholder-neutral-700 font-mono"
                                    placeholder="Write custom lyrics with structuring markers like [Verse], [Chorus], [Guitar Solo]..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Shared Instrumental toggle */}
                    <div className="flex items-center gap-2 bg-neutral-950/50 p-2 border border-neutral-800/60 rounded-lg">
                        <input
                            id="instrumental-toggle"
                            type="checkbox"
                            checked={config.instrumental}
                            onChange={(e) => setConfig(prev => ({ ...prev, instrumental: e.target.checked }))}
                            className="w-3.5 h-3.5 bg-neutral-950 border-neutral-800 rounded text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <label htmlFor="instrumental-toggle" className="text-xs text-neutral-300 font-bold select-none cursor-pointer">
                            Instrumental Only (Ignore Lyrics & Vocals)
                        </label>
                    </div>

                    {/* Advanced Parameters Accordion */}
                    <div className="border border-neutral-800 rounded-lg overflow-hidden">
                        <button
                            type="button"
                            id="advanced-settings-header"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="w-full flex items-center justify-between p-3 bg-neutral-950 text-xs font-bold text-neutral-300 hover:text-white transition-colors"
                        >
                            <span>ADVANCED SONIC CONFIGURATION</span>
                            <span className="text-neutral-500 font-mono text-[10px]">{showAdvanced ? '[-]' : '[+]'}</span>
                        </button>

                        {showAdvanced && (
                            <div className="p-4 bg-neutral-950/40 border-t border-neutral-800 space-y-4">
                                {/* Task Type Selection */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Generation Mode (Task Type)</label>
                                    <select
                                        value={config.taskType}
                                        onChange={(e) => setConfig(prev => ({ ...prev, taskType: e.target.value as any }))}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="create_music">Create New Track from Scratch</option>
                                        <option value="extend_music">Extend a Previous Clip / Song</option>
                                        <option value="cover_music">Style Cover (Transform existing track)</option>
                                    </select>
                                </div>

                                {/* Continue Clip ID (conditional) */}
                                {(config.taskType === 'extend_music' || config.taskType === 'cover_music') && (
                                    <div className="space-y-1.5 p-3 border border-blue-500/10 bg-blue-950/5 rounded-lg space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-wider block font-mono">Target Clip / Track ID</label>
                                            <span className="text-[9px] text-neutral-500 font-mono italic">Needs actual MusicAPI taskId</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={config.continueClipId}
                                            onChange={(e) => setConfig(prev => ({ ...prev, continueClipId: e.target.value }))}
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="e.g. task_xxxxx or choose from Project Vault"
                                        />
                                        {savedTracks.length > 0 && (
                                            <div className="pt-1.5 border-t border-neutral-800/60">
                                                <span className="text-[9px] text-neutral-500 font-bold block mb-1">PRE-FILL FROM VAULT:</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {savedTracks.map(t => (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => setConfig(prev => ({ ...prev, continueClipId: t.id }))}
                                                            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${config.continueClipId === t.id ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                                                        >
                                                            {t.genre?.substring(0, 15) || 'Clip'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Style Weight Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                        <span>Style Influence Weight</span>
                                        <span className="font-mono text-blue-400">{config.styleWeight.toFixed(1)}x</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="1.0"
                                        max="5.0"
                                        step="0.1"
                                        value={config.styleWeight}
                                        onChange={(e) => setConfig(prev => ({ ...prev, styleWeight: parseFloat(e.target.value) }))}
                                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-[9px] text-neutral-500 block leading-normal">Higher values force strict adherence to genre/style tags; lower values encourage unexpected creative fusion.</span>
                                </div>

                                {/* Weirdness Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                                        <span>Weirdness constraint</span>
                                        <span className="font-mono text-blue-400">{config.weirdnessConstraint.toFixed(2)}</span>
                                    </div>
                                    <input 
                                        type="range"
                                        min="0.0"
                                        max="1.0"
                                        step="0.05"
                                        value={config.weirdnessConstraint}
                                        onChange={(e) => setConfig(prev => ({ ...prev, weirdnessConstraint: parseFloat(e.target.value) }))}
                                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <span className="text-[9px] text-neutral-500 block leading-normal">Elevates randomness and avant-garde style experimentation. Maintain near 0.1 for standard melodic coherence.</span>
                                </div>

                                {/* Audio Weight Slider (conditional for Cover Mode) */}
                                {config.taskType === 'cover_music' && (
                                    <div className="space-y-1 p-2 bg-blue-950/10 border border-blue-500/10 rounded-lg">
                                        <div className="flex justify-between items-center text-[10px] font-black text-blue-400 uppercase tracking-wider">
                                            <span>Original Audio Retention (Weight)</span>
                                            <span className="font-mono text-blue-400">{(config.audioWeight * 100).toFixed(0)}%</span>
                                        </div>
                                        <input 
                                            type="range"
                                            min="0.1"
                                            max="1.0"
                                            step="0.05"
                                            value={config.audioWeight}
                                            onChange={(e) => setConfig(prev => ({ ...prev, audioWeight: parseFloat(e.target.value) }))}
                                            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-[9px] text-neutral-400 block leading-normal mt-0.5">Controls how closely the cover transformation preserves the original vocal melody and orchestration structures.</span>
                                    </div>
                                )}

                                {/* Negative Tags */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Negative Style Tags (Avoid)</label>
                                    <input
                                        type="text"
                                        value={config.negativeTags}
                                        onChange={(e) => setConfig(prev => ({ ...prev, negativeTags: e.target.value }))}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="e.g. high-pitched vocals, aggressive drums, lo-fi"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submit Section */}
                    <div className="pt-2 border-t border-neutral-800">
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isLoading || (!config.customMode && !config.gptDescriptionPrompt.trim())}
                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                isLoading 
                                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' 
                                    : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.99] shadow-lg shadow-blue-950/50'
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <LoadingSpinner className="w-4 h-4 text-blue-500 animate-spin" />
                                    Synthesizing Soundtrack ({formatTime(timeElapsed)})...
                                </>
                            ) : (
                                <>
                                    <AudioSparkIcon className="w-4 h-4" />
                                    Synthesize Soundtrack
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Status/Output player column */}
                <div className="flex flex-col space-y-6 justify-between h-full">
                    {/* Status Console Monitor */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex flex-col justify-between flex-grow min-h-[220px]">
                        <div>
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block mb-3">Live Engine Status Monitor</span>
                            
                            {taskState === 'IDLE' && (
                                <div className="text-neutral-500 text-xs py-8 text-center">
                                    <AudioSparkIcon className="w-10 h-10 mx-auto text-neutral-700 mb-2" />
                                    <p className="font-bold">Sonic Engine Idle</p>
                                    <p className="text-[10px] text-neutral-600 mt-1">Configure your musical components and hit Synthesize to commence score generation.</p>
                                </div>
                            )}

                            {(taskState === 'QUEUED' || taskState === 'RUNNING') && (
                                <div className="space-y-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 flex items-center justify-center">
                                                <LoadingSpinner className="w-6 h-6 text-blue-500 animate-spin" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-white capitalize">{taskState.toLowerCase()} on AI Server</p>
                                            <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Task ID: {taskId?.substring(0, 16)}...</p>
                                        </div>
                                    </div>

                                    {/* Simulated terminal logging */}
                                    <div className="bg-neutral-950 rounded border border-neutral-800 p-3 h-24 overflow-y-auto custom-scrollbar">
                                        <p className="text-[10px] font-mono text-blue-400 leading-normal">{progressLog}</p>
                                        <p className="text-[9px] font-mono text-neutral-600 mt-1">Elapsed synthesis duration: {timeElapsed} seconds...</p>
                                    </div>
                                </div>
                            )}

                            {taskState === 'FAILED' && (
                                <div className="border border-red-500/10 bg-red-950/10 rounded-lg p-4 space-y-2 py-6">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 bg-red-500/10 rounded text-red-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-400">Engine Composition Failure</p>
                                            <p className="text-[10px] text-neutral-400 font-mono mt-1 leading-relaxed">{errorMessage || "The synthesis was cancelled due to an internal API server error."}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {taskState === 'SUCCESS' && (
                                <div className="border border-emerald-500/10 bg-emerald-950/10 rounded-lg p-4 py-6 space-y-2">
                                    <div className="flex items-start gap-3">
                                        <div className="p-1 bg-emerald-500/10 rounded text-emerald-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-emerald-400">Audio Synthesis Ready</p>
                                            <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">The high-fidelity track has been successfully compiled and mixed into stereo.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Integrated Audio Player */}
                    {audioUrl && (
                        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-4">
                            <audio 
                                ref={audioRef} 
                                src={audioUrl}
                                onTimeUpdate={() => {
                                    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                                }}
                                onLoadedMetadata={() => {
                                    if (audioRef.current) setDuration(audioRef.current.duration);
                                }}
                                onEnded={() => setIsPlaying(false)}
                                className="hidden"
                            />
                            
                            {/* Track Metadata (NO PILLS) */}
                            <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-grow">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block">Currently Loaded Score</span>
                                    <h4 className="text-sm font-semibold text-white truncate mt-1">{activeTrackTitle || 'Sonic Score Composition'}</h4>
                                    <p className="text-[11px] text-neutral-400 truncate mt-0.5 max-w-[90%]">{activeTrackPrompt}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleSaveCurrentTrack}
                                        className="text-neutral-400 hover:text-white transition-colors p-1 bg-neutral-950 border border-neutral-800 rounded-lg"
                                        title="Save Track to Project Vault"
                                    >
                                        {saveSuccess ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                                <polyline points="7 3 7 8 15 8"></polyline>
                                            </svg>
                                        )}
                                    </button>
                                    <a 
                                        href={audioUrl} 
                                        download={`sonic_score_${Date.now()}.mp3`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-neutral-400 hover:text-white transition-colors p-1 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-center"
                                        title="Download MP3 File"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                    </a>
                                </div>
                            </div>

                            {/* Waveform Seek Slider */}
                            <div className="space-y-1">
                                <input 
                                    type="range"
                                    min="0"
                                    max={duration || 100}
                                    value={currentTime}
                                    onChange={handleSeekChange}
                                    className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 tabular-nums">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Player Controls Grid */}
                            <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={handlePlayPause}
                                        className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow shadow-blue-900/40"
                                    >
                                        {isPlaying ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                                                <rect x="14" y="4" width="4" height="16" rx="1"></rect>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M8 5v14l11-7z"></path>
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Volume Slider */}
                                <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 border border-neutral-800 rounded-lg">
                                    <button 
                                        onClick={handleToggleMute}
                                        className="text-neutral-400 hover:text-white transition-colors"
                                    >
                                        {isMuted ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                                <path d="M9 9v6a3 3 0 0 0 3 3h1.586l4.707 4.707A1 1 0 0 0 20 22V4a1 1 0 0 0-1.707-.707L13.586 8H12a3 3 0 0 0-3 3z"></path>
                                            </svg>
                                        ) : (
                                            <SpeakerIcon className="w-4 h-4" />
                                        )}
                                    </button>
                                    <input 
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={isMuted ? 0 : volume}
                                        onChange={handleVolumeChange}
                                        className="w-16 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Save Status Notification Banner */}
            {saveSuccess && (
                <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-lg text-emerald-400 text-xs font-bold text-center animate-pulse">
                    Track Successfully Archived to Project Vault!
                </div>
            )}

            {/* Saved Tracks / Project Vault Section */}
            <div className="border-t border-neutral-800 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <AudioSparkIcon className="w-5 h-5 text-blue-500" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Project Composition Vault ({savedTracks.length})</h3>
                </div>

                {savedTracks.length === 0 ? (
                    <div className="border border-dashed border-neutral-800 rounded-lg p-10 text-center text-neutral-600">
                        <p className="text-xs font-bold">No saved tracks in this project.</p>
                        <p className="text-[10px] text-neutral-700 mt-1">Tracks synthesized in this session can be archived here for instant recall.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedTracks.map((track) => (
                            <div 
                                key={track.id} 
                                className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between hover:border-neutral-700 transition-colors"
                            >
                                <div className="min-w-0 pr-4 flex-grow">
                                    <p className="text-xs font-bold text-white truncate">{track.genre || 'Sonic Composition'}</p>
                                    
                                    {/* Static Metadata (NO PILLS, zero-pill instruction) */}
                                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono mt-1">
                                        <span>Model: {track.instrumentProfile}</span>
                                        <span aria-hidden="true">·</span>
                                        <span className="tabular-nums">Duration: {track.duration}s</span>
                                        <span aria-hidden="true">·</span>
                                        <span>ID: {track.id.substring(0, 12)}...</span>
                                    </div>
                                    
                                    <p className="text-[10px] text-neutral-400 truncate mt-1.5">{track.prompt}</p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button 
                                        onClick={() => handleLoadSavedTrack(track)}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1.5 rounded transition-colors"
                                        title="Load track in audio player"
                                    >
                                        Load
                                    </button>
                                    <button 
                                        onClick={() => handleTriggerExtend(track)}
                                        className="text-xs bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-bold px-2.5 py-1.5 rounded transition-colors"
                                        title="Extend this track"
                                    >
                                        Extend
                                    </button>
                                    <button 
                                        onClick={() => handleTriggerCover(track)}
                                        className="text-[11px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2 py-1.5 rounded transition-colors"
                                        title="Cover style-transfer"
                                    >
                                        Cover
                                    </button>
                                    <button 
                                        onClick={() => handleCopyPrompt(track.id, track.prompt)}
                                        className="text-[10px] bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 px-2 py-1.5 rounded transition-colors"
                                        title="Copy prompt text to clipboard"
                                    >
                                        {copiedTrackId === track.id ? 'Copied' : 'Copy'}
                                    </button>
                                    {onDeleteTrack && (
                                        <button 
                                            onClick={() => onDeleteTrack(track.id)}
                                            className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                                            title="Delete track"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
