import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Agent } from '../types';
import { useLiveChat } from '../hooks/useLiveChat';
import { MicIcon, MicOffIcon, SpeakerIcon, SpeakerOffIcon, UserIcon, AudioSparkIcon } from './icons';
import { ChatMessage } from './ChatMessage';

interface LiveStudioProps {
    agents: Agent[];
}

const AudioVisualizer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number>();

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');

        const draw = () => {
            if (!canvasCtx) return;
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            canvasCtx.fillStyle = '#171717'; // secondary
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = '#2563eb'; // brand
            canvasCtx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        };

        draw();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            source.disconnect();
            analyser.disconnect();
            if (audioContext.state !== 'closed') {
                audioContext.close();
            }
        };
    }, [stream]);

    return <canvas ref={canvasRef} width="300" height="50" className="rounded-lg" />;
};


export const LiveStudio: React.FC<LiveStudioProps> = ({ agents }) => {
    const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isMicMuted, setIsMicMuted] = useState(true);
    const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
    
    const [conversationHistory, setConversationHistory] = useState<{ id: string, role: 'user' | 'model', parts: { text?: string }[] }[]>([]);
    
    const mediaStreamForVisualizer = useRef<MediaStream | null>(null);

    const handleTurnComplete = useCallback((turn: { user: string; model: string }) => {
        if (turn.user.trim()) {
            setConversationHistory(prev => [...prev, { id: `user-turn-${Date.now()}`, role: 'user', parts: [{ text: turn.user }] }]);
        }
        if (turn.model.trim()) {
            setConversationHistory(prev => [...prev, { id: `model-turn-${Date.now()}`, role: 'model', parts: [{ text: turn.model }] }]);
        }
    }, []);
    
    const { connectionState, liveTranscript, startLiveChat, stopLiveChat } = useLiveChat(
        selectedAgent!,
        {
            isMicMuted,
            isSpeakerMuted,
            onTurnComplete: handleTurnComplete,
            onToolCall: async (toolCalls) => { console.log("Tool call received in studio:", toolCalls); return []; }
        }
    );

    useEffect(() => {
        if (isSessionActive) {
            const start = async () => {
                const stream = await startLiveChat();
                if (stream) {
                    mediaStreamForVisualizer.current = stream;
                }
            };
            start();
        } else {
            stopLiveChat();
            mediaStreamForVisualizer.current = null;
        }
    }, [isSessionActive, selectedAgentId, startLiveChat, stopLiveChat]);

    useEffect(() => {
        return () => {
            stopLiveChat();
        };
    }, [stopLiveChat]);
    
    const handleToggleSession = () => {
        setIsSessionActive(prev => !prev);
        if (!isSessionActive) {
            setIsMicMuted(false);
        } else {
            setIsMicMuted(true);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto w-full h-full flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
            <div className="flex-shrink-0">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2 flex items-center gap-3">
                    <AudioSparkIcon className="w-8 h-8 text-brand" />
                    Live Conversation Studio
                </h2>
                <p className="text-neutral-400">Speak directly with an AI agent in real-time.</p>
            </div>
            
            <div className="bg-surface border border-accent p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Agent:</label>
                    <select
                        value={selectedAgentId}
                        onChange={(e) => setSelectedAgentId(e.target.value)}
                        className="bg-secondary border border-accent p-2 rounded-lg text-white text-sm focus:ring-1 focus:ring-brand outline-none"
                        disabled={isSessionActive}
                    >
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleToggleSession}
                        className={`px-6 py-3 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg ${
                            isSessionActive 
                                ? 'bg-red-600 hover:bg-red-500 text-white' 
                                : 'bg-brand hover:bg-brand-hover text-white'
                        }`}
                    >
                        {isSessionActive ? 'End Conversation' : 'Start Conversation'}
                    </button>
                    <button onClick={() => setIsMicMuted(p => !p)} className={`p-3 rounded-xl border transition-colors ${!isMicMuted ? 'bg-brand border-brand-hover' : 'bg-secondary border-accent'}`} title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}>
                        {isMicMuted ? <MicOffIcon className="w-5 h-5"/> : <MicIcon className="w-5 h-5"/>}
                    </button>
                    <button onClick={() => setIsSpeakerMuted(p => !p)} className={`p-3 rounded-xl border transition-colors ${!isSpeakerMuted ? 'bg-brand border-brand-hover' : 'bg-secondary border-accent'}`} title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}>
                        {isSpeakerMuted ? <SpeakerOffIcon className="w-5 h-5"/> : <SpeakerIcon className="w-5 h-5"/>}
                    </button>
                </div>
            </div>

            <div className="bg-surface border border-accent p-6 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full transition-colors ${connectionState === 'CONNECTED' ? 'bg-green-500 animate-pulse' : (connectionState === 'CONNECTING' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500')}`}></div>
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{connectionState}</span>
                    </div>
                     {!isMicMuted && isSessionActive && <AudioVisualizer stream={mediaStreamForVisualizer.current} />}
                </div>

                <div className="bg-primary p-4 rounded-lg min-h-[100px] font-mono text-sm space-y-2 border border-secondary">
                    <p><span className="font-bold text-neutral-500">YOU:</span> <span className="text-neutral-300">{liveTranscript.user}</span></p>
                    <div className="h-px bg-accent my-2"></div>
                    <p><span className="font-bold text-blue-400">{selectedAgent?.name?.toUpperCase()}:</span> <span className="text-white">{liveTranscript.model}</span></p>
                </div>
            </div>

            <div className="flex-grow space-y-4">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Conversation Log</h3>
                {conversationHistory.length > 0 ? (
                    conversationHistory.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} agent={msg.role === 'model' ? selectedAgent : null} onPlayAudio={()=>{}} onStopAudio={()=>{}} onGenerateAudio={()=>{}}/>
                    ))
                ) : (
                    <div className="text-center text-neutral-600 py-16 border-2 border-dashed border-accent rounded-xl">
                        <p>Completed conversation turns will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};