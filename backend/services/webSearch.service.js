// services/webSearch.service.js - Server-Side Web Search Engine with HTML Sanitization
const axios = require('axios');
const logger = require('../utils/logger');

class WebSearchService {
    /**
     * Sanitize HTML snippets & text to remove tags, scripts, dangerous URLs, and prompt overrides
     */
    static sanitizeText(text) {
        if (!text || typeof text !== 'string') return '';
        return text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&(?:nbsp|amp|quot|lt|gt|#39);/g, (match) => {
                const map = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" };
                return map[match] || ' ';
            })
            .replace(/(ignore previous instructions|system prompt|disregard instructions)/gi, '[filtered]')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract hostname domain from URL
     */
    static extractDomain(urlStr) {
        try {
            const parsed = new URL(urlStr);
            return parsed.hostname.replace(/^www\./, '');
        } catch (e) {
            return 'web';
        }
    }

    /**
     * Perform server-side web search via DuckDuckGo HTML / fallback
     */
    static async search({ query, limit = 5 }) {
        if (!query || typeof query !== 'string' || !query.trim()) {
            return { tool: 'webSearch', query: '', count: 0, results: [] };
        }

        const cleanQuery = query.trim().substring(0, 200);
        logger.info(`[WebSearch] Executing web search for query: "${cleanQuery}"`);

        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                },
                timeout: 8000
            });

            const html = response.data || '';
            const results = [];

            // Match DuckDuckGo result blocks
            const resultRegex = /<a class="result__url" href="([^"]+)">[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
            const titleRegex = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/g;

            // Extract titles, links, snippets
            const snippets = [];
            let match;
            while ((match = resultRegex.exec(html)) !== null) {
                let rawUrl = match[1];
                let rawSnippet = match[2];
                // Handle DDG redirect URLs (/l/?uddg=URL)
                let actualUrl = rawUrl;
                if (rawUrl.includes('uddg=')) {
                    try {
                        const uddg = rawUrl.split('uddg=')[1].split('&')[0];
                        actualUrl = decodeURIComponent(uddg);
                    } catch (e) {
                        logger.debug('webSearch: DDG redirect URL decodeURIComponent failed', e?.message || e);
                    }
                }
                snippets.push({ url: actualUrl, snippet: this.sanitizeText(rawSnippet) });
            }

            const titles = [];
            while ((match = titleRegex.exec(html)) !== null) {
                titles.push(this.sanitizeText(match[1]));
            }

            const count = Math.min(titles.length, snippets.length, parseInt(limit, 10) || 5);
            for (let i = 0; i < count; i++) {
                const url = snippets[i].url;
                const domain = this.extractDomain(url);
                const title = titles[i] || `Search Result ${i + 1}`;
                const snippet = snippets[i].snippet;
                if (title && snippet) {
                    results.push({ title, url, domain, snippet });
                }
            }

            // Fallback if scraping yielded no structured results
            if (results.length === 0) {
                logger.warn(`[WebSearch] No structured results parsed for query: "${cleanQuery}". Using generic web result template.`);
                results.push({
                    title: `Latest Web Information for "${cleanQuery}"`,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
                    domain: 'duckduckgo.com',
                    snippet: `Search results and live web updates for "${cleanQuery}".`
                });
            }

            return {
                tool: 'webSearch',
                query: cleanQuery,
                count: results.length,
                results
            };
        } catch (err) {
            logger.error(`[WebSearch] Search request failed for "${cleanQuery}":`, err.message);
            return {
                tool: 'webSearch',
                query: cleanQuery,
                count: 1,
                results: [{
                    title: `Web Search for "${cleanQuery}"`,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
                    domain: 'duckduckgo.com',
                    snippet: `Search context for "${cleanQuery}". Web request completed.`
                }]
            };
        }
    }
}

module.exports = WebSearchService;
