// services/sparkly/llm.service.js
// Production-grade Multi-Provider LLM Gateway for Sparkly AI
// Supports: Groq (primary), Together.ai (secondary), OpenRouter (tertiary)

const axios = require('axios');
const logger = require('../../utils/logger');
const { SafetyService } = require('./safety.service');

const PROVIDERS = {
    GROQ: {
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        getKey: () => process.env.GROQ_API_KEY,
        defaultModel: 'llama-3.1-8b-instant',
        available: () => Boolean(process.env.GROQ_API_KEY)
    },
    TOGETHER: {
        name: 'Together.ai',
        baseUrl: 'https://api.together.xyz/v1/chat/completions',
        getKey: () => process.env.TOGETHER_API_KEY,
        defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
        available: () => Boolean(process.env.TOGETHER_API_KEY)
    },
    OPENROUTER: {
        name: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        getKey: () => process.env.OPENROUTER_API_KEY,
        defaultModel: 'google/gemma-4-31b-it:free',
        freeModels: [
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'nvidia/nemotron-3-super-120b-a12b:free',
            'nvidia/nemotron-3-ultra-550b-a55b:free',
            'liquid/lfm-2.5-2.6b:free',
            'openrouter/free',
        ],
        available: () => Boolean(process.env.OPENROUTER_API_KEY)
    }
};

async function callProvider({ provider, messages, maxTokens, temperature }) {
    const apiKey = provider.getKey();
    if (!apiKey) return null;

    // Build list of models to try (OpenRouter has fallback free models)
    const models = provider.freeModels || [provider.defaultModel];

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (provider.name === 'OpenRouter') {
        headers['HTTP-Referer'] = 'https://sparkle.app';
        headers['X-Title'] = 'Sparkly AI';
    }

    for (const model of models) {
        const startTime = Date.now();
        try {
            const resp = await axios.post(provider.baseUrl, {
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                stream: false
            }, { headers, timeout: 25000 });

            const content = resp.data?.choices?.[0]?.message?.content;
            if (content && content.trim()) {
                const durationMs = Date.now() - startTime;
                logger.info(`[LLMService] ${provider.name} (${model}) OK in ${durationMs}ms`);
                return {
                    success: true,
                    provider: provider.name,
                    model,
                    content: SafetyService.sanitizeFinalResponse(content.trim()),
                    durationMs
                };
            }
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error?.message || err.message;
            logger.warn(`[LLMService] ${provider.name} model ${model} failed (${status || 'timeout'}): ${msg}`);
        }
    }
    return null;
}

async function streamProvider({ provider, messages, maxTokens, temperature, onToken }) {
    const apiKey = provider.getKey();
    if (!apiKey) return { success: false, content: null };

    const models = provider.freeModels || [provider.defaultModel];
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    if (provider.name === 'OpenRouter') {
        headers['HTTP-Referer'] = 'https://sparkle.app';
        headers['X-Title'] = 'Sparkly AI';
    }

    for (const model of models) {
        try {
            const resp = await axios.post(provider.baseUrl, {
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
                stream: true
            }, { headers, timeout: 30000, responseType: 'stream' });

            let accumulated = '';
            await new Promise((resolve, reject) => {
                let buffer = '';
                resp.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;
                        try {
                            const parsed = JSON.parse(trimmed.slice(6));
                            const token = parsed.choices?.[0]?.delta?.content;
                            if (token) {
                                accumulated += token;
                                if (typeof onToken === 'function') onToken(token);
                            }
                        } catch (e) {}
                    }
                });
                resp.data.on('end', resolve);
                resp.data.on('error', reject);
            });

            if (accumulated.trim()) {
                return { success: true, content: SafetyService.sanitizeFinalResponse(accumulated) };
            }
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error?.message || err.message;
            logger.warn(`[LLMService] ${provider.name} stream model ${model} failed (${status || 'timeout'}): ${msg}`);
        }
    }
    return { success: false, content: null };
}


class LLMService {
    static getAvailableProviders() {
        return Object.values(PROVIDERS).filter(p => p.available());
    }

    static buildMessages({ systemPrompt, context, messages }) {
        const out = [];
        if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
        if (context && context.trim()) {
            out.push({ role: 'system', content: `--- CONTEXT ---\n${context.trim()}\n--- END CONTEXT ---` });
        }
        if (Array.isArray(messages)) {
            for (const m of messages) {
                if (m?.role && m?.content) {
                    out.push({
                        role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
                        content: String(m.content)
                    });
                }
            }
        }
        return out;
    }

    static async runModel({ systemPrompt = '', context = '', messages = [], temperature = 0.7, maxTokens = 800 }) {
        const chatMessages = this.buildMessages({ systemPrompt, context, messages });
        if (chatMessages.length === 0) return { success: false, content: null };

        const providers = this.getAvailableProviders();
        if (providers.length === 0) {
            logger.warn('[LLMService] No LLM providers configured. Using synthesis fallback.');
            return { success: false, content: null };
        }

        for (const provider of providers) {
            const result = await callProvider({ provider, messages: chatMessages, maxTokens, temperature });
            if (result?.success) return result;
        }

        logger.warn('[LLMService] All providers failed. Using synthesis fallback.');
        return { success: false, content: null };
    }

    static async runStreamModel({ systemPrompt = '', context = '', messages = [], temperature = 0.7, maxTokens = 800, onToken }) {
        const chatMessages = this.buildMessages({ systemPrompt, context, messages });
        if (chatMessages.length === 0) return { success: false, content: null };

        const providers = this.getAvailableProviders();
        if (providers.length === 0) return { success: false, content: null };

        for (const provider of providers) {
            const result = await streamProvider({ provider, messages: chatMessages, maxTokens, temperature, onToken });
            if (result?.success) return result;
        }
        return { success: false, content: null };
    }

    static getProviderStatus() {
        return Object.entries(PROVIDERS).map(([key, p]) => ({
            id: key,
            name: p.name,
            model: p.defaultModel,
            configured: p.available()
        }));
    }
}

module.exports = LLMService;
