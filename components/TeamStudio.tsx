
import React, { useState, useRef, useEffect } from 'react';
import { Agent, ActiveView, ImageState } from '../types.ts';
import { CloseIcon, PhoneIcon, EditIcon, CameraLensIcon, UploadIcon, UserIcon, AgentsIcon, ChatIcon, TrashIcon, PlusIcon } from './icons.tsx';
import { getAvailableVoices } from '../services/agentService.ts';

interface TeamStudioProps {
    agents: Agent[];
    images: ImageState[];
    onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
    onUpdateAgentAvatar: (agentId: string, file: File) => void;
    onNavigate: (view: ActiveView, agentId?: string) => void;
    onCallAgent: (agent: Agent) => void;
    onViewImage: (image: ImageState) => void;
    onCreateEntity: (data: Partial<Agent>) => Agent;
    onDeleteEntity: (agentId: string) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const CreateEntityForm: React.FC<{
    onCreateEntity: (data: Partial<Agent>) => void;
}> = ({ onCreateEntity }) => {
    const [name, setName] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onCreateEntity({ name, systemPrompt: 'You are a helpful AI assistant.', voice: 'Kore' });
            setName('');
        }
    };
    return (
        <form onSubmit={handleSubmit} className="mb-8 bg-neutral-800/50 p-6 border border-neutral-700 rounded-xl shadow-2xl">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">Add New Custom Agent</h3>
            <div className="flex gap-4">
                <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="New Agent Name..."
                    className="flex-grow bg-black border border-neutral-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button 
                    type="submit" 
                    disabled={!name.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5"/> Create Agent
                </button>
            </div>
        </form>
    );
};

const ProfileModal: React.FC<{
    agent: Agent;
    assignedImages: ImageState[];
    onClose: () => void;
    onSave: (updatedAgent: Partial<Agent>) => void;
    onAvatarUpload: (file: File) => void;
    onViewImage: (image: ImageState) => void;
}> = ({ agent, assignedImages, onClose, onSave, onViewImage, onAvatarUpload }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    // Form State
    const [name, setName] = useState(agent.name);
    const [bio, setBio] = useState(agent.bio || '');
    const [narrativeRole, setNarrativeRole] = useState(agent.narrativeRole || '');
    const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
    const [voice, setVoice] = useState(agent.voice || 'Kore');
    const [voiceReference, setVoiceReference] = useState(agent.voiceReference || '');
    const [department, setDepartment] = useState(agent.department || 'CREATIVE');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const voiceSeedInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setName(agent.name);
        setBio(agent.bio || '');
        setNarrativeRole(agent.narrativeRole || '');
        setSystemPrompt(agent.systemPrompt || '');
        setVoice(agent.voice || 'Kore');
        setVoiceReference(agent.voiceReference || '');
        setDepartment(agent.department || 'CREATIVE');
    }, [agent]);

    const handleSave = () => {
        onSave({ name, bio, narrativeRole, systemPrompt, voice, department, voiceReference });
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

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-neutral-900 border border-neutral-700 w-full max-w-6xl h-[90vh] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-neutral-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Agent Profile: {agent.name}</h2>
                        <p className="text-sm text-neutral-400">Core Directives & Private Gallery</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${isEditing ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}>
                            {isEditing ? 'Editing Mode' : 'Edit Details'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full"><CloseIcon /></button>
                    </div>
                </div>

                <div className="flex-grow flex overflow-hidden">
                    {/* Left Column (Avatar & Gallery) */}
                    <div className="w-2/5 bg-black/50 flex flex-col border-r border-neutral-800 p-6 overflow-y-auto custom-scrollbar">
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
                                            onAvatarUpload(e.target.files[0]);
                                        }
                                    }} 
                                />
                            </div>
                            <h3 className="text-xl font-bold text-white text-center">{name}</h3>
                            <p className="text-blue-400 font-medium text-sm text-center">{narrativeRole || 'Specialist'}</p>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Private Gallery ({assignedImages.length})</h4>
                            {assignedImages.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                            ) : (
                                <div className="text-center text-xs text-neutral-600 border border-dashed border-neutral-700 rounded-lg py-10">
                                    No assets created by this agent yet.
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Right Column: Data */}
                    <div className="w-3/5 p-8 overflow-y-auto custom-scrollbar">
                        {isEditing ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Agent Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg text-xl font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Specialty / Role</label>
                                    <input type="text" value={narrativeRole} onChange={e => setNarrativeRole(e.target.value)} className="w-full bg-neutral-800 p-3 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Department</label>
                                    <select value={department} onChange={e => setDepartment(e.target.value as any)} className="w-full bg-neutral-800 p-3 rounded-lg">
                                        <option value="ADMINISTRATION">Administration</option>
                                        <option value="CREATIVE">Creative</option>
                                        <option value="PRODUCTION">Production</option>
                                        <option value="TECHNICAL">Technical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Biography</label>
                                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} className="w-full bg-neutral-800 p-3 rounded-lg" />
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
                                    <button onClick={handleSave} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg">Save Configuration</button>
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
                                        <span className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">Class</span>
                                        <span className="text-white font-mono text-sm">{agent.agentClass}</span>
                                    </div>
                                    <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
                                        <span className="block text-[10px] text-neutral-500 font-bold uppercase mb-1">Department</span>
                                        <span className="text-white font-mono text-sm">{agent.department}</span>
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

