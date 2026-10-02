import React, { useState, useRef, useEffect } from 'react';
import { Agent, ImageState } from '../types.ts';
import { CloseIcon, PhoneIcon, AutomationIcon, MagicIcon, ScriptIcon, ImageIcon, CameraLensIcon, SpeakerIcon } from './icons.tsx';
import { TrashIcon } from './icons/TrashIcon';
import { UploadIcon } from './icons/UploadIcon';
import { getAvailableVoices } from '../services/agentService';
import { UserIcon } from './icons/UserIcon.tsx';
import { PencilIcon } from './icons/PencilIcon.tsx';

interface RosterStudioProps {
    agents: Agent[];
    images: ImageState[]; // This is the global project vault, kept for potential future use
    onCreateEntity: (data: Partial<Agent>) => Agent;
    onViewImage: (image: ImageState) => void;
    onUpdateEntity: (agentId: string, updates: Partial<Agent>) => void;
    onDeleteEntity: (agentId: string) => void;
    onImageUpload: (agentId: string, file: File) => void;
    onCallEntity: (agent: Agent) => void;
}

const ProfileModal: React.FC<{
    agent: Agent;
    assignedImages: ImageState[]; // Now represents agent.media
    onClose: () => void;
    onSave: (updatedAgent: Partial<Agent>) => void;
    onImageUpload: (agentId: string, file: File) => void;
    onViewImage: (image: ImageState) => void;
}> = ({ agent, assignedImages, onClose, onSave, onImageUpload, onViewImage }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    // Form State
    const [name, setName] = useState(agent.name);
    const [bio, setBio] = useState(agent.bio || '');
    const [narrativeRole, setNarrativeRole] = useState(agent.narrativeRole || '');
    const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
    const [voice, setVoice] = useState(agent.voice || 'Kore');
    const [voiceReference, setVoiceReference] = useState(agent.voiceReference || '');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const voiceSeedInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setName(agent.name);
        setBio(agent.bio || '');
        setNarrativeRole(agent.narrativeRole || '');
        setSystemPrompt(agent.systemPrompt || '');
        setVoice(agent.voice || 'Kore');
        setVoiceReference(agent.voiceReference || '');
    }, [agent]);

    const handleSave = () => {
        onSave({
            name, bio, narrativeRole, systemPrompt, voice, voiceReference
        });
        setIsEditing(false);
    };

    const handleVoiceSeedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setVoiceReference(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const title = 'Agent Configuration';
    const subtitle = 'Core Directives & Private Gallery';
    const saveButtonText = 'Save Configuration';
    
    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-neutral-900 border border-neutral-700 w-full max-w-6xl h-[90vh] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-neutral-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{title}</h2>
                        <p className="text-sm text-neutral-400">{subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isEditing ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>
                            {isEditing ? 'Editing Mode' : 'Edit Details'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full"><CloseIcon /></button>
                    </div>
                </div>
                <div className="flex-grow flex overflow-hidden">
                    {/* Left Column (Avatar & Images) */}
                    <div className="w-2/5 bg-black flex flex-col border-r border-neutral-800 p-6 overflow-y-auto">
                        <div className="flex flex-col items-center mb-8">
                             <div 
                                className="w-48 h-48 rounded-full bg-neutral-800 border-4 border-neutral-700 overflow-hidden mb-4 relative group cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {agent.avatar ? (
                                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                        <UserIcon className="w-20 h-20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <UploadIcon className="w-8 h-8 text-white" />
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            onImageUpload(agent.id, e.target.files[0]);
                                        }
                                    }} 
                                />
                            </div>
                            <h3 className="text-xl font-bold text-white text-center">{name}</h3>
                            <p className="text-blue-400 font-medium text-sm text-center">{narrativeRole || 'Specialist'}</p>
                        </div>
                        
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Private Gallery ({assignedImages.length})</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {assignedImages.map((img) => (
                                    <div key={img.id} className="aspect-square bg-neutral-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500" onClick={() => onViewImage(img)}>
                                        {img.type === 'video' ? (
                                            <video src={img.url} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={`data:${img.mimeType};base64,${img.base64}`} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Right Column: Data */}
                    <div className="w-3/5 p-8 overflow-y-auto">
                        {isEditing ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Agent Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg text-xl font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Agent Bio</label>
                                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full bg-neutral-800 p-3 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Specialty</label>
                                    <input type="text" value={narrativeRole} onChange={e => setNarrativeRole(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">System Prompt (Directives)</label>
                                    <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={8} className="w-full bg-neutral-800 p-3 rounded-lg font-mono text-xs" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Voice Model</label>
                                    <select value={voice} onChange={e => setVoice(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg">
                                        {getAvailableVoices().map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Voice Seed (Reference Audio)</label>
                                    <div className="bg-neutral-800 p-3 rounded-lg">
                                        {voiceReference ? (
                                            <div className="flex flex-col gap-3">
                                                <audio controls src={voiceReference} className="w-full h-10" />
                                                <button type="button" onClick={() => setVoiceReference('')} className="text-xs text-red-400 hover:text-red-300 font-bold self-end">Remove Seed</button>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-neutral-500">No voice reference uploaded.</p>
                                        )}
                                        <button type="button" onClick={() => voiceSeedInputRef.current?.click()} className="mt-3 w-full text-center bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-bold py-2 rounded">
                                            Upload New Seed (.wav, .mp3)
                                        </button>
                                        <input ref={voiceSeedInputRef} type="file" accept="audio/*" onChange={handleVoiceSeedUpload} className="hidden" />
                                    </div>
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <button onClick={handleSave} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg">{saveButtonText}</button>
                                </div>
                            </div>
                        ) : (
                           <div className="space-y-8">
                                <div>
                                    <h3 className="text-2xl font-black text-white mb-2">{agent.name}</h3>
                                    <p className="text-lg text-blue-400 font-medium">{agent.narrativeRole}</p>
                                </div>
                                <div className="bg-neutral-800/30 p-6 rounded-xl border border-neutral-800">
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase mb-3 tracking-widest">Biography</h4>
                                    <p className="text-neutral-300 leading-relaxed">{agent.bio || 'No biography available.'}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
                                        <span className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">Voice</span>
                                        <span className="text-white font-mono text-sm">{agent.voice}</span>
                                    </div>
                                    <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
                                        <span className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">ID</span>
                                        <span className="text-neutral-400 font-mono text-xs truncate">{agent.id}</span>
                                    </div>
                                </div>
                                 <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase mb-3 tracking-widest">Voice Seed</h4>
                                    {agent.voiceReference ? (
                                        <audio controls src={agent.voiceReference} className="w-full h-10" />
                                    ) : (
                                        <p className="text-sm text-neutral-500 italic">No voice reference on file.</p>
                                    )}
                                </div>
                           </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const getAgentIcon = (agent: Agent): React.ComponentType<{ className?: string }> => {
    switch (agent.id) {
        case 'agent-exec': return UserIcon; // Executive
        case 'agent-core': return AutomationIcon;
        case 'agent-ideation': return MagicIcon;
        case 'agent-scripting': return ScriptIcon;
        case 'agent-design': return PencilIcon;
        case 'agent-art': return ImageIcon;
        case 'agent-dop': return CameraLensIcon;
        case 'agent-audio': return SpeakerIcon;
        default: return UserIcon; // Fallback for custom agents
    }
};

const CastingCard: React.FC<{
    agent: Agent;
    images: ImageState[];
    onClick: () => void;
    onDelete: () => void;
    onCall: () => void;
}> = ({ agent, images, onClick, onDelete, onCall }) => {
    const Icon = getAgentIcon(agent);

    return (
        <div className="group relative bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700 shadow-sm hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1" onClick={onClick}>
            <div className="aspect-[3/4] bg-neutral-900 relative">
                {agent.avatar ? (
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700 group-hover:text-blue-400 transition-colors">
                        <Icon className="w-20 h-20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-lg font-bold text-white leading-tight">{agent.name}</h3>
                    <p className="text-xs text-neutral-300 font-medium truncate">{agent.narrativeRole || 'Talent'}</p>
                </div>
            </div>
            <div className="bg-neutral-800 p-3 border-t border-neutral-700 flex justify-between items-center">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{images.length} Assets</span>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onCall(); }} className="p-1.5 bg-green-900/30 text-green-400 hover:bg-green-600 hover:text-white rounded transition-colors" title="Call">
                        <PhoneIcon className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white rounded transition-colors" title="Delete">
                        <TrashIcon className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateEntityForm: React.FC<{
    rosterType: 'ai' | 'player';
    onCreateEntity: (data: Partial<Agent>) => void;
}> = ({ rosterType, onCreateEntity }) => {
    const [name, setName] = useState('');
    const placeholder = rosterType === 'ai' ? 'New Agent Name...' : 'New Player Name...';
    const buttonText = rosterType === 'ai' ? 'Create Agent' : 'Sign Player';
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onCreateEntity({ name });
            setName('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={placeholder}
                className="flex-grow bg-neutral-800 border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button 
                type="submit" 
                disabled={!name.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {buttonText}
            </button>
        </form>
    );
};

export const AgentsStudio: React.FC<RosterStudioProps> = ({ agents, onCreateEntity, onViewImage, onUpdateEntity, onDeleteEntity, onImageUpload, onCallEntity }) => {
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    const title = 'AI Agents';
    const description = 'Manage your specialized AI crew. Inspect their directives or sign new, custom agents to your team.';
    const emptyStateTitle = 'No Agents Found';
    const emptyStateDescription = 'Create an agent to begin.';
    const Icon = AutomationIcon;

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">{title}</h2>
                <p className="text-neutral-400">{description}</p>
                <div className="mt-6">
                    <CreateEntityForm rosterType='ai' onCreateEntity={onCreateEntity} />
                </div>
            </div>

            {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl">
                    <div className="w-16 h-16 text-neutral-700 mb-4">
                        <Icon />
                    </div>
                    <h3 className="text-xl font-semibold">{emptyStateTitle}</h3>
                    <p className="text-neutral-500 mt-2">{emptyStateDescription}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {agents.map(agent => (
                        <CastingCard
                            key={agent.id}
                            agent={agent}
                            images={agent.media || []}
                            onClick={() => setSelectedAgent(agent)}
                            onDelete={() => onDeleteEntity(agent.id)}
                            onCall={() => onCallEntity(agent)}
                        />
                    ))}
                </div>
            )}

            {selectedAgent && (
                <ProfileModal 
                    agent={selectedAgent}
                    rosterType="ai"
                    assignedImages={selectedAgent.media || []}
                    onClose={() => setSelectedAgent(null)}
                    onSave={(updated) => onUpdateEntity(selectedAgent.id, updated)}
                    onImageUpload={onImageUpload}
                    onViewImage={onViewImage}
                />
            )}
        </div>
    );
};