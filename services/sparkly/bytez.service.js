// services/sparkly/bytez.service.js
// LLM Gateway - delegates to multi-provider LLMService

const LLMService = require("./llm.service");

class BytezService {
    static async runModel({ systemPrompt = "", messages = [], context = "", temperature = 0.7, maxTokens = 800 }) {
        return LLMService.runModel({ systemPrompt, context, messages, temperature, maxTokens });
    }
    static async runStreamModel({ systemPrompt = "", messages = [], context = "", onToken, temperature = 0.7, maxTokens = 800 }) {
        return LLMService.runStreamModel({ systemPrompt, context, messages, temperature, maxTokens, onToken });
    }
    static getClient() {
        const providers = LLMService.getAvailableProviders();
        return providers.length > 0 ? { _providers: providers } : null;
    }
    static getProviderStatus() { return LLMService.getProviderStatus(); }
}

module.exports = BytezService;
