
import { getVoiceLabUrl } from './apiKeyService';

// This file centralizes endpoints for external, non-Gemini AI services,
// particularly those running on Hugging Face Spaces or other Gradio interfaces.

export const EXTERNAL_MODEL_ENDPOINTS = {
    /**
     * Chatterbox TTS (Text-to-Speech) Service.
     * Points to a Gradio space running a voice synthesis model like XTTSv2.
     * The URL is configured by the user in the System Settings.
     */
    CHATTERBOX_TTS: {
        get url() {
            return getVoiceLabUrl();
        },
        // A direct space name can be used as a fallback if the URL is not set.
        space: "merkmorassi/Chatterbox"
    },
    // Other external services can be added here in the future.
};