const AgentCard: React.FC<{
    agent: Agent;
    onClick: () => void;
    onEdit: () => void;
    onCall: () => void;
    onDelete: () => void;
    onUpdateAgentAvatar: (file: File) => void;
}> = ({ agent, onClick, onEdit, onCall, onDelete, onUpdateAgentAvatar }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            onUpdateAgentAvatar(e.target.files[0]);
        }
    };
    
    const getDeptColor = (dept?: string) => {
        switch (dept) {
            case 'ADMINISTRATION': return 'text-purple-400 bg-purple-900/80 border-purple-500/30';
            case 'CREATIVE': return 'text-amber-400 bg-amber-900/80 border-amber-500/30';
            case 'PRODUCTION': return 'text-blue-400 bg-blue-900/80 border-blue-500/30';
            case 'TECHNICAL': return 'text-green-400 bg-green-900/80 border-green-500/30';
            default: return 'text-neutral-400 bg-neutral-900/80 border-neutral-500/30';
        }
    };

    return (
        <div 
            className="group relative bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 hover:border-blue-500/50 hover:-translate-y-1 h-full flex flex-col"
        >
            <div onClick={onClick} className="h-48 bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center border-b border-neutral-700 group-hover:from-blue-900/20 group-hover:to-neutral-900 transition-colors relative overflow-hidden">
                {agent.avatar ? (
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <AgentsIcon className="w-16 h-16 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                )}
                
                <div className={`absolute top-2 right-2 z-10 ${getDeptColor(agent.department)}`}>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full border backdrop-blur-sm uppercase tracking-wider">{agent.department || 'Staff'}</span>
                </div>

                {/* Hover Actions Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors border border-white/10"
                        title="Upload Photo"
                    >
                        <CameraLensIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onEdit}
                        className="p-2 bg-blue-600/80 hover:bg-blue-500 rounded-full text-white backdrop-blur-md transition-colors border border-blue-400/30"
                        title="Edit Configuration"
                    >
                        <EditIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onCall}
                        className="p-2 bg-green-600/80 hover:bg-green-500 rounded-full text-white backdrop-blur-md transition-colors shadow-lg border border-green-400/30"
                        title="Call Agent"
                    >
                        <PhoneIcon className="w-4 h-4" />
                    </button>
                     <button 
                        onClick={onDelete}
                        className="p-2 bg-red-600/80 hover:bg-red-500 rounded-full text-white backdrop-blur-md transition-colors shadow-lg border border-red-400/30"
                        title="Delete Agent"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                    />
                </div>
            </div>

            <div onClick={onClick} className="p-5 flex-grow flex flex-col">
                <div className="mb-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider border border-neutral-600 px-2 py-0.5 rounded-full bg-neutral-900">
                        {agent.agentClass || 'STAFF'}
                    </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">{agent.name}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3 mb-4 flex-grow">
                    {agent.bio}
                </p>
                
                <div className="flex gap-2 mt-auto">
                    <button 
                        onClick={onClick}
                        className="flex-1 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 font-bold text-xs uppercase rounded transition-colors flex items-center justify-center gap-2 border border-neutral-600"
                    >
                        <ChatIcon className="w-3 h-3" /> Enter Office
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TeamStudio: React.FC<TeamStudioProps> = ({ agents, images, onUpdateAgent, onUpdateAgentAvatar, onNavigate, onCallAgent, onViewImage, onCreateEntity, onDeleteEntity }) => {
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

    return (
        <div className="p-8 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Production Team</h2>
                <p className="text-neutral-400">The complete roster of core and custom AI agents for this project.</p>
                <div className="mt-6">
                    <CreateEntityForm onCreateEntity={onCreateEntity} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {agents.map(agent => (
                    <AgentCard
                        key={agent.id}
                        agent={agent}
                        onClick={() => onNavigate('agent-workspace', agent.id)}
                        onEdit={() => setEditingAgent(agent)}
                        onCall={() => onCallAgent(agent)}
                        onDelete={() => {
                            if (window.confirm(`Are you sure you want to delete the agent "${agent.name}"? This action cannot be undone.`)) {
                                onDeleteEntity(agent.id)
                            }
                        }}
                        onUpdateAgentAvatar={(file) => onUpdateAgentAvatar(agent.id, file)}
                    />
                ))}
            </div>

            {editingAgent && (
                <ProfileModal 
                    agent={editingAgent}
                    assignedImages={images.filter(img => img.agentId === editingAgent.id)}
                    onClose={() => setEditingAgent(null)}
                    onSave={(updated) => {
                        onUpdateAgent(editingAgent.id, updated);
                        setEditingAgent(null);
                    }}
                    onViewImage={onViewImage}
                    onAvatarUpload={(file) => onUpdateAgentAvatar(editingAgent.id, file)}
                />
            )}
        </div>
    );
};
