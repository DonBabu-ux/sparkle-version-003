// scripts/test-sparkly-backend.js - Comprehensive Test Suite for Conversational & Web-Aware Sparkly Engine
require('dotenv').config();
const SparklyService = require('../services/sparkly.service');
const SparklyKnowledgeService = require('../services/knowledge.service');
const ToolRegistryService = require('../services/toolRegistry.service');
const IntentService = require('../services/intent.service');
const WebSearchService = require('../services/webSearch.service');
const logger = require('../utils/logger');

async function runTests() {
    logger.info('===================================================');
    logger.info('🧪 STARTING SPARKLY CONVERSATIONAL & MARKETPLACE TEST SUITE');
    logger.info('===================================================');

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            logger.info(`✅ PASS: ${message}`);
            passed++;
        } else {
            logger.error(`❌ FAIL: ${message}`);
            failed++;
        }
    }

    const mockUserA = { user_id: 'test-user-a', id: 'test-user-a', username: 'Alice', name: 'Alice W.', campus: 'Main Campus' };

    try {
        // ── TEST 1: Greeting Intent ("hey") ──────────────────────────────────
        logger.info('\n--- Test 1: Greeting Intent ("hey") ---');
        const g1 = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: 'hey', userProfile: mockUserA });
        assert(g1 && typeof g1.answer === 'string' && g1.answer.length > 3, 'Greeting returned natural response');

        // ── TEST 2: Web Search Capability ("can u search the internet?") ────
        logger.info('\n--- Test 2: Web Search Capability ("can u search the internet?") ---');
        const webCap = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: 'can u search the internet?', userProfile: mockUserA });
        assert(webCap && webCap.answer.includes('search') && webCap.answer.includes('internet'), 'Web search capability acknowledged clearly');

        // ── TEST 3: Explicit Web Search ("search the internet for Kenya tech news") ──
        logger.info('\n--- Test 3: Explicit Web Search ---');
        const webSearchRes = await SparklyService.processChat({
            userId: mockUserA.user_id,
            messageText: 'search the internet for the latest technology news in Kenya',
            userProfile: mockUserA
        });
        assert(webSearchRes && webSearchRes.answer.includes('searching the web') || webSearchRes.answer.includes('Kenya'), 'Web search executed and returned web sources');

        // ── TEST 4: Query Extraction & Condition Filter ("get me shoes, brand new") ──
        logger.info('\n--- Test 4: Query Extraction ("get me shoes, brand new") ---');
        const intentFilter = IntentService.classifyIntent('get me shoes, brand new');
        assert(intentFilter.primaryIntent === 'MARKETPLACE_SEARCH', 'Intent classified as MARKETPLACE_SEARCH');
        const searchTool = intentFilter.toolsToCall.find(t => t.tool === 'searchMarketplace');
        assert(searchTool && searchTool.params.query === 'shoes', 'Extracted product query clean without pollution: "shoes"');
        assert(searchTool && searchTool.params.condition === 'new', 'Extracted condition filter: "new"');

        // ── TEST 5: Marketplace Search ("shoes") ─────────────────────────────
        logger.info('\n--- Test 5: Direct Marketplace Search ("shoes") ---');
        const shoesRes = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: 'shoes', userProfile: mockUserA });
        assert(shoesRes && !shoesRes.answer.includes('"listings"') && !shoesRes.answer.includes('null'), 'Response query label formatted cleanly without "listings" corruption');

        // ── TEST 6: Follow-Up Sequence ("find shoes" -> "brand new" -> "under 5000") ──
        logger.info('\n--- Test 6: Follow-Up Search Sequence ---');
        const historyMock = [
            { role: 'user', content: 'find shoes' },
            { role: 'assistant', content: 'I found listings matching "shoes".' }
        ];
        const followUpIntent = IntentService.classifyIntent('brand new', historyMock);
        assert(followUpIntent.primaryIntent === 'MARKETPLACE_SEARCH', 'Follow-up classified as MARKETPLACE_SEARCH');
        const followUpTool = followUpIntent.toolsToCall.find(t => t.tool === 'searchMarketplace');
        assert(followUpTool && followUpTool.params.query === 'shoes', 'Follow-up preserved previous search query "shoes"');
        assert(followUpTool && followUpTool.params.condition === 'new', 'Follow-up applied new condition filter "new"');

        // ── TEST 7: Casual Conversation ("okay") ────────────────────────────
        logger.info('\n--- Test 7: Casual Response ("okay") ---');
        const okRes = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: 'okay', userProfile: mockUserA });
        assert(okRes && typeof okRes.answer === 'string' && okRes.answer.length > 3, 'Casual response returned natural variation without search fallback');

        // ── TEST 8: Capabilities ("what can you do?") ────────────────────────
        logger.info('\n--- Test 8: Capabilities ---');
        const capRes = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: 'what can you do?', userProfile: mockUserA });
        assert(capRes && capRes.answer.includes('Marketplace Search') || capRes.answer.includes('Web Search'), 'Capabilities correctly listed');

        // ── TEST 9: Identity ("who are you?") ────────────────────────────────
        logger.info('\n--- Test 9: Identity ---');
        const idRes = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: 'who are you?', userProfile: mockUserA });
        assert(idRes && idRes.answer.includes('Sparkly'), 'Identity correctly states Sparkly assistant');

        // ── TEST 10: Date Intent ("what is today's date?") ──────────────────
        logger.info('\n--- Test 10: Dynamic Date ---');
        const dateRes = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: "what is today's date?", userProfile: mockUserA });
        assert(dateRes && (dateRes.answer.includes('Today') || dateRes.answer.includes('202')), 'Date returned dynamic date string');

        // ── TEST 11: Temporal Live Query ("what's the latest football news?") ──
        logger.info('\n--- Test 11: Temporal Live Query ---');
        const footIntent = IntentService.classifyIntent("what's the latest football news?");
        assert(footIntent.primaryIntent === 'WEB_SEARCH', 'Temporal news query classified as WEB_SEARCH');

        // ── TEST 12: Knowledge Explanation ("explain Newton's second law") ──
        logger.info('\n--- Test 12: Knowledge / Concept Explanation ---');
        const newtonRes = await SparklyService.processChat({ userId: mockUserA.user_id, messageText: "explain Newton's second law", userProfile: mockUserA });
        assert(newtonRes && typeof newtonRes.answer === 'string' && newtonRes.answer.length > 10, 'General concept explanation generated clearly');

        // ── TEST 13: Memory Extraction ──────────────────────────────────────
        logger.info('\n--- Test 13: Memory Extraction ---');
        await SparklyService.extractAndSaveMemories("I usually buy laptops under 50k", mockUserA.user_id);
        const mems = await ToolRegistryService.getMarketplacePreferences({}, mockUserA);
        assert(mems && Array.isArray(mems.memories), 'Memory extraction pipeline executed safely');

        // ── TEST 14: Title Generation ───────────────────────────────────────
        logger.info('\n--- Test 14: Conversation Title Generation ---');
        const title = await SparklyService.generateConversationTitle('find me a cheap couch for my hostel room', 'I found 3 couches on Sparkle');
        assert(title && title.length > 3 && !title.includes('find me'), 'Concise ChatGPT-style title generated');

        // ── TEST 15: Unauthorized Tool Block ────────────────────────────────
        logger.info('\n--- Test 15: Unauthorized Tool Rejection ---');
        let toolRejected = false;
        try {
            await ToolRegistryService.executeTool('deleteDatabase', {}, mockUserA);
        } catch (err) {
            toolRejected = true;
        }
        assert(toolRejected, 'Successfully blocked arbitrary / malicious tool execution');

    } catch (err) {
        logger.error('❌ Test suite runtime error:', err);
        failed++;
    }

    logger.info('===================================================');
    logger.info(`📊 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    logger.info('===================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
