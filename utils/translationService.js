const fetch = require('node-fetch');

/**
 * Modern Translation Service
 * Uses a reliable public API to translate between languages (e.g. English <-> Kiswahili)
 */
class TranslationService {
    /**
     * Translate text to a target language
     * @param {string} text - Text to translate
     * @param {string} targetLang - Target language code (en, sw, etc.)
     * @returns {Promise<string>} - Translated text
     */
    static async translate(text, targetLang = 'en') {
        if (!text || text.trim() === '') return '';
        
        try {
            // Using the public Google Translate API endpoint (client=gtx)
            // sl=auto (source language auto-detect)
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Translation API responded with status: ${response.status}`);
            }

            const data = await response.json();
            
            // The response format is [[["translated_text", "original_text", ...], ...], ...]
            if (data && data[0] && Array.isArray(data[0])) {
                return data[0].map(item => item[0]).join('');
            }

            return text; // Fallback to original
        } catch (error) {
            console.error('Translation Service Error:', error);
            return text; // Fallback to original on error
        }
    }

    /**
     * Detect if text is mostly Swahili or English and translate to the other
     */
    static async smartTranslate(text) {
        if (!text) return { text: '', target: 'en' };

        // Simple heuristic: if it contains common Swahili words, translate to English, else to Swahili
        const swahiliWords = ['habari', 'mambo', 'sana', 'karibu', 'asante', 'ndio', 'hapana', 'leo', 'sasa', 'pole', 'safari'];
        const isSwahili = swahiliWords.some(word => text.toLowerCase().includes(word));
        
        const target = isSwahili ? 'en' : 'sw';
        const translated = await this.translate(text, target);
        
        return {
            text: translated,
            target: target
        };
    }
}

module.exports = TranslationService;
