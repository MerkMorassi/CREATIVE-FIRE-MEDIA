// Keys for LocalStorage
const TOPAZ_API_KEY_STORAGE_KEY = 'mythos_topaz_v2';
const HF_API_KEY_STORAGE_KEY = 'mythos_hf_v2';
const VOICE_LAB_URL_STORAGE_KEY = 'mythos_voicelab_url_v1';
const DOLPHIN_URL_STORAGE_KEY = 'mythos_dolphin_url_v1';
const CINEMATIC_CORE_URL_STORAGE_KEY = 'mythos_cinematic_core_url_v1';
const CAMERA_DOLLY_URL_STORAGE_KEY = 'mythos_camera_dolly_url_v2';
const MUSIC_API_KEY_STORAGE_KEY = 'mythos_music_api_key_v1';

/**
 * Helper to get value from Env (Vite or Process) or Null
 */
const getEnvValue = (key: string): string | null => {
    // Check Vite Env
    if ((import.meta as any).env && (import.meta as any).env[key]) {
        return (import.meta as any).env[key];
    }
    // Check Process Env (injected via define or server)
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key];
    }
    // Check window.process polyfill
    if ((window as any).process && (window as any).process.env && (window as any).process.env[key]) {
        return (window as any).process.env[key];
    }
    return null;
};

// --- GEMINI ---
// Per guidelines, Gemini API key is *exclusively* from the environment.
// No saving to localStorage is permitted.
export const getGeminiApiKey = (): string | null => {
    const apiKey = getEnvValue('VITE_GEMINI_API_KEY') || getEnvValue('GEMINI_API_KEY') || getEnvValue('VITE_API_KEY') || getEnvValue('API_KEY');
    if (apiKey && apiKey.trim() !== '') {
        return apiKey.trim();
    }
    return null;
};

// --- TOPAZ ---
export const saveTopazApiKey = (key: string): void => {
    try {
        if (!key) {
            localStorage.removeItem(TOPAZ_API_KEY_STORAGE_KEY);
        } else {
            localStorage.setItem(TOPAZ_API_KEY_STORAGE_KEY, key.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (Topaz):", error);
    }
};

export const getTopazApiKey = (): string | null => {
    const envKey = getEnvValue('VITE_TOPAZ_API_KEY') || getEnvValue('TOPAZ_API_KEY');
    if (envKey) return envKey;

    try {
        return localStorage.getItem(TOPAZ_API_KEY_STORAGE_KEY);
    } catch (error) {
        return null;
    }
};

// --- HUGGING FACE ---
export const saveHfApiKey = (key: string): void => {
    try {
        if (!key) {
            localStorage.removeItem(HF_API_KEY_STORAGE_KEY);
        } else {
            localStorage.setItem(HF_API_KEY_STORAGE_KEY, key.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (HF):", error);
    }
};

export const getHfApiKey = (): string | null => {
    const envKey = getEnvValue('VITE_HF_API_KEY') || getEnvValue('HF_API_KEY');
    if (envKey) return envKey;

    try {
        return localStorage.getItem(HF_API_KEY_STORAGE_KEY);
    } catch (error) {
        return null;
    }
};

// --- VOICE LAB (CHATTERBOX) ---
export const saveVoiceLabUrl = (url: string): void => {
    try {
        if (!url) {
            localStorage.removeItem(VOICE_LAB_URL_STORAGE_KEY);
        } else {
            localStorage.setItem(VOICE_LAB_URL_STORAGE_KEY, url.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (VoiceLab URL):", error);
    }
};

export const getVoiceLabUrl = (): string | null => {
    const envKey = getEnvValue('VITE_VOICELAB_URL') || getEnvValue('VOICELAB_URL');
    if (envKey) return envKey;

    try {
        const stored = localStorage.getItem(VOICE_LAB_URL_STORAGE_KEY);
        return stored || "https://merkmorassi-chatterbox.hf.space";
    } catch (error) {
        return "https://merkmorassi-chatterbox.hf.space";
    }
};

// --- DOLPHIN LLM ---
export const saveDolphinUrl = (url: string): void => {
    try {
        if (!url) {
            localStorage.removeItem(DOLPHIN_URL_STORAGE_KEY);
        } else {
            localStorage.setItem(DOLPHIN_URL_STORAGE_KEY, url.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (Dolphin URL):", error);
    }
};

export const getDolphinUrl = (): string | null => {
    const envKey = getEnvValue('VITE_DOLPHIN_URL') || getEnvValue('DOLPHIN_URL');
    if (envKey) return envKey;

    try {
        const stored = localStorage.getItem(DOLPHIN_URL_STORAGE_KEY);
        return stored || "https://merkmorassi-mythos-dolphin.hf.space/";
    } catch (error) {
        return "https://merkmorassi-mythos-dolphin.hf.space/";
    }
};

// --- CINEMATIC CORE ---
export const saveCinematicCoreUrl = (url: string): void => {
    try {
        if (!url) {
            localStorage.removeItem(CINEMATIC_CORE_URL_STORAGE_KEY);
        } else {
            localStorage.setItem(CINEMATIC_CORE_URL_STORAGE_KEY, url.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (Cinematic Core URL):", error);
    }
};

export const getCinematicCoreUrl = (): string | null => {
    const envKey = getEnvValue('VITE_CINEMATIC_CORE_URL') || getEnvValue('CINEMATIC_CORE_URL');
    if (envKey) return envKey;

    try {
        const stored = localStorage.getItem(CINEMATIC_CORE_URL_STORAGE_KEY);
        return stored || "https://merkmorassi-mythos-cinematic-core.hf.space";
    } catch (error) {
        return "https://merkmorassi-mythos-cinematic-core.hf.space";
    }
};

// --- CAMERA DOLLY (LTX) ---
export const saveCameraDollyUrl = (url: string): void => {
    try {
        if (!url) {
            localStorage.removeItem(CAMERA_DOLLY_URL_STORAGE_KEY);
        } else {
            localStorage.setItem(CAMERA_DOLLY_URL_STORAGE_KEY, url.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (Camera Dolly URL):", error);
    }
};

export const getCameraDollyUrl = (): string => {
    const envKey = getEnvValue('VITE_CAMERA_DOLLY_URL') || getEnvValue('CAMERA_DOLLY_URL');
    if (envKey) return envKey;

    try {
        const stored = localStorage.getItem(CAMERA_DOLLY_URL_STORAGE_KEY);
        return stored || "https://merkmorassi-mythos-camera-control-dolly.hf.space/";
    } catch (error) {
        return "https://merkmorassi-mythos-camera-control-dolly.hf.space/";
    }
};

// --- MUSIC API ---
export const saveMusicApiKey = (key: string): void => {
    try {
        if (!key) {
            localStorage.removeItem(MUSIC_API_KEY_STORAGE_KEY);
        } else {
            localStorage.setItem(MUSIC_API_KEY_STORAGE_KEY, key.trim());
        }
    } catch (error) {
        console.error("Persistence Failure (Music API):", error);
    }
};

export const getMusicApiKey = (): string | null => {
    const envKey = getEnvValue('VITE_MUSIC_API_KEY') || getEnvValue('MUSIC_API_KEY');
    if (envKey) return envKey;

    try {
        return localStorage.getItem(MUSIC_API_KEY_STORAGE_KEY);
    } catch (error) {
        return null;
    }
};


export const hasCriticalKeys = (): boolean => {
    return !!getGeminiApiKey();
};