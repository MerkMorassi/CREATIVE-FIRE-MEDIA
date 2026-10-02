import React, { useState, useRef, useEffect } from 'react';
import { Character } from '../types.ts';
import { UserIcon, EditIcon, TrashIcon, UploadIcon, PlusIcon, CloseIcon } from './icons.tsx';

// Helper to read file as base64
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

// Modal for creating/editing a character
const CharacterFormModal: React.FC<{
    character: Partial<Character> | null;
    onClose: () => void;
    onSave: (character: Partial<Character>) => void;
}> = ({ character, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Character>>(character || {});
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData(character || {});
    }, [character]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64Avatar = await fileToBase64(file);
            setFormData({ ...formData, avatar: base64Avatar });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name?.trim()) {
            onSave(formData);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div 
                className="bg-neutral-900 border border-neutral-700 w-full max-w-2xl rounded-xl flex flex-col overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-neutral-800">
                    <h2 className="text-xl font-bold text-white">{character?.id ? 'Edit Character' : 'Create Character'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full"><CloseIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    <div className="flex items-center gap-6">
                        <div 
                            className="w-32 h-32 rounded-full bg-neutral-800 border-2 border-neutral-700 overflow-hidden relative group cursor-pointer flex-shrink-0"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {formData.avatar ? (
                                <img src={formData.avatar} alt={formData.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                    <UserIcon className="w-16 h-16" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <UploadIcon className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                        <div className="flex-grow space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Name</label>
                                <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-neutral-800 p-3 rounded-lg text-lg font-bold" required />
                            </div>
                             <div>
                                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Archetype</label>
                                <input type="text" name="archetype" value={formData.archetype || ''} onChange={handleChange} className="w-full bg-neutral-800 p-3 rounded-lg" placeholder="e.g., The Mentor, The Rebel" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Description / Backstory</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} rows={6} className="w-full bg-neutral-800 p-3 rounded-lg text-sm" />
                    </div>
                     <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2 bg-neutral-700 text-neutral-200 rounded-lg hover:bg-neutral-600 transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors">{character?.id ? 'Save Changes' : 'Create Character'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CharacterCard: React.FC<{
    character: Character;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ character, onEdit, onDelete }) => {
    return (
        <div className="group relative bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:border-blue-500/50 hover:-translate-y-1">
            <div className="h-48 bg-neutral-900 flex items-center justify-center border-b border-neutral-700 relative overflow-hidden">
                {character.avatar ? (
                    <img src={character.avatar} alt={character.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <UserIcon className="w-20 h-20 text-neutral-600 group-hover:text-blue-400 transition-colors" />
                )}
            </div>
            <div className="p-5">
                <h3 className="text-xl font-bold text-white mb-1 truncate">{character.name}</h3>
                <p className="text-sm text-blue-400 font-medium truncate">{character.archetype}</p>
                <p className="text-xs text-neutral-400 mt-3 line-clamp-3">{character.description}</p>
            </div>
             <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={onEdit} className="p-2 bg-black/50 text-white rounded hover:bg-blue-600" title="Edit"><EditIcon className="w-4 h-4" /></button>
                <button onClick={onDelete} className="p-2 bg-black/50 text-white rounded hover:bg-red-600" title="Delete"><TrashIcon className="w-4 h-4" /></button>
            </div>
        </div>
    );
};

export const CharactersStudio: React.FC<{
    characters: Character[];
    onCreate: (c: Partial<Character>) => void;
    onUpdate: (id: string, u: Partial<Character>) => void;
    onDelete: (id: string) => void;
}> = ({ characters, onCreate, onUpdate, onDelete }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCharacter, setEditingCharacter] = useState<Partial<Character> | null>(null);

    const handleOpenCreate = () => {
        setEditingCharacter(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (character: Character) => {
        setEditingCharacter(character);
        setIsModalOpen(true);
    };
    
    const handleSave = (characterData: Partial<Character>) => {
        if (characterData.id) {
            onUpdate(characterData.id, characterData);
        } else {
            onCreate(characterData);
        }
        setIsModalOpen(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">Characters</h2>
                    <p className="text-neutral-400">Manage the cast for your project.</p>
                </div>
                <button onClick={handleOpenCreate} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-blue-500 transition-colors">
                    <PlusIcon className="w-5 h-5" /> New Character
                </button>
            </div>

            {characters.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl">
                    <div className="w-16 h-16 text-neutral-700 mb-4"><UserIcon /></div>
                    <h3 className="text-xl font-semibold">No Characters Found</h3>
                    <p className="text-neutral-500 mt-2">Create a character to begin building your cast.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {characters.map(char => (
                        <CharacterCard 
                            key={char.id}
                            character={char}
                            onEdit={() => handleOpenEdit(char)}
                            onDelete={() => onDelete(char.id)}
                        />
                    ))}
                </div>
            )}

            {isModalOpen && (
                <CharacterFormModal 
                    character={editingCharacter}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};
