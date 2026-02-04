const Marketplace = require('../models/Marketplace');
const logger = require('../utils/logger');

// Helper for media - prioritizes internal uploads, fallbacks for broken external
const getSafeMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) return url;
    if (url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
        return 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000';
    }
    return url;
};

// Web Routes (Rendering)
const renderMarketplace = async (req, res) => {
    try {
        const listings = await Marketplace.getListings();
        const sanitizedListings = listings.map(l => ({ ...l, image_url: getSafeMediaUrl(l.image_url) }));
        res.render('marketplace', { title: 'Marketplace', initialListings: sanitizedListings || [] });
    } catch (error) {
        logger.error('Render Marketplace Error:', error);
        res.render('marketplace', { title: 'Marketplace', initialListings: [] });
    }
};

const renderLostFound = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems();
        const sanitizedItems = items.map(i => ({ ...i, image_url: getSafeMediaUrl(i.image_url) }));
        res.render('lost-found', { title: 'Lost & Found', initialItems: sanitizedItems || [] });
    } catch (error) {
        logger.error('Render Lost & Found Error:', error);
        res.render('lost-found', { title: 'Lost & Found', initialItems: [] });
    }
};

const renderSkillMarket = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers();
        res.render('skill-market', { title: 'Skill Marketplace', initialOffers: offers || [] });
    } catch (error) {
        logger.error('Render Skill Market Error:', error);
        res.render('skill-market', { title: 'Skill Marketplace', initialOffers: [] });
    }
};

// API Routes (JSON)
const getListings = async (req, res) => {
    try {
        const listings = await Marketplace.getListings(req.query);
        const sanitizedListings = listings.map(l => ({ ...l, image_url: getSafeMediaUrl(l.image_url) }));
        res.json(sanitizedListings);
    } catch (error) {
        logger.error('API Get Listings Error:', error);
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
};

const getLostFoundItems = async (req, res) => {
    try {
        const items = await Marketplace.getLostFoundItems(req.query);
        const sanitizedItems = items.map(i => ({ ...i, image_url: getSafeMediaUrl(i.image_url) }));
        res.json(sanitizedItems);
    } catch (error) {
        logger.error('API Get Lost & Found Error:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
};

const getSkillOffers = async (req, res) => {
    try {
        const offers = await Marketplace.getSkillOffers(req.query);
        res.json(offers);
    } catch (error) {
        logger.error('API Get Skill Offers Error:', error);
        res.status(500).json({ error: 'Failed to fetch skill offers' });
    }
};

const createListing = async (req, res) => {
    try {
        const sellerId = req.user.user_id || req.user.userId;
        const listingId = await Marketplace.createListing(sellerId, req.body);
        res.status(201).json({ message: 'Listing created successfully', listing_id: listingId });
    } catch (error) {
        logger.error('Create Listing Error:', error);
        res.status(500).json({ error: 'Failed to create listing' });
    }
};

const createLostFoundItem = async (req, res) => {
    try {
        const reporterId = req.user.user_id || req.user.userId;
        const itemId = await Marketplace.createLostFoundItem(reporterId, req.body);
        res.status(201).json({ message: 'Item reported successfully', item_id: itemId });
    } catch (error) {
        logger.error('Create Lost & Found Item Error:', error);
        res.status(500).json({ error: 'Failed to create item' });
    }
};

const createSkillOffer = async (req, res) => {
    try {
        const userId = req.user.user_id || req.user.userId;
        const offerId = await Marketplace.createSkillOffer(userId, req.body);
        res.status(201).json({ message: 'Skill offer created successfully', offer_id: offerId });
    } catch (error) {
        logger.error('Create Skill Offer Error:', error);
        res.status(500).json({ error: 'Failed to create skill offer' });
    }
};

module.exports = {
    renderMarketplace,
    renderLostFound,
    renderSkillMarket,
    getListings,
    getLostFoundItems,
    getSkillOffers,
    createListing,
    createLostFoundItem,
    createSkillOffer
};
