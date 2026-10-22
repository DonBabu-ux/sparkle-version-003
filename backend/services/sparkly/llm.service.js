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
        visionModels: ['meta-llama/llama-4-scout-17b-16e-instruct'],
        available: () => Boolean(process.env.GROQ_API_KEY)
    },
    TOGETHER: {
        name: 'Together.ai',
        baseUrl: 'https://api.together.xyz/v1/chat/completions',
        getKey: () => process.env.TOGETHER_API_KEY,
        defaultModel: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
        visionModels: ['meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'],
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
        visionModels: [
            'google/gemma-4-31b-it:free',
            'google/gemma-4-26b-a4b-it:free',
            'openrouter/free',
        ],
        available: () => Boolean(process.env.OPENROUTER_API_KEY)
    }
};

// Basic SSRF guard: never fetch vision images from loopback/link-local/private
// address space. Media URLs are public CDN links, so a deny-list is enough.
function isBlockedInternalHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) return true;
    if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) {
        return true;
    }
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    return false;
}

async function fetchImageAsDataUrl(url, maxBytes = 8 * 1024 * 1024) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        if (isBlockedInternalHost(parsed.hostname)) {
            logger.warn('[LLMService] Blocked vision fetch to internal host');
            return null;
        }
        const resp = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxContentLength: maxBytes,
            maxBodyLength: maxBytes,
            headers: { 'User-Agent': 'SparkleAI/1.0' }
        });
        const mime = String(resp.headers['content-type'] || 'image/jpeg').split(';')[0];
        if (!mime.startsWith('image/')) return null;
        return `data:${mime};base64,${Buffer.from(resp.data).toString('base64')}`;
    } catch (err) {
        logger.warn(`[LLMService] Vision image fetch failed: ${err.message}`);
        return null;
    }
}

async function callProvider({ provider, messages, maxTokens, temperature, models: modelsOverride }) {
    const apiKey = provider.getKey();
    if (!apiKey) return null;

    // Build list of models to try (OpenRouter has fallback free models)
    const models = (Array.isArray(modelsOverride) && modelsOverride.length)
        ? modelsOverride
        : (provider.freeModels || [provider.defaultModel]);

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
                    // Vision messages carry content arrays (text + image_url
                    // parts); text turns stay plain strings.
                    const content = Array.isArray(m.content) ? m.content : String(m.content);
                    out.push({
                        role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
                        content
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

    /**
     * Vision analysis for a single image. The image is fetched server-side
     * (with an SSRF guard) and inlined as a base64 data URL so every provider
     * (Groq / Together / OpenRouter) can consume it.
     */
    static async runVision({
        prompt = 'Describe this image concisely. If it contains text, transcribe it.',
        imageUrl,
        temperature = 0.4,
        maxTokens = 600
    }) {
        if (!imageUrl) return { success: false, content: null, error: 'imageUrl is required' };

        let dataUrl = imageUrl;
        if (!String(imageUrl).startsWith('data:')) {
            if (!/^https?:\/\//i.test(imageUrl)) {
                return { success: false, content: null, error: 'Only http(s) image URLs are supported' };
            }
            dataUrl = await fetchImageAsDataUrl(imageUrl);
            if (!dataUrl) {
                return { success: false, content: null, error: 'Could not fetch the image for analysis' };
            }
        }

        const messages = [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: dataUrl } }
                ]
            }
        ];

        const providers = this.getAvailableProviders();
        if (providers.length === 0) {
            return { success: false, content: null, error: 'No AI provider configured' };
        }

        for (const provider of providers) {
            const models = provider.visionModels || [provider.defaultModel];
            const result = await callProvider({ provider, messages, maxTokens, temperature, models });
            if (result?.success) return result;
        }
        return { success: false, content: null, error: 'All vision providers failed' };
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
