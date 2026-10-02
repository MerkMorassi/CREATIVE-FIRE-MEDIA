import React, { useState, useEffect } from 'react';
import { getGeminiApiKey, getHfApiKey, getTopazApiKey, getVoiceLabUrl, getDolphinUrl, getCinematicCoreUrl, getCameraDollyUrl, getMusicApiKey, saveHfApiKey, saveTopazApiKey, saveVoiceLabUrl, saveDolphinUrl, saveCinematicCoreUrl, saveCameraDollyUrl, saveMusicApiKey } from '../services/apiKeyService';
import { geminiClient } from './models/Gemini';
import { LoadingSpinner, WarningIcon, CheckIcon, DatabaseIcon, WandIcon } from './icons';

interface ModelInfo {
    name: string;
    displayName: string;
}

// FIX: Define FormField locally to provide a valid component for use and wrap inputs correctly.
const FormField: React.FC<{ label: string; children: React.ReactNode, description?: string }> = ({ label, children, description }) => (
    <div>
        <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">{label}</label>
        {children}
        {description && <p className="text-[10px] text-neutral-600 mt-2 italic px-1">{description}</p>}
    </div>
);


export const ModelSettingsStudio: React.FC = () => {
    // State for external service configs
    const [hfApiKey, setHfApiKey] = useState('');
    const [topazApiKey, setTopazApiKey] = useState('');
    const [voiceLabUrl, setVoiceLabUrl] = useState('');
    const [dolphinUrl, setDolphinUrl] = useState('');
    const [cinematicCoreUrl, setCinematicCoreUrl] = useState('');
    const [cameraDollyUrl, setCameraDollyUrl] = useState('');
    const [musicApiKey, setMusicApiKey] = useState('');
    const [showKeys, setShowKeys] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    
    // State for Gemini model scanning
    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);

    // NEW: state for key validation
    const [geminiKeyValidation, setGeminiKeyValidation] = useState<'validating' | 'valid' | 'invalid'>('validating');

    // Load current settings on component mount
    useEffect(() => {
        setHfApiKey(getHfApiKey() || '');
        setTopazApiKey(getTopazApiKey() || '');
        setVoiceLabUrl(getVoiceLabUrl() || '');
        setDolphinUrl(getDolphinUrl() || '');
        setCinematicCoreUrl(getCinematicCoreUrl() || '');
        setCameraDollyUrl(getCameraDollyUrl() || '');
        setMusicApiKey(getMusicApiKey() || '');

        const validateKey = async () => {
            const key = getGeminiApiKey();
            if (key) {
                const isValid = await geminiClient.checkConnection(key);
                setGeminiKeyValidation(isValid ? 'valid' : 'invalid');
            } else {
                setGeminiKeyValidation('invalid');
            }
        };
        validateKey();

    }, []);

    const handleScanModels = async () => {
        setIsScanning(true);
        setScanError(null);
        setGeminiModels([]);
        
        const geminiKey = getGeminiApiKey();

        if (!geminiKey) {
            setScanError("Gemini API Key is not configured in your environment. Cannot scan for models.");
            setIsScanning(false);
            return;
        }

        try {
            const models = await geminiClient.listModels(geminiKey);
            setGeminiModels(models);
        } catch (error) {
            console.error("Failed to fetch Gemini models:", error);
            setScanError(error instanceof Error ? error.message : "An unknown error occurred while scanning.");
        } finally {
            setIsScanning(false);
        }
    };
    
    const handleSaveSettings = () => {
        setSaveStatus('saving');
        saveHfApiKey(hfApiKey);
        saveTopazApiKey(topazApiKey);
        saveVoiceLabUrl(voiceLabUrl);
        saveDolphinUrl(dolphinUrl);
        saveCinematicCoreUrl(cinematicCoreUrl);
        saveCameraDollyUrl(cameraDollyUrl);
        saveMusicApiKey(musicApiKey);
        
        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 500);
    };
    
    const renderGeminiKeyStatus = () => {
        switch (geminiKeyValidation) {
            case 'validating':
                return (
                    <div className="p-4 rounded-lg border flex items-center justify-between bg-yellow-900/20 border-yellow-500/30">
                        <div className="flex items-center gap-2">
                             <LoadingSpinner className="w-5 h-5 text-yellow-400"/>
                             <span className="text-xs font-bold uppercase tracking-wider">Validating Key...</span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">from .env</span>
                    </div>
                );
            case 'valid':
                 return (
                    <div className="p-4 rounded-lg border flex items-center justify-between bg-green-900/20 border-green-500/30">
                        <div className="flex items-center gap-2">
                             <CheckIcon className="w-5 h-5 text-green-400"/>
                             <span className="text-xs font-bold uppercase tracking-wider">API Key Valid</span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">from .env</span>
                    </div>
                );
            case 'invalid':
            default:
                return (
                    <div className="p-4 rounded-lg border flex items-center justify-between bg-red-900/20 border-red-500/30">
                        <div className="flex items-center gap-2">
                             <WarningIcon className="w-5 h-5 text-red-400"/>
                             <span className="text-xs font-bold uppercase tracking-wider">API Key Invalid or Missing</span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono">from .env</span>
                    </div>
                );
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto w-full h-full overflow-y-auto space-y-10 custom-scrollbar">
            {/* Header */}
            <div>
                 <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">System Configuration</h1>
                 <p className="text-neutral-500 text-lg mt-1 font-medium">Manage API keys, model endpoints, and system settings.</p>
            </div>
            
            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Services & Keys */}
                <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 space-y-6 shadow-2xl">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight border-b border-neutral-800 pb-4 mb-4">External Services & Keys</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField label="Hugging Face Access Token" description="Required for specialized GPU tasks (Flux, Video, Outpainting, Private Models).">
                            <input type={showKeys ? "text" : "password"} value={hfApiKey} onChange={e => setHfApiKey(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                        <FormField label="Topaz Labs API Key" description="Required for professional-grade upscaling and video enhancement.">
                            <input type={showKeys ? "text" : "password"} value={topazApiKey} onChange={e => setTopazApiKey(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                        <FormField label="Voice Lab URL (Chatterbox)">
                            <input type="text" value={voiceLabUrl} onChange={e => setVoiceLabUrl(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                        <FormField label="Mythos Dolphin URL">
                            <input type="text" value={dolphinUrl} onChange={e => setDolphinUrl(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                        <FormField label="MythOS Cinematic Core URL">
                            <input type="text" value={cinematicCoreUrl} onChange={e => setCinematicCoreUrl(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                        <FormField label="Camera Dolly (LTX) URL">
                            <input type="text" value={cameraDollyUrl} onChange={e => setCameraDollyUrl(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                        <FormField label="MusicAPI Access Key" description="Required for advanced stereo music generation and vocal synthesis (sonic-v5/v6 engines).">
                            <input type={showKeys ? "text" : "password"} value={musicApiKey} onChange={e => setMusicApiKey(e.target.value)} className="w-full bg-black border border-neutral-700 p-3 rounded-lg text-sm font-mono" />
                        </FormField>
                    </div>

                    <div className="pt-6 border-t border-neutral-800 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="show-keys" checked={showKeys} onChange={() => setShowKeys(!showKeys)} className="accent-blue-500" />
                            <label htmlFor="show-keys" className="text-xs text-neutral-400 cursor-pointer">Reveal Keys</label>
                        </div>
                        <button onClick={handleSaveSettings} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all w-48 text-center shadow-lg">
                            {saveStatus === 'idle' && 'Save Configuration'}
                            {saveStatus === 'saving' && <LoadingSpinner className="w-5 h-5 mx-auto" />}
                            {saveStatus === 'saved' && <span className="flex items-center justify-center gap-2"><CheckIcon className="w-5 h-5"/> Saved!</span>}
                        </button>
                    </div>
                </div>

                {/* Right Column: Gemini */}
                <div className="lg:col-span-1 bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8 space-y-6 shadow-2xl">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight border-b border-neutral-800 pb-4 mb-4">Google Gemini</h2>
                    {renderGeminiKeyStatus()}

                    <div>
                        <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">Available Models</h3>
                        <button onClick={handleScanModels} disabled={isScanning || geminiKeyValidation !== 'valid'} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-lg text-sm transition-all border border-neutral-700 disabled:opacity-50">
                            {isScanning ? <LoadingSpinner className="w-5 h-5"/> : <WandIcon className="w-5 h-5"/>}
                            Scan for Models
                        </button>
                    </div>

                    <div className="h-px bg-neutral-800"></div>

                    <div className="max-h-96 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {isScanning && <div className="text-center text-sm text-neutral-500 py-10">Scanning...</div>}
                        {scanError && <div className="text-xs text-red-400 bg-red-900/20 p-3 rounded border border-red-500/30">{scanError}</div>}
                        {geminiModels.length > 0 && (
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="text-neutral-500 font-bold uppercase">
                                        <th className="p-2">Display Name</th>
                                        <th className="p-2">Model ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {geminiModels.map(model => (
                                        <tr key={model.name} className="border-b border-neutral-800">
                                            <td className="p-2 font-semibold text-neutral-300">{model.displayName}</td>
                                            <td className="p-2 text-neutral-400 font-mono">{model.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        {!isScanning && !scanError && geminiModels.length === 0 && (
                             <div className="text-center text-xs text-neutral-600 py-10">
                                <DatabaseIcon className="w-8 h-8 mx-auto mb-2"/>
                                {geminiKeyValidation === 'valid' ? 'Model list will appear here after scanning.' : 'A valid API key is required to scan for models.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};