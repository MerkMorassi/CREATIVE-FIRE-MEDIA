
import React, { useState, useEffect } from 'react';
import { AutomationConfig, RAGProvider } from '../types.ts';

interface AutomationStudioProps {
    config: AutomationConfig;
    onSave: (config: AutomationConfig) => void;
    onTestWebhook: (url: string) => Promise<boolean>;
}

export const AutomationStudio: React.FC<AutomationStudioProps> = ({ config, onSave, onTestWebhook }) => {
    const [localConfig, setLocalConfig] = useState<AutomationConfig>(config);
    const [newWebhookUrl, setNewWebhookUrl] = useState('');
    const [testingUrl, setTestingUrl] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ url: string; success: boolean } | null>(null);
    const [saveFeedback, setSaveFeedback] = useState('');

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleConfigChange = (field: keyof AutomationConfig, value: string | string[] | boolean | RAGProvider) => {
        setLocalConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleAddWebhook = () => {
        if (newWebhookUrl.trim().startsWith('http') && !localConfig.webhookUrls.includes(newWebhookUrl.trim())) {
            handleConfigChange('webhookUrls', [...localConfig.webhookUrls, newWebhookUrl.trim()]);
            setNewWebhookUrl('');
        }
    };

    const handleDeleteWebhook = (urlToDelete: string) => {
        handleConfigChange('webhookUrls', localConfig.webhookUrls.filter(url => url !== urlToDelete));
    };

    const handleTest = async (url: string) => {
        setTestingUrl(url);
        setTestResult(null);
        const success = await onTestWebhook(url);
        setTestingUrl(null);
        setTestResult({ url, success });
        setTimeout(() => setTestResult(null), 4000); // Clear result after 4s
    };
    
    const handleSave = () => {
        onSave(localConfig);
        setSaveFeedback('Settings saved successfully!');
        setTimeout(() => setSaveFeedback(''), 3000);
    };

    const isExternalRagConfigDisabled = !localConfig.ragEnabled || localConfig.ragProvider === 'browser';

    return (
        <div className="p-6 max-w-7xl mx-auto w-full space-y-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-neutral-200 mb-2">Automation Studio</h2>
                <p className="text-neutral-400">Configure connections to external services like your RAG provider and event webhooks.</p>
            </div>

            {/* RAG Configuration */}
            <div className="bg-neutral-800/50 p-6 border border-neutral-700 space-y-6 rounded-lg">
                 <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-semibold text-neutral-300">Neural Retrieval (RAG)</h3>
                        <p className="text-sm text-neutral-400 mt-1">
                            Switch between Field (Browser) and Studio (Localhost) memory modes.
                        </p>
                    </div>
                    <label htmlFor="rag-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="rag-toggle"
                                className="sr-only"
                                checked={localConfig.ragEnabled}
                                onChange={(e) => handleConfigChange('ragEnabled', e.target.checked)}
                            />
                            <div className={`block w-14 h-8 transition-colors rounded-full ${localConfig.ragEnabled ? 'bg-green-600' : 'bg-neutral-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${localConfig.ragEnabled ? 'translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                 </div>

                <div className={`space-y-4 transition-opacity ${!localConfig.ragEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-2">Retrieval Mode</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className={`flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer ${localConfig.ragProvider === 'browser' ? 'bg-blue-600/10 border-blue-500 shadow-lg' : 'bg-neutral-900/50 border-neutral-700'}`}>
                                <div className="flex items-center gap-2">
                                    <input type="radio" name="ragProvider" value="browser" checked={localConfig.ragProvider === 'browser'} onChange={() => handleConfigChange('ragProvider', 'browser')} className="form-radio text-blue-500" />
                                    <span className="font-bold text-white text-sm">FIELD MODE (Browser)</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 leading-tight uppercase font-medium">Portable retrieval using IndexedDB. Use this when mobile or in the field.</p>
                            </label>

                            <label className={`flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer ${localConfig.ragProvider === 'localhost' ? 'bg-green-600/10 border-green-500 shadow-lg' : 'bg-neutral-900/50 border-neutral-700'}`}>
                                <div className="flex items-center gap-2">
                                    <input type="radio" name="ragProvider" value="localhost" checked={localConfig.ragProvider === 'localhost'} onChange={() => handleConfigChange('ragProvider', 'localhost')} className="form-radio text-green-500" />
                                    <span className="font-bold text-white text-sm">STUDIO MODE (Node.js)</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 leading-tight uppercase font-medium">High-performance retrieval from your local Neural Vault server.</p>
                            </label>

                            <label className={`flex flex-col gap-2 p-4 rounded-xl border transition-all cursor-pointer ${localConfig.ragProvider === 'cloud' ? 'bg-purple-600/10 border-purple-500 shadow-lg' : 'bg-neutral-900/50 border-neutral-700'}`}>
                                <div className="flex items-center gap-2">
                                    <input type="radio" name="ragProvider" value="cloud" checked={localConfig.ragProvider === 'cloud'} onChange={() => handleConfigChange('ragProvider', 'cloud')} className="form-radio text-purple-500" />
                                    <span className="font-bold text-white text-sm">CLOUD MODE</span>
                                </div>
                                <p className="text-[10px] text-neutral-400 leading-tight uppercase font-medium">Connect to external enterprise vector stores like Pinecone or Weaviate.</p>
                            </label>
                        </div>
                    </div>

                    {localConfig.ragProvider === 'localhost' && (
                        <div className="p-4 bg-black/40 rounded-xl border border-neutral-700 animate-fade-in space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Localhost RAG API URL</label>
                                <input
                                    type="url"
                                    value={localConfig.ragLocalhostUrl}
                                    onChange={(e) => handleConfigChange('ragLocalhostUrl', e.target.value)}
                                    placeholder="http://localhost:4000/api/rag"
                                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg p-2.5 focus:ring-1 focus:ring-green-500 outline-none"
                                />
                            </div>
                            <div className="flex items-start gap-3 bg-green-900/10 p-3 rounded-lg border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0 animate-pulse"></div>
                                <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">Point this to your Node.js server to access specialized COREPACKS and persistent studio history.</p>
                            </div>
                        </div>
                    )}
                    
                    {localConfig.ragProvider === 'cloud' && (
                        <div className="grid gap-4 bg-black/40 p-4 rounded-xl border border-neutral-700 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={localConfig.ragApiKey}
                                    onChange={(e) => handleConfigChange('ragApiKey', e.target.value)}
                                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg p-2.5 focus:ring-1 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Base URL</label>
                                    <input
                                        type="url"
                                        value={localConfig.ragBaseUrl}
                                        onChange={(e) => handleConfigChange('ragBaseUrl', e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg p-2.5 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Collection/Box ID</label>
                                    <input
                                        type="text"
                                        value={localConfig.ragKnowledgeBoxId}
                                        onChange={(e) => handleConfigChange('ragKnowledgeBoxId', e.target.value)}
                                        className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg p-2.5 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Webhook Configuration */}
            <div className="bg-neutral-800/50 p-6 border border-neutral-700 space-y-4 rounded-lg">
                <h3 className="text-lg font-semibold text-neutral-300">Event Webhooks</h3>
                <p className="text-sm text-neutral-400">
                    Send notifications to external services when events occur (e.g., image generation complete).
                </p>
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={newWebhookUrl}
                        onChange={(e) => setNewWebhookUrl(e.target.value)}
                        placeholder="https://your-webhook-endpoint.com"
                        className="flex-grow bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none"
                    />
                    <button
                        type="button"
                        onClick={handleAddWebhook}
                        disabled={!newWebhookUrl.trim()}
                        className="bg-neutral-700 text-white font-semibold py-2.5 px-4 hover:bg-neutral-600 transition disabled:opacity-50 rounded-lg"
                    >
                        Add
                    </button>
                </div>
                <div className="space-y-2">
                    {localConfig.webhookUrls.map(url => (
                         <div key={url} className="flex items-center justify-between bg-neutral-900/50 p-3 gap-4 rounded border border-neutral-800">
                            <code className="text-sm text-neutral-300 break-all flex-grow">{url}</code>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="relative">
                                    <button onClick={() => handleTest(url)} disabled={!!testingUrl} className="text-sm bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 transition disabled:opacity-50 w-20 text-center rounded-lg">
                                        {testingUrl === url ? 'Testing...' : 'Test'}
                                    </button>
                                    {testResult && testResult.url === url && <span className={`absolute right-0 -top-8 text-xs px-2 py-1 shadow-lg rounded ${testResult.success ? 'bg-green-600' : 'bg-red-600'}`}>{testResult.success ? 'Success!' : 'Failed!'}</span>}
                                </div>
                                <button onClick={() => handleDeleteWebhook(url)} className="text-sm text-red-400 hover:text-red-300 p-1 rounded-lg" title="Delete">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end items-center gap-4">
                 <p className={`text-sm text-green-400 transition-opacity duration-300 ${saveFeedback ? 'opacity-100' : 'opacity-0'}`}>{saveFeedback}</p>
                 <button
                    onClick={handleSave}
                    className="bg-blue-600 text-white font-bold py-2.5 px-6 hover:bg-blue-500 transition duration-300 rounded-lg"
                >
                    Save Settings
                </button>
            </div>
        </div>
    );
};
