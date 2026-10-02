
import React, { useState } from 'react';
import { PromptTemplate } from '../types.ts';
import { LibraryIcon } from './icons.tsx';

interface PromptLibraryStudioProps {
    templates: PromptTemplate[];
    onCreate: (name: string, positivePrompt: string, negativePrompt: string) => void;
    onUpdate: (id: string, name: string, positivePrompt: string, negativePrompt: string) => void;
    onDelete: (id: string) => void;
}

const TemplateEditor: React.FC<{
    template: PromptTemplate;
    onUpdate: (id: string, name: string, positivePrompt: string, negativePrompt: string) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ template, onUpdate, onDelete, onCancel }) => {
    const [name, setName] = useState(template.name);
    const [positivePrompt, setPositivePrompt] = useState(template.positivePrompt);
    const [negativePrompt, setNegativePrompt] = useState(template.negativePrompt);

    const handleSave = () => {
        if (name.trim() && positivePrompt.trim()) {
            onUpdate(template.id, name, positivePrompt, negativePrompt);
            onCancel();
        }
    };

    return (
        <div className="bg-neutral-800/60 p-4 border border-neutral-700 space-y-3 animate-fade-in rounded-lg">
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }`}</style>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template Name (e.g., Cinematic Film Noir)"
                className="w-full bg-neutral-900 border border-neutral-600 p-2 text-lg font-bold focus:ring-2 focus:ring-neutral-500 outline-none rounded"
            />
            <textarea
                value={positivePrompt}
                onChange={(e) => setPositivePrompt(e.target.value)}
                placeholder="Positive prompt..."
                className="w-full h-32 bg-neutral-900 border border-neutral-600 p-2 text-sm resize-y focus:ring-2 focus:ring-neutral-500 outline-none rounded"
            />
             <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Negative prompt (optional)..."
                className="w-full h-24 bg-neutral-900 border border-neutral-600 p-2 text-sm resize-y focus:ring-2 focus:ring-neutral-500 outline-none rounded"
            />
            <div className="flex justify-end gap-3">
                <button onClick={() => onDelete(template.id)} className="px-4 py-2 text-sm font-medium text-red-400 bg-neutral-900 hover:bg-red-900/50 transition rounded">Delete</button>
                <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-neutral-600 hover:bg-neutral-500 transition rounded">Save Changes</button>
            </div>
        </div>
    );
};

const CreateTemplateForm: React.FC<{
    onCreate: (name: string, positivePrompt: string, negativePrompt: string) => void;
}> = ({ onCreate }) => {
    const [name, setName] = useState('');
    const [positivePrompt, setPositivePrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && positivePrompt.trim()) {
            onCreate(name.trim(), positivePrompt, negativePrompt);
            setName('');
            setPositivePrompt('');
            setNegativePrompt('');
            setIsExpanded(false);
        }
    };

    if (!isExpanded) {
        return (
            <button 
                onClick={() => setIsExpanded(true)}
                className="w-full py-3 border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300 transition flex items-center justify-center gap-2 rounded-lg"
            >
                <span className="text-xl">+</span> Create New Prompt Template
            </button>
        )
    }

    return (
        <form onSubmit={handleCreate} className="bg-neutral-800/50 p-4 border border-neutral-700 space-y-3 animate-fade-in rounded-lg">
            <h3 className="text-lg font-semibold text-neutral-300">New Prompt Template</h3>
             <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template Name (e.g., Cinematic Film Noir)"
                className="w-full bg-neutral-900 border border-neutral-600 p-2 focus:ring-2 focus:ring-neutral-500 outline-none rounded"
            />
            <textarea
                value={positivePrompt}
                onChange={(e) => setPositivePrompt(e.target.value)}
                placeholder="Positive prompt keywords..."
                className="w-full h-32 bg-neutral-900 border border-neutral-600 p-2 resize-y focus:ring-2 focus:ring-neutral-500 outline-none rounded"
            />
            <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Negative prompt keywords (optional)..."
                className="w-full h-24 bg-neutral-900 border border-neutral-600 p-2 resize-y focus:ring-2 focus:ring-neutral-500 outline-none rounded"
            />
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="flex-1 bg-neutral-800 text-neutral-300 font-semibold py-2 px-4 hover:bg-neutral-700 transition duration-300 rounded"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!name.trim() || !positivePrompt.trim()}
                    className="flex-1 bg-neutral-700 text-white font-semibold py-2 px-4 hover:bg-neutral-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                >
                    Create Template
                </button>
            </div>
        </form>
    );
};

export const PromptLibraryStudio: React.FC<PromptLibraryStudioProps> = ({ templates, onCreate, onUpdate, onDelete }) => {
    const [editingId, setEditingId] = useState<string | null>(null);

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Prompt Library</h2>
                <p className="text-neutral-400 mb-6">Create and manage reusable prompt templates. These "styles" can be quickly applied from the Grid view to maintain a consistent look and feel.</p>
                <CreateTemplateForm onCreate={onCreate} />
            </div>
            
            <div className="space-y-4">
                {templates.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map(template => (
                            <div key={template.id}>
                                {editingId === template.id ? (
                                    <TemplateEditor
                                        template={template}
                                        onUpdate={onUpdate}
                                        onDelete={onDelete}
                                        onCancel={() => setEditingId(null)}
                                    />
                                ) : (
                                    <div className="bg-neutral-800/50 p-4 border border-neutral-700 group hover:border-neutral-600 transition-all rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="text-lg font-bold text-neutral-200">{template.name}</h4>
                                            <button 
                                                onClick={() => setEditingId(template.id)} 
                                                className="text-sm text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-xs font-semibold text-green-400/80 mb-1">POSITIVE</p>
                                                <p className="text-sm text-neutral-300 bg-neutral-900/50 p-2 rounded max-h-20 overflow-y-auto border border-neutral-800">{template.positivePrompt}</p>
                                            </div>
                                             {template.negativePrompt && (
                                                <div>
                                                    <p className="text-xs font-semibold text-red-400/80 mb-1">NEGATIVE</p>
                                                    <p className="text-sm text-neutral-400 bg-neutral-900/50 p-2 rounded max-h-20 overflow-y-auto border border-neutral-800">{template.negativePrompt}</p>
                                                </div>
                                             )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/30 text-center p-8">
                        <div className="w-16 h-16 text-neutral-700 mb-4"><LibraryIcon /></div>
                        <h3 className="text-xl font-semibold text-neutral-300 mb-2">Your Library is Empty</h3>
                        <p className="text-neutral-500">Create a prompt template above to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
