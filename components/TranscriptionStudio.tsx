import React, { useState, useEffect, useRef } from 'react';
import { SavedTranscript } from '../types';

interface TranscriptionStudioProps {
    transcripts?: SavedTranscript[];
    onSaveTranscript: (transcript: SavedTranscript) => void;
    onDeleteTranscript: (id: string) => void;
}

export const TranscriptionStudio: React.FC<TranscriptionStudioProps> = ({
    transcripts = [],
    onSaveTranscript,
    onDeleteTranscript
}) => {
    // Input methods: 'upload' | 'link' | 'mic'
    const [inputMethod, setInputMethod] = useState<'upload' | 'link' | 'mic'>('upload');
    
    // File upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadBase64, setUploadBase64] = useState<string | null>(null);
    
    // Link input state
    const [mediaUrl, setMediaUrl] = useState('');
    
    // Mic recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const [recordBlob, setRecordBlob] = useState<Blob | null>(null);
    const [recordUrl, setRecordUrl] = useState<string | null>(null);
    const [micBase64, setMicBase64] = useState<string | null>(null);
    
    // Gemini Settings
    const [prompt, setPrompt] = useState('Transcribe this audio file accurately. Identify speakers if possible, and structure the output into readable paragraphs.');
    const [action, setAction] = useState<'transcribe' | 'summary' | 'takeaways' | 'chapters'>('transcribe');
    
    // Runtime status
    const [status, setStatus] = useState<'idle' | 'transcribing' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [resultText, setResultText] = useState<string | null>(null);
    const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);
    
    // Saving state
    const [saveTitle, setSaveTitle] = useState('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    
    // Refs for recording & visualizer
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Audio Visualizer effect
    const startVisualizer = (stream: MediaStream) => {
        try {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const draw = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                const width = canvas.width;
                const height = canvas.height;
                
                analyser.getByteFrequencyData(dataArray);
                
                ctx.fillStyle = '#0a0a0a';
                ctx.fillRect(0, 0, width, height);

                const barWidth = (width / bufferLength) * 1.5;
                let barHeight;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    barHeight = (dataArray[i] / 255) * height * 0.9;
                    
                    // Gradient fill for visual bars
                    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
                    gradient.addColorStop(0, '#2563eb'); // Blue-600
                    gradient.addColorStop(1, '#60a5fa'); // Blue-400
                    
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

                    x += barWidth;
                }
                
                animationFrameRef.current = requestAnimationFrame(draw);
            };
            
            draw();
        } catch (e) {
            console.error("Failed to start visualizer", e);
        }
    };

    const stopVisualizer = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
        }
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    // Recording controls
    const startRecording = async () => {
        try {
            setError(null);
            setRecordBlob(null);
            setRecordUrl(null);
            setMicBase64(null);
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;
            
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            recorder.onstop = () => {
                const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                setRecordBlob(audioBlob);
                const localUrl = URL.createObjectURL(audioBlob);
                setRecordUrl(localUrl);
                
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    setMicBase64(reader.result as string);
                };
            };
            
            recorder.start();
            setIsRecording(true);
            setRecordSeconds(0);
            
            timerRef.current = window.setInterval(() => {
                setRecordSeconds(prev => prev + 1);
            }, 1000);
            
            startVisualizer(stream);
        } catch (err: any) {
            console.error("Microphone access error", err);
            setError("Could not access microphone. Please check your browser permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        setIsRecording(false);
        stopVisualizer();
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (recordUrl) URL.revokeObjectURL(recordUrl);
            stopVisualizer();
        };
    }, [recordUrl]);

    // Handle File inputs
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setError(null);
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                setUploadBase64(reader.result as string);
            };
        }
    };

    // Core submit function
    const handleTranscribe = async () => {
        setStatus('transcribing');
        setError(null);
        setResultText(null);

        let payload: any = {
            prompt,
            action
        };

        if (inputMethod === 'upload') {
            if (!uploadBase64) {
                setError("Please upload an audio/video file first.");
                setStatus('error');
                return;
            }
            payload.base64 = uploadBase64;
            payload.mimeType = selectedFile?.type || 'audio/mp3';
        } else if (inputMethod === 'link') {
            if (!mediaUrl.trim()) {
                setError("Please specify a valid audio or video URL link.");
                setStatus('error');
                return;
            }
            payload.url = mediaUrl.trim();
        } else if (inputMethod === 'mic') {
            if (!micBase64) {
                setError("Please record audio before submitting.");
                setStatus('error');
                return;
            }
            payload.base64 = micBase64;
            payload.mimeType = 'audio/webm';
        }

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to transcribe content.");
            }

            setResultText(data.text);
            setStatus('success');
            
            // Set default title for saving
            const defaultTitle = inputMethod === 'upload' 
                ? selectedFile?.name || 'Uploaded Transcript'
                : inputMethod === 'link' 
                ? 'Linked Media Transcript'
                : `Voice Note ${new Date().toLocaleDateString()}`;
            setSaveTitle(defaultTitle);
            
        } catch (err: any) {
            console.error("Transcription error:", err);
            setError(err.message || "An unexpected error occurred during transcription.");
            setStatus('error');
        }
    };

    // Local project saving triggers
    const handleSaveTrigger = () => {
        if (!resultText) return;
        setShowSaveModal(true);
    };

    const confirmSave = () => {
        if (!resultText || !saveTitle.trim()) return;

        const newSaved: SavedTranscript = {
            id: `tr_${Date.now()}`,
            title: saveTitle.trim(),
            text: resultText,
            promptUsed: prompt,
            actionUsed: action,
            fileNameOrUrl: inputMethod === 'upload' 
                ? selectedFile?.name 
                : inputMethod === 'link' 
                ? mediaUrl 
                : 'Microphone Capture',
            timestamp: Date.now()
        };

        onSaveTranscript(newSaved);
        setShowSaveModal(false);
        setActiveTranscriptId(newSaved.id);
    };

    // Text export utilities
    const downloadTxt = (title: string, text: string) => {
        const element = document.createElement("a");
        const file = new Blob([text], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${title.toLowerCase().replace(/\s+/g, '_')}_transcript.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Transcript copied to clipboard!");
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="p-6 max-w-6xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex justify-between items-center flex-shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-neutral-100 tracking-tight">Transcription Studio</h2>
                    <p className="text-sm text-neutral-400 mt-1">
                        High-fidelity transcription and cognitive audio processing powered by <span className="text-blue-400 font-bold">Gemini 3.5 Transcribe</span>.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-xs font-black uppercase text-neutral-400 tracking-widest">Core Engine Active</span>
                </div>
            </div>

            {/* Main Workbench Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow items-start">
                
                {/* Left Side: Controls & Input Panel */}
                <div className="lg:col-span-1 flex flex-col space-y-6">
                    
                    {/* Media Input Container */}
                    <div className="bg-neutral-800/40 border border-neutral-700/60 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
                        <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">01 — Source selection</span>
                        
                        {/* Selector Tabs */}
                        <div className="grid grid-cols-3 gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                            <button
                                className={`py-2 text-xs font-bold rounded transition-all ${inputMethod === 'upload' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                onClick={() => { setInputMethod('upload'); setError(null); }}
                            >
                                File Upload
                            </button>
                            <button
                                className={`py-2 text-xs font-bold rounded transition-all ${inputMethod === 'link' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                onClick={() => { setInputMethod('link'); setError(null); }}
                            >
                                Link URL
                            </button>
                            <button
                                className={`py-2 text-xs font-bold rounded transition-all ${inputMethod === 'mic' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                onClick={() => { setInputMethod('mic'); setError(null); }}
                            >
                                Micro Record
                            </button>
                        </div>

                        {/* Upload Panel */}
                        {inputMethod === 'upload' && (
                            <div className="space-y-4">
                                <div 
                                    className="border-2 border-dashed border-neutral-700 hover:border-blue-500/50 bg-neutral-900/40 rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <svg className="w-8 h-8 text-neutral-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <span className="text-xs font-bold text-neutral-300 text-center">
                                        {selectedFile ? selectedFile.name : "Select or Drop Audio/Video File"}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest">
                                        MP3, WAV, WEBM, M4A, MP4 (Max 100MB)
                                    </span>
                                    <input 
                                        type="file" 
                                        accept="audio/*,video/*" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                    />
                                </div>
                                {selectedFile && (
                                    <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 flex items-center justify-between">
                                        <div className="min-w-0">
                                            <p className="text-xs text-neutral-300 font-bold truncate">{selectedFile.name}</p>
                                            <p className="text-[9px] text-neutral-500 uppercase">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                        <button 
                                            onClick={() => { setSelectedFile(null); setUploadBase64(null); }}
                                            className="text-xs text-red-400 hover:text-red-300 font-black uppercase tracking-wider"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Link Panel */}
                        {inputMethod === 'link' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Paste Shared Media URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://example.com/podcast.mp3 or video.mp4"
                                        className="w-full bg-neutral-900 border border-neutral-700/80 p-3 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 mt-1"
                                        value={mediaUrl}
                                        onChange={(e) => setMediaUrl(e.target.value)}
                                    />
                                </div>
                                <p className="text-[10px] text-neutral-500">
                                    The server downloads and processes files directly to avoid CORS issues. Perfect for transcribing stream recordings, direct links, or cloud assets.
                                </p>
                            </div>
                        )}

                        {/* Mic Recording Panel */}
                        {inputMethod === 'mic' && (
                            <div className="flex flex-col space-y-4">
                                <div className="bg-neutral-900/80 p-4 rounded-xl border border-neutral-800 flex flex-col items-center justify-center space-y-3 relative overflow-hidden min-h-[140px]">
                                    {isRecording ? (
                                        <div className="flex flex-col items-center space-y-2 z-10">
                                            <span className="text-2xl font-black text-red-500 font-mono tracking-wider animate-pulse">
                                                {formatDuration(recordSeconds)}
                                            </span>
                                            <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                                                Recording Audio...
                                            </span>
                                        </div>
                                    ) : recordUrl ? (
                                        <div className="flex flex-col items-center space-y-2 w-full z-10">
                                            <span className="text-xs text-green-400 font-bold uppercase tracking-wide">✓ Capture complete</span>
                                            <audio src={recordUrl} controls className="w-full h-8 mt-1" />
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 z-10">
                                            <p className="text-xs text-neutral-400 font-bold">Ready to record high-fidelity voice note</p>
                                        </div>
                                    )}

                                    {/* Canvas Visualizer */}
                                    <canvas 
                                        ref={canvasRef} 
                                        className="absolute inset-0 w-full h-full opacity-40 rounded-xl"
                                        width={240}
                                        height={140}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    {!isRecording ? (
                                        <button
                                            onClick={startRecording}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                                            Start Capture
                                        </button>
                                    ) : (
                                        <button
                                            onClick={stopRecording}
                                            className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="w-2.5 h-2.5 bg-white"></span>
                                            Stop & Save
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Gemini Settings & Modality Picker */}
                    <div className="bg-neutral-800/40 border border-neutral-700/60 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
                        <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">02 — Process Option</span>

                        {/* Modalities */}
                        <div>
                            <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Cognitive Target Method</label>
                            <div className="grid grid-cols-2 gap-2 mt-1.5">
                                <button
                                    className={`p-3 text-left border rounded-lg transition-all flex flex-col ${action === 'transcribe' ? 'bg-blue-950/40 border-blue-500/80 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'}`}
                                    onClick={() => setAction('transcribe')}
                                >
                                    <span className="text-xs font-bold">Standard</span>
                                    <span className="text-[8px] text-neutral-500 uppercase tracking-wider mt-0.5">Accurate Word-for-Word</span>
                                </button>
                                <button
                                    className={`p-3 text-left border rounded-lg transition-all flex flex-col ${action === 'summary' ? 'bg-blue-950/40 border-blue-500/80 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'}`}
                                    onClick={() => setAction('summary')}
                                >
                                    <span className="text-xs font-bold">Summarized</span>
                                    <span className="text-[8px] text-neutral-500 uppercase tracking-wider mt-0.5">Synthesis + Summary</span>
                                </button>
                                <button
                                    className={`p-3 text-left border rounded-lg transition-all flex flex-col ${action === 'takeaways' ? 'bg-blue-950/40 border-blue-500/80 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'}`}
                                    onClick={() => setAction('takeaways')}
                                >
                                    <span className="text-xs font-bold">Action-Items</span>
                                    <span className="text-[8px] text-neutral-500 uppercase tracking-wider mt-0.5">Key Decisions & To-Dos</span>
                                </button>
                                <button
                                    className={`p-3 text-left border rounded-lg transition-all flex flex-col ${action === 'chapters' ? 'bg-blue-950/40 border-blue-500/80 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'}`}
                                    onClick={() => setAction('chapters')}
                                >
                                    <span className="text-xs font-bold">Chapterized</span>
                                    <span className="text-[8px] text-neutral-500 uppercase tracking-wider mt-0.5">Segmented topical timeline</span>
                                </button>
                            </div>
                        </div>

                        {/* Prompt Customizer */}
                        <div>
                            <label className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Instructions / Prompt Override</label>
                            <textarea
                                className="w-full bg-neutral-900 border border-neutral-700/80 p-3 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500 mt-1 resize-none"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={3}
                                placeholder="E.g., Format transcription cleanly. Annotate multiple speakers, highlight questions."
                            />
                        </div>

                        {/* Processing Action Trigger */}
                        <button
                            onClick={handleTranscribe}
                            disabled={status === 'transcribing' || isRecording}
                            className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2 ${
                                status === 'transcribing'
                                    ? 'bg-neutral-800 border border-neutral-700/50 cursor-not-allowed text-neutral-500'
                                    : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 active:scale-95 shadow-lg shadow-blue-900/30'
                            }`}
                        >
                            {status === 'transcribing' ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Cognitive Transcribing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                    Initiate Cognitive Process
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Side: Process Logs, Outputs & Visual Canvas */}
                <div className="lg:col-span-2 flex flex-col space-y-6">
                    
                    {error && (
                        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-200 text-xs font-medium flex items-center gap-3">
                            <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Result Panel */}
                    <div className="bg-neutral-800/40 border border-neutral-700/60 rounded-xl p-6 shadow-lg flex-grow flex flex-col min-h-[460px]">
                        <div className="flex justify-between items-center pb-4 border-b border-neutral-800">
                            <div>
                                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">03 — Cognitive Output</span>
                                {action !== 'transcribe' && (
                                    <span className="ml-2 px-2 py-0.5 bg-blue-900/40 text-[9px] font-black uppercase text-blue-400 rounded tracking-wider border border-blue-500/20">
                                        {action}
                                    </span>
                                )}
                            </div>
                            {resultText && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => downloadTxt(saveTitle || "transcript", resultText)}
                                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-[10px] font-bold uppercase border border-neutral-800"
                                        title="Download as TXT"
                                    >
                                        Export TXT
                                    </button>
                                    <button
                                        onClick={() => copyToClipboard(resultText)}
                                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded text-[10px] font-bold uppercase border border-neutral-800"
                                        title="Copy text"
                                    >
                                        Copy
                                    </button>
                                    <button
                                        onClick={handleSaveTrigger}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-black uppercase"
                                    >
                                        Save to Project
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Display Area */}
                        <div className="flex-grow overflow-y-auto max-h-[500px] mt-4 custom-scrollbar text-neutral-300 text-sm leading-relaxed pr-2">
                            {status === 'transcribing' ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full border-4 border-neutral-800 border-t-blue-500 animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[10px] text-blue-400 font-bold">AI</span>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-neutral-300">Gleaning sound fields & temporal waves...</p>
                                        <p className="text-[10px] text-neutral-500 uppercase mt-1 tracking-widest">Generating structured language map</p>
                                    </div>
                                </div>
                            ) : resultText ? (
                                <div className="whitespace-pre-line font-serif text-neutral-200 text-base max-w-none prose prose-invert bg-neutral-950/30 p-5 rounded-xl border border-neutral-800">
                                    {resultText}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-24 text-neutral-500">
                                    <svg className="w-12 h-12 text-neutral-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">No output synthesized yet</p>
                                    <p className="text-[10px] text-neutral-600 mt-1">Upload a recording or initiate a microphone audio stream to begin processing.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Past Saved Transcripts */}
                    <div className="bg-neutral-800/40 border border-neutral-700/60 rounded-xl p-5 shadow-lg">
                        <span className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-3 block">Saved Transcripts Bible ({transcripts.length})</span>
                        
                        {transcripts.length === 0 ? (
                            <p className="text-xs text-neutral-500 italic">No saved transcripts in the current project database.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                {transcripts.map((t) => (
                                    <div 
                                        key={t.id} 
                                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                                            activeTranscriptId === t.id 
                                                ? 'bg-neutral-900 border-blue-500/80 shadow-sm shadow-blue-500/5' 
                                                : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700/80'
                                        }`}
                                        onClick={() => {
                                            setResultText(t.text);
                                            setAction(t.actionUsed as any || 'transcribe');
                                            setPrompt(t.promptUsed || '');
                                            setSaveTitle(t.title);
                                            setActiveTranscriptId(t.id);
                                        }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className="text-xs font-bold text-neutral-200 truncate pr-2 flex-grow">{t.title}</p>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Are you sure you want to delete transcript "${t.title}"?`)) {
                                                        onDeleteTranscript(t.id);
                                                        if (activeTranscriptId === t.id) {
                                                            setResultText(null);
                                                            setActiveTranscriptId(null);
                                                        }
                                                    }
                                                }}
                                                className="text-[10px] text-neutral-600 hover:text-red-400 uppercase font-black tracking-wider transition-colors"
                                                title="Delete"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-neutral-500 mt-1 uppercase tracking-widest font-mono">
                                            {new Date(t.timestamp).toLocaleDateString()} — {t.fileNameOrUrl || 'Capt'}
                                        </p>
                                        {t.actionUsed && t.actionUsed !== 'transcribe' && (
                                            <span className="inline-block px-1.5 py-0.5 bg-neutral-800 text-[8px] font-bold text-neutral-400 rounded mt-1.5 border border-neutral-700/40 uppercase">
                                                {t.actionUsed}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Title Dialog / Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
                        <h3 className="text-lg font-black text-white tracking-tight">Save Transcript to Project</h3>
                        <p className="text-xs text-neutral-400 mt-1">
                            Save this transcription to the project vault to store and access it at any time.
                        </p>
                        
                        <div className="mt-4">
                            <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Document Title</label>
                            <input
                                type="text"
                                className="w-full bg-neutral-950 border border-neutral-800 p-3 rounded-lg text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-blue-500 mt-1.5 font-bold"
                                value={saveTitle}
                                onChange={(e) => setSaveTitle(e.target.value)}
                                placeholder="E.g., Production Meeting Audio Notes"
                            />
                        </div>

                        <div className="flex gap-2 justify-end mt-6">
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-lg uppercase tracking-wider"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSave}
                                disabled={!saveTitle.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black rounded-lg uppercase tracking-wider"
                            >
                                Save Document
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
