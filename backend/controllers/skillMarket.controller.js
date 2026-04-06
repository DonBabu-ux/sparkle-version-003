const SkillMarket = require('../models/SkillMarket');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const getOffers = async (req, res) => {
    try {
        console.log('GET /offers request received');
        const filters = {
            campus: req.query.campus || (req.user && req.user.campus) || 'all',
            category: req.query.category,
            search: req.query.search
        };
        console.log('Filters:', filters);

        const offers = await SkillMarket.findAll(filters);
        console.log('Offers found:', offers ? offers.length : 'null');

        res.json(offers);
    } catch (error) {
        console.error('CRITICAL ERROR in getOffers:', error);
        logger.error('Get Skill Offers error:', error);
        res.status(500).json({ error: 'Failed to fetch offers', details: error.message });
    }
};

const createOffer = async (req, res) => {
    try {
        const offerData = {
            offer_id: uuidv4(),
            user_id: req.user.user_id || req.user.userId,
            title: req.body.title,
            description: req.body.description,
            category: req.body.category, // tutoring, tech_support, other
            skill_type: req.body.skill_type, // e.g. math, coding, design
            price: req.body.price || 0,
            is_free: req.body.is_free === 'true' || req.body.is_free === true,
            campus: req.body.campus || req.user.campus || 'main'
        };

        const newOffer = await SkillMarket.createOffer(offerData);
        res.status(201).json(newOffer);
    } catch (error) {
        logger.error('Create Skill Offer error:', error);
        res.status(500).json({ error: 'Failed to create offer' });
    }
};

const getOfferById = async (req, res) => {
    try {
        const offer = await SkillMarket.findById(req.params.id);
        if (!offer) return res.status(404).json({ error: 'Offer not found' });
        res.json(offer);
    } catch (error) {
        logger.error('Get Offer By ID error:', error);
        res.status(500).json({ error: 'Failed to fetch offer' });
    }
};

const bookSession = async (req, res) => {
    try {
        const bookingData = {
            booking_id: uuidv4(),
            offer_id: req.params.id,
            booker_id: req.user.user_id || req.user.userId,
            booking_date: req.body.booking_date,
            duration_minutes: req.body.duration || 60,
            notes: req.body.notes
        };
        await SkillMarket.createBooking(bookingData);
        res.status(201).json({ success: true, message: 'Booking request sent' });
    } catch (error) {
        logger.error('Book Session error:', error);
        res.status(500).json({ error: 'Failed to book session' });
    }
};

const updateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;
        const offer = await SkillMarket.findById(id);
        if (!offer) return res.status(404).json({ error: 'Offer not found' });
        if (offer.user_id !== userId) return res.status(403).json({ error: 'Unauthorized' });

        const allowed = ['title', 'description', 'category', 'skill_type', 'price', 'is_free', 'availability'];
        const updates = {};
        allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

        await SkillMarket.updateOffer(id, updates);
        res.json({ success: true, message: 'Offer updated' });
    } catch (error) {
        logger.error('Update Offer error:', error);
        res.status(500).json({ error: 'Failed to update offer' });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.user_id || req.user.userId;
        const offer = await SkillMarket.findById(id);
        if (!offer) return res.status(404).json({ error: 'Offer not found' });
        if (offer.user_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        await SkillMarket.deleteOffer(id);
        res.json({ success: true, message: 'Offer deleted' });
    } catch (error) {
        logger.error('Delete Offer error:', error);
        res.status(500).json({ error: 'Failed to delete offer' });
    }
};

const rateExchange = async (req, res) => {
    try {
        const { id } = req.params; // booking_id
        const userId = req.user.user_id || req.user.userId;
        const { rating, review } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        await SkillMarket.rateExchange(id, userId, rating, review);
        res.json({ success: true, message: 'Rating submitted' });
    } catch (error) {
        logger.error('Rate Exchange error:', error);
        res.status(500).json({ error: 'Failed to submit rating' });
    }
};

module.exports = {
    getOffers,
    createOffer,
    getOfferById,
    bookSession,
    updateOffer,
    deleteOffer,
    rateExchange
};
