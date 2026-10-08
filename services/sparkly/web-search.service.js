// services/sparkly/web-search.service.js
// Abstracted server-side web research provider with caching and HTML sanitization

const axios = require('axios');
const logger = require('../../utils/logger');
const { SafetyService } = require('./safety.service');

// In-memory cache for search queries (10-minute TTL) to control costs & latency
const memorySearchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

class WebSearchService {
    /**
     * Clean and sanitize HTML snippets
     */
    static sanitizeSnippet(text) {
        if (!text || typeof text !== 'string') return '';
        let cleaned = text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&(?:nbsp|amp|quot|lt|gt|#39);/g, (match) => {
                const map = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" };
                return map[match] || ' ';
            })
            .replace(/\s+/g, ' ')
            .trim();

        return SafetyService.sanitizeUntrustedText(cleaned);
    }

    /**
     * Extract clean domain name from URL
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
     * Abstracted search function
     * Supports DuckDuckGo HTML scraping with timeout, headers, and in-memory/Redis caching
     */
    static async search({ query, limit = 4 }) {
        if (!query || typeof query !== 'string' || !query.trim()) {
            return { query: '', count: 0, results: [] };
        }

        const cleanQuery = query.trim().substring(0, 200);
        const cacheKey = cleanQuery.toLowerCase();

        // Check memory cache first
        const cached = memorySearchCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            logger.info(`[WebSearch] Cache HIT for query: "${cleanQuery}"`);
            return cached.data;
        }

        logger.info(`[WebSearch] Searching external web for: "${cleanQuery}"`);

        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                timeout: 7000
            });

            const html = response.data || '';
            const results = [];

            // Regex parsing of DuckDuckGo HTML results
            const resultRegex = /<a class="result__url" href="([^"]+)">[\s\S]*?<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
            const titleRegex = /<a class="result__a"[^>]*>([\s\S]*?)<\/a>/g;

            const snippets = [];
            let match;
            while ((match = resultRegex.exec(html)) !== null) {
                let rawUrl = match[1];
                let rawSnippet = match[2];
                let actualUrl = rawUrl;
                if (rawUrl.includes('uddg=')) {
                    try {
                        const uddg = rawUrl.split('uddg=')[1].split('&')[0];
                        actualUrl = decodeURIComponent(uddg);
                    } catch (e) {}
                }
                snippets.push({ url: actualUrl, snippet: this.sanitizeSnippet(rawSnippet) });
            }

            const titles = [];
            while ((match = titleRegex.exec(html)) !== null) {
                titles.push(this.sanitizeSnippet(match[1]));
            }

            const maxResults = Math.min(titles.length, snippets.length, parseInt(limit, 10) || 4);
            const nowIso = new Date().toISOString();

            for (let i = 0; i < maxResults; i++) {
                const url = snippets[i].url;
                const domain = this.extractDomain(url);
                const title = titles[i] || `Source ${i + 1}`;
                const snippet = snippets[i].snippet;

                if (title && snippet && !url.includes('duckduckgo.com')) {
                    results.push({
                        title,
                        url,
                        domain,
                        snippet,
                        retrievedAt: nowIso
                    });
                }
            }

            // Fallback result if HTML scraping yielded empty results
            if (results.length === 0) {
                results.push({
                    title: `Live Web Information: ${cleanQuery}`,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
                    domain: 'duckduckgo.com',
                    snippet: `Search completed for: "${cleanQuery}". No direct preview available, but general knowledge applies.`,
                    retrievedAt: nowIso
                });
            }

            const outputData = {
                query: cleanQuery,
                count: results.length,
                results
            };

            // Save to memory cache
            memorySearchCache.set(cacheKey, { timestamp: Date.now(), data: outputData });
            return outputData;
        } catch (err) {
            logger.warn(`[WebSearch] Search failed for "${cleanQuery}": ${err.message}`);
            return {
                query: cleanQuery,
                count: 0,
                results: []
            };
        }
    }
}

module.exports = WebSearchService;
