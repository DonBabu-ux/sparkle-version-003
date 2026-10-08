// services/sparkly/sparkly.orchestrator.js
// Central Orchestration Gateway for Sparkly AI Assistant

const logger = require('../../utils/logger');
const { IntentService, DOMAIN_TYPES, INTENT_TYPES } = require('./intent.service');
const SparkleDataService = require('./sparkle-data.service');
const WebSearchService = require('./web-search.service');
const ContextService = require('./context.service');
const MemoryService = require('./memory.service');
const PromptService = require('./prompt.service');
const BytezService = require('./bytez.service');
const ResponseService = require('./response.service');
const SparklyModel = require('../../models/sparkly.model');

class SparklyOrchestrator {
    /**
     * Main Pipeline: Process standard non-streaming chat request
     */
    static async processChatRequest({ user, message, conversationId = null, clientContext = {} }) {
        const startTime = Date.now();
        const userId = user?.user_id || user?.id;

        // 1. Validate request
        if (!message || typeof message !== 'string' || !message.trim()) {
            throw new Error('Message is required');
        }
        const cleanMessage = message.trim();

        // 2. Initialize or load conversation session
        let activeConvId = conversationId;
        let isNewConversation = false;

        if (!activeConvId && userId) {
            try {
                const newConv = await SparklyModel.createConversation(userId, cleanMessage.substring(0, 30));
                activeConvId = newConv.id;
                isNewConversation = true;
            } catch (convErr) {
                logger.warn('[SparklyOrchestrator] Session creation fallback (ephemeral):', convErr.message);
                activeConvId = 'session-' + Date.now();
            }
        }

        // Save user message to MySQL database
        if (activeConvId && userId && !activeConvId.startsWith('session-')) {
            try {
                await MemoryService.saveTurn({
                    conversationId: activeConvId,
                    userId,
                    role: 'user',
                    content: cleanMessage
                });
            } catch (saveErr) {
                logger.warn('[SparklyOrchestrator] Failed to save user turn:', saveErr.message);
            }
        }

        // Asynchronously extract and save user preferences in background
        if (userId) {
            MemoryService.extractAndSavePreferences(cleanMessage, userId).catch(() => {});
        }

        // 3. Load conversation turns & user memories
        const conversationTurns = activeConvId && userId
            ? await MemoryService.getRecentConversationTurns(activeConvId, userId, 8)
            : [];
        const userMemories = userId
            ? await MemoryService.getUserMemories(userId)
            : [];
        const memoryBlock = MemoryService.formatMemoryBlock(userMemories);

        // 4. Intent Routing
        const route = IntentService.routeRequest({
            message: cleanMessage,
            conversationHistory: conversationTurns,
            context: clientContext,
            user
        });
        logger.info(`[SparklyOrchestrator] Intent: ${route.intent} | Domain: ${route.domain}`);

        // Handle safety refusal immediately
        if (route.domain === DOMAIN_TYPES.SAFETY_REFUSAL) {
            const refusalAnswer = route.refusalReason || "I cannot fulfill that request due to Sparkle's privacy and safety policies.";
            if (activeConvId && userId) {
                await MemoryService.saveTurn({
                    conversationId: activeConvId,
                    userId,
                    role: 'assistant',
                    content: refusalAnswer
                });
            }
            return ResponseService.formatResponse({
                content: refusalAnswer,
                sources: [],
                structuredCards: [],
                metadata: {
                    usedSparkleData: false,
                    usedWebSearch: false,
                    domain: route.domain,
                    intent: route.intent
                }
            });
        }

        // 5. Retrieve Sparkle Data (if required)
        let sparkleData = null;
        let structuredCards = [];

        if (route.requiresSparkleData) {
            try {
                switch (route.intent) {
                    case INTENT_TYPES.MARKETPLACE_SEARCH: {
                        const searchRes = await SparkleDataService.searchMarketplace({
                            query: route.parameters.query || '',
                            minPrice: route.parameters.minPrice,
                            maxPrice: route.parameters.maxPrice,
                            campus: route.parameters.campus || clientContext.campus
                        }, user);
                        sparkleData = searchRes;
                        structuredCards = searchRes.structuredCards || [];
                        break;
                    }

                    case INTENT_TYPES.MARKETPLACE_LISTING_DETAIL: {
                        const listingId = route.parameters.listingId || clientContext.listingId;
                        if (listingId) {
                            sparkleData = await SparkleDataService.getMarketplaceListing(listingId);
                            if (sparkleData) {
                                structuredCards = [{
                                    listing_id: sparkleData.listing_id,
                                    title: sparkleData.title,
                                    price: sparkleData.raw_price,
                                    image_url: sparkleData.image_url,
                                    campus: sparkleData.campus,
                                    location: sparkleData.location,
                                    condition: sparkleData.condition,
                                    seller_name: sparkleData.seller?.name || sparkleData.seller?.username
                                }];
                            }
                        }
                        break;
                    }

                    case INTENT_TYPES.USER_PROFILE_SELF: {
                        sparkleData = await SparkleDataService.getUserProfile(userId, userId);
                        break;
                    }

                    case INTENT_TYPES.USER_PROFILE_PUBLIC: {
                        sparkleData = await SparkleDataService.getPublicSparkleProfile(route.parameters.username);
                        break;
                    }

                    case INTENT_TYPES.USER_NOTIFICATIONS: {
                        sparkleData = await SparkleDataService.getUserNotifications(userId, userId, 5);
                        break;
                    }

                    case INTENT_TYPES.USER_REFERRALS: {
                        sparkleData = await SparkleDataService.getUserReferralStats(userId);
                        break;
                    }

                    case INTENT_TYPES.SPARKLE_HELP: {
                        const helpDocs = SparkleDataService.searchSparkleHelp(route.parameters.topic || cleanMessage);
                        const policies = SparkleDataService.getMarketplacePolicies();
                        sparkleData = { helpArticles: helpDocs, marketplacePolicies: policies };
                        break;
                    }

                    case INTENT_TYPES.HYBRID_PRICE_COMPARE: {
                        const listingId = route.parameters.listingId || clientContext.listingId;
                        if (listingId) {
                            sparkleData = await SparkleDataService.getMarketplaceListing(listingId);
                        } else if (route.parameters.query) {
                            const candidateRes = await SparkleDataService.searchMarketplace({ query: route.parameters.query, limit: 1 }, user);
                            sparkleData = candidateRes.listings?.[0] || null;
                        }
                        break;
                    }

                    default:
                        break;
                }
            } catch (err) {
                logger.error('[SparklyOrchestrator] Sparkle data retrieval failed:', err.message);
                sparkleData = null;
            }
        }

        // 6. Search External Web (if required)
        let webData = null;
        let sources = [];

        if (route.requiresWebSearch) {
            try {
                let searchQuery = route.parameters.query || cleanMessage;
                if (route.intent === INTENT_TYPES.HYBRID_PRICE_COMPARE && sparkleData?.title) {
                    searchQuery = `${sparkleData.title} price Kenya online`;
                }
                webData = await WebSearchService.search({ query: searchQuery, limit: 4 });
                sources = (webData.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    domain: r.domain,
                    snippet: r.snippet
                }));
            } catch (err) {
                logger.warn('[SparklyOrchestrator] Web search retrieval failed:', err.message);
                webData = null;
            }
        }

        // 7. Build Trusted Context
        const userContextText = ContextService.buildUserContext(user, clientContext);
        const contextText = ContextService.buildPromptContext({
            userContext: userContextText,
            sparkleData,
            webData,
            memoryBlock
        });

        // 8. Assemble Model Payload
        const modelPayload = PromptService.assemblePayload({
            contextText,
            conversationTurns,
            userMessage: cleanMessage
        });

        // 9. Call Bytez Model
        let assistantContent = null;
        const modelResult = await BytezService.runModel({
            systemPrompt: modelPayload.systemPrompt,
            context: modelPayload.context,
            messages: modelPayload.messages
        });

        if (modelResult.success && modelResult.content) {
            assistantContent = modelResult.content;
        } else {
            // Intelligent fallback synthesis
            logger.info('[SparklyOrchestrator] Utilizing intelligent local synthesis fallback');
            assistantContent = ResponseService.buildIntelligentFallback({
                intent: route.intent,
                sparkleData,
                webData,
                query: cleanMessage,
                user
            });
        }

        // 10. Persist Assistant Response & Update Conversation
        let savedMessage = null;
        if (activeConvId && userId) {
            savedMessage = await MemoryService.saveTurn({
                conversationId: activeConvId,
                userId,
                role: 'assistant',
                content: assistantContent,
                structuredData: structuredCards.length > 0 ? { cards: structuredCards } : null
            });

            // If it's a new conversation, generate and save concise title
            if (isNewConversation || conversationTurns.length <= 1) {
                const newTitle = MemoryService.generateTitle(cleanMessage);
                await SparklyModel.updateConversationTitle(activeConvId, userId, newTitle).catch(() => {});
            }
        }

        const durationMs = Date.now() - startTime;
        logger.info(`[SparklyOrchestrator] Request completed in ${durationMs}ms`);

        // 11. Format & Return Response
        const formatted = ResponseService.formatResponse({
            content: assistantContent,
            sources,
            structuredCards,
            metadata: {
                usedSparkleData: Boolean(sparkleData),
                usedWebSearch: Boolean(webData && sources.length > 0),
                domain: route.domain,
                intent: route.intent
            }
        });

        formatted.conversationId = activeConvId;
        formatted.savedMessage = savedMessage;
        return formatted;
    }

    /**
     * SSE Streaming Pipeline: Streams tokens and structured metadata to the client
     */
    static async processChatStream({ user, message, conversationId = null, clientContext = {}, res }) {
        const userId = user?.user_id || user?.id;

        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        });

        const sendEvent = (event, data) => {
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (e) {}
        };

        try {
            // Initialize or load conversation
            let activeConvId = conversationId;
            let isNewConversation = false;

            if (!activeConvId && userId) {
                const newConv = await SparklyModel.createConversation(userId, message.substring(0, 30));
                activeConvId = newConv.id;
                isNewConversation = true;
            }

            // Immediately send conversation meta to client
            sendEvent('meta', { type: 'init', conversationId: activeConvId });

            // Save user message to database
            if (activeConvId && userId) {
                await MemoryService.saveTurn({
                    conversationId: activeConvId,
                    userId,
                    role: 'user',
                    content: message.trim()
                });
            }

            // Memory extraction in background
            if (userId) {
                MemoryService.extractAndSavePreferences(message.trim(), userId).catch(() => {});
            }

            // Load context & turns
            const conversationTurns = activeConvId && userId
                ? await MemoryService.getRecentConversationTurns(activeConvId, userId, 8)
                : [];
            const userMemories = userId
                ? await MemoryService.getUserMemories(userId)
                : [];
            const memoryBlock = MemoryService.formatMemoryBlock(userMemories);

            // Intent routing
            const route = IntentService.routeRequest({
                message: message.trim(),
                conversationHistory: conversationTurns,
                context: clientContext,
                user
            });

            // Safety refusal
            if (route.domain === DOMAIN_TYPES.SAFETY_REFUSAL) {
                const refusalText = route.refusalReason || "I cannot fulfill that request.";
                sendEvent('chunk', { text: refusalText, token: refusalText });
                sendEvent('done', { type: 'done' });
                res.end();
                return;
            }

            // Retrieve data
            let sparkleData = null;
            let structuredCards = [];

            if (route.requiresSparkleData) {
                if (route.intent === INTENT_TYPES.MARKETPLACE_SEARCH) {
                    const searchRes = await SparkleDataService.searchMarketplace({
                        query: route.parameters.query || '',
                        minPrice: route.parameters.minPrice,
                        maxPrice: route.parameters.maxPrice,
                        campus: route.parameters.campus || clientContext.campus
                    }, user);
                    sparkleData = searchRes;
                    structuredCards = searchRes.structuredCards || [];
                } else if (route.intent === INTENT_TYPES.MARKETPLACE_LISTING_DETAIL) {
                    sparkleData = await SparkleDataService.getMarketplaceListing(route.parameters.listingId || clientContext.listingId);
                } else if (route.intent === INTENT_TYPES.USER_PROFILE_SELF) {
                    sparkleData = await SparkleDataService.getUserProfile(userId, userId);
                } else if (route.intent === INTENT_TYPES.SPARKLE_HELP) {
                    sparkleData = {
                        helpArticles: SparkleDataService.searchSparkleHelp(route.parameters.topic || message),
                        marketplacePolicies: SparkleDataService.getMarketplacePolicies()
                    };
                }
            }

            // Send cards event if cards were found
            if (structuredCards.length > 0) {
                sendEvent('cards', { cards: structuredCards, structuredCards });
            }

            // Search web
            let webData = null;
            let sources = [];
            if (route.requiresWebSearch) {
                webData = await WebSearchService.search({ query: route.parameters.query || message, limit: 4 });
                sources = (webData.results || []).map(r => ({
                    title: r.title,
                    url: r.url,
                    domain: r.domain,
                    snippet: r.snippet
                }));
                if (sources.length > 0) {
                    sendEvent('sources', { sources });
                }
            }

            // Assemble context and payload
            const userContextText = ContextService.buildUserContext(user, clientContext);
            const contextText = ContextService.buildPromptContext({
                userContext: userContextText,
                sparkleData,
                webData,
                memoryBlock
            });

            const modelPayload = PromptService.assemblePayload({
                contextText,
                conversationTurns,
                userMessage: message.trim()
            });

            let fullAnswer = '';

            // Attempt streaming via Bytez
            const streamResult = await BytezService.runStreamModel({
                systemPrompt: modelPayload.systemPrompt,
                context: modelPayload.context,
                messages: modelPayload.messages,
                onToken: (chunk) => {
                    fullAnswer += chunk;
                    sendEvent('chunk', { text: chunk, token: chunk });
                }
            });

            if (!streamResult.success || !fullAnswer.trim()) {
                // If stream didn't yield text, stream the intelligent fallback chunks
                const fallbackText = ResponseService.buildIntelligentFallback({
                    intent: route.intent,
                    sparkleData,
                    webData,
                    query: message.trim(),
                    user
                });
                fullAnswer = fallbackText;
                
                // Stream in natural pacing
                const words = fallbackText.split(' ');
                for (let i = 0; i < words.length; i++) {
                    const token = (i === 0 ? '' : ' ') + words[i];
                    sendEvent('chunk', { text: token, token });
                    await new Promise(r => setTimeout(r, 20));
                }
            }

            // Save completed message
            let savedMessage = null;
            if (activeConvId && userId) {
                savedMessage = await MemoryService.saveTurn({
                    conversationId: activeConvId,
                    userId,
                    role: 'assistant',
                    content: fullAnswer,
                    structuredData: structuredCards.length > 0 ? { cards: structuredCards } : null
                });

                if (isNewConversation) {
                    const newTitle = MemoryService.generateTitle(message);
                    await SparklyModel.updateConversationTitle(activeConvId, userId, newTitle).catch(() => {});
                }
            }

            sendEvent('done', {
                type: 'done',
                conversationId: activeConvId,
                savedMessage
            });
            res.end();
        } catch (err) {
            logger.error('[SparklyOrchestrator] Stream error:', err);
            sendEvent('error', { message: 'Sparkly encountered an issue generating a response.' });
            res.end();
        }
    }
}

module.exports = SparklyOrchestrator;
