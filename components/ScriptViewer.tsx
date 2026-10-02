
import React, { useRef } from 'react';
import { ScriptIcon } from './icons.tsx';

interface ScriptViewerProps {
    scriptText: string;
    onUpload: (file: File) => void;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ scriptText, onUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onUpload(file);
        }
        event.target.value = ''; // Reset for re-uploading the same file
    };

    return (
        <div className="p-6 max-w-7xl mx-auto w-full h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-neutral-200 mb-2">Script</h2>
                    <p className="text-neutral-400">View your screenplay and use it as a reference.</p>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".txt,.md,.fountain"
                    onChange={handleFileChange}
                />
                <button
                    onClick={handleUploadClick}
                    className="bg-neutral-700 text-white font-semibold py-2 px-4 hover:bg-neutral-600 transition duration-300 rounded"
                >
                    {scriptText ? 'Replace Script' : 'Upload Script'}
                </button>
            </div>
            {scriptText ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-sm text-neutral-300 bg-neutral-800/70 p-6 border border-neutral-700 rounded-lg">
                    {scriptText}
                </pre>
            ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-neutral-800 rounded-xl bg-neutral-900/30 text-center p-8">
                    <div className="w-16 h-16 text-neutral-700 mb-4"><ScriptIcon /></div>
                    <h3 className="text-xl font-semibold text-neutral-300 mb-2">No Script Loaded</h3>
                    <p className="text-neutral-500">Upload a .txt file to view your screenplay here.</p>
                </div>
            )}
        </div>
    );
};
