
import React, { useState, useEffect } from 'react';
import { DynamicPromptList } from '../types.ts';
import { ShuffleIcon } from './icons.tsx';
import { Dataframe } from './Dataframe.tsx';

interface DynamicPromptsStudioProps {
    lists: DynamicPromptList[];
    onCreate: (name: string, items: string[]) => void;
    onUpdate: (id: string, name: string, items: string[]) => void;
    onDelete: (id: string) => void;
}

const ListEditor: React.FC<{
    list: DynamicPromptList;
    onUpdate: (id: string, name: string, items: string[]) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
}> = ({ list, onUpdate, onDelete, onCancel }) => {
    const [name, setName] = useState(list.name);
    // Convert flat list to Dataframe format: [[item1], [item2], ...]
    const [dataframeData, setDataframeData] = useState<(string | number | boolean)[][]>(
        list.items.map(item => [item])
    );

    const handleSave = () => {
        // Flatten dataframe back to simple string array
        const itemsArray = dataframeData
            .map(row => String(row[0]).trim())
            .filter(Boolean); // Remove empty rows

        if (name.trim() && itemsArray.length > 0) {
            onUpdate(list.id, name, itemsArray);
            onCancel();
        }
    };

    return (
        <div className="bg-neutral-800/60 p-4 border border-neutral-700 space-y-4 animate-fade-in rounded-lg">
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
            
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="List Name (e.g., character, location)"
                    className="w-full bg-black border border-neutral-800 p-3 text-lg font-bold text-white focus:ring-2 focus:ring-brand outline-none rounded-lg mr-4"
                />
                <div className="flex gap-2">
                    <button onClick={() => onDelete(list.id)} className="px-3 py-2 text-sm font-medium text-red-400 bg-neutral-900 hover:bg-red-900/50 transition rounded-lg">Delete</button>
                    <button onClick={onCancel} className="px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition rounded-lg">Cancel</button>
                    <button onClick={handleSave} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition rounded-lg shadow-lg">Save</button>
                </div>
            </div>

            <div className="h-96">
                <Dataframe 
                    value={{ 
                        headers: ["Prompt Options"], 
                        data: dataframeData 
                    }}
                    editable={true}
                    show_row_numbers={true}
                    show_search={true}
                    onChange={(newData) => setDataframeData(newData.data)}
                    show_label={false}
                    max_height={380}
                />
            </div>
            
            <p className="text-xs text-neutral-500 text-right">
                Use the table above to manage your random prompt options. Each row is one variation.
            </p>
        </div>
    );
};

const CreateListForm: React.FC<{
    onCreate: (name: string, items: string[]) => void;
}> = ({ onCreate }) => {
    const [name, setName] = useState('');
    const [dataframeData, setDataframeData] = useState<(string | number | boolean)[][]>([['']]); // Start with one empty row
    const [isExpanded, setIsExpanded] = useState(false);

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        const itemsArray = dataframeData
            .map(row => String(row[0]).trim())
            .filter(Boolean);

        if (name.trim() && itemsArray.length > 0) {
            onCreate(name.trim(), itemsArray);
            setName('');
            setDataframeData([['']]);
            setIsExpanded(false);
        }
    };

    if (!isExpanded) {
        return (
            <button 
                onClick={() => setIsExpanded(true)}
                className="w-full py-4 border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition bg-neutral-900/30 flex items-center justify-center gap-2 rounded-xl"
            >
                <span className="text-xl">+</span> Create New Prompt List
            </button>
        )
    }

    return (
        <form onSubmit={handleCreate} className="bg-neutral-800/50 p-6 border border-neutral-700 space-y-4 animate-fade-in rounded-xl shadow-2xl">
            <h3 className="text-lg font-semibold text-neutral-300">New Dynamic List</h3>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="List Name (e.g., colors, moods)"
                className="w-full bg-black border border-neutral-800 p-3 rounded-lg text-white font-bold focus:ring-2 focus:ring-brand outline-none"
            />
            
            <div className="h-64 rounded-lg overflow-hidden border border-neutral-800">
                <Dataframe 
                    value={{ 
                        headers: ["Prompt Options"], 
                        data: dataframeData 
                    }}
                    editable={true}
                    show_row_numbers={true}
                    onChange={(newData) => setDataframeData(newData.data)}
                    show_label={false}
                    max_height={250}
                />
            </div>

            <div className="flex gap-2 pt-2">
                <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="flex-1 bg-neutral-800 text-neutral-300 font-bold py-3 px-4 hover:bg-neutral-700 transition duration-300 rounded-lg"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!name.trim()}
                    className="flex-1 bg-blue-600 text-white font-bold py-3 px-4 hover:bg-blue-500 transition duration-300 disabled:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg"
                >
                    Create List
                </button>
            </div>
        </form>
    );
};

export const DynamicPromptsStudio: React.FC<DynamicPromptsStudioProps> = ({ lists, onCreate, onUpdate, onDelete }) => {
    const [editingId, setEditingId] = useState<string | null>(null);

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Dynamic Prompts</h2>
                <p className="text-neutral-400 mb-6">Create lists of variables (like [character], [location]) to inject randomness into your prompts.</p>
                
                <CreateListForm onCreate={onCreate} />
            </div>
            
            <div className="space-y-4">
                {lists.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {lists.map(list => (
                            <div key={list.id}>
                                {editingId === list.id ? (
                                    <ListEditor
                                        list={list}
                                        onUpdate={onUpdate}
                                        onDelete={onDelete}
                                        onCancel={() => setEditingId(null)}
                                    />
                                ) : (
                                    <div className="bg-neutral-800/50 p-4 border border-neutral-700 group hover:border-neutral-600 transition-all rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="text-lg font-bold text-neutral-200 flex items-center gap-2">
                                                [{list.name}]
                                            </h4>
                                            <button 
                                                onClick={() => setEditingId(list.id)} 
                                                className="text-sm text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        <div className="bg-black/40 p-2 rounded text-xs text-neutral-400 font-mono h-24 overflow-y-auto border border-neutral-800 custom-scrollbar">
                                            {list.items.map((item, i) => (
                                                <div key={i} className="truncate border-b border-neutral-800/50 last:border-0 py-0.5">• {item}</div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-2 text-right">{list.items.length} items</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/30 text-center p-8">
                        <div className="w-16 h-16 text-neutral-700 mb-4"><ShuffleIcon /></div>
                        <h3 className="text-xl font-semibold text-neutral-300 mb-2">No Lists Created</h3>
                        <p className="text-neutral-500">Create a list to start using dynamic variables in your prompts.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
