// schemas/marketplace.schemas.js - Fixed version
const Joi = require('joi');

// UUID validation helper
const uuidSchema = Joi.string().guid({ version: 'uuidv4' }).required();

// ==================== LISTING SCHEMAS ====================

exports.createListingSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().min(10).max(1000).required(),
  price: Joi.number().positive().max(1000000).required(),
  category: Joi.string().valid(
    'electronics', 'books', 'clothing', 'furniture', 'services', 'other'
  ).default('other'),
  condition: Joi.string().valid(
    'new', 'like_new', 'good', 'fair', 'poor'
  ).default('good'),
  campus: Joi.string().valid(
    'main_campus', 'north_campus', 'south_campus', 'downtown'
  ).required(),
  location: Joi.string().max(255).optional().allow(''),
  tags: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string()
  ).optional()
});

// ==================== ORDER SCHEMAS ====================

/**
 * Create order schema - FIXED: Only require listingId
 * Server derives all other data from database for security
 */
exports.createOrderSchema = Joi.object({
  listingId: uuidSchema
});

/**
 * Update order status schema - NEW: Complete validation
 */
exports.updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'accepted', 'rejected', 'cancelled', 'completed', 'disputed'
  ).required(),
  reason: Joi.string().max(500).when('status', {
    is: 'cancelled',
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

/**
 * Confirm meetup schema
 */
exports.confirmMeetupSchema = Joi.object({}); // No body params needed

// ==================== REVIEW SCHEMAS ====================

/**
 * Create review schema - NEW: Complete validation
 */
exports.createReviewSchema = Joi.object({
  listing_id: uuidSchema,
  reviewee_id: uuidSchema,
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(1000).optional().allow(''),
  transaction_type: Joi.string().valid('buyer', 'seller').required()
});

// ==================== CONTACT/REPORT SCHEMAS ====================

exports.contactSellerSchema = Joi.object({
  sellerId: uuidSchema,
  listingId: uuidSchema.optional(),
  message: Joi.string().max(500).required()
});

exports.reportListingSchema = Joi.object({
  reason: Joi.string().valid(
    'fake_item', 'wrong_category', 'prohibited', 'spam', 'offensive', 'other'
  ).required(),
  details: Joi.string().max(1000).optional().allow('')
});

// ==================== FAVORITE SCHEMAS ====================

exports.toggleFavoriteSchema = Joi.object({
  listingId: uuidSchema
});

exports.favoriteSellerSchema = Joi.object({
  sellerId: uuidSchema
});

// ==================== BLOCK USER SCHEMA ====================

exports.blockUserSchema = Joi.object({
  reason: Joi.string().max(255).optional().allow('')
});

// ==================== LOST & FOUND SCHEMAS ====================

exports.createLostFoundSchema = Joi.object({
  type: Joi.string().valid('lost', 'found').required(),
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).required(),
  category: Joi.string().valid(
    'electronics', 'books', 'clothing', 'accessories', 'id_cards', 'keys', 'other'
  ).required(),
  campus: Joi.string().valid(
    'main_campus', 'north_campus', 'south_campus', 'downtown'
  ).required(),
  location: Joi.string().max(255).optional().allow(''),
  date_lost_found: Joi.date().optional()
});

// ==================== SKILL OFFER SCHEMAS ====================

exports.createSkillOfferSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).required(),
  category: Joi.string().valid(
    'academic', 'music', 'sports', 'technology', 'language', 'other'
  ).required(),
  skill_type: Joi.string().valid('tutor', 'service', 'exchange').required(),
  price: Joi.number().positive().max(100000).when('is_free', {
    is: true,
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  is_free: Joi.boolean().default(false),
  campus: Joi.string().valid(
    'main_campus', 'north_campus', 'south_campus', 'downtown'
  ).required()
});

// ==================== QUERY PARAM SCHEMAS ====================

exports.listingsQuerySchema = Joi.object({
  search: Joi.string().max(100).optional().allow(''),
  category: Joi.string().valid(
    'electronics', 'books', 'clothing', 'furniture', 'services', 'other', 'all'
  ).optional(),
  campus: Joi.string().valid(
    'main_campus', 'north_campus', 'south_campus', 'downtown', 'all'
  ).optional(),
  condition: Joi.string().valid(
    'new', 'like_new', 'good', 'fair', 'poor', 'all'
  ).optional(),
  minPrice: Joi.number().min(0).default(0),
  maxPrice: Joi.number().min(0).max(1000000).default(1000000),
  minRating: Joi.number().min(0).max(5).default(0),
  sort: Joi.string().valid(
    'newest', 'popular', 'price_low', 'price_high'
  ).default('newest'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  currentUserId: uuidSchema.optional()
});

exports.ordersQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  role: Joi.string().valid('buyer', 'seller').optional()
});

// ==================== ERROR RESPONSES ====================

exports.errorCodes = {
  LISTING_NOT_FOUND: 'Listing not found',
  LISTING_SOLD: 'Item already sold',
  LISTING_NOT_ACTIVE: 'Listing is not active',
  CANNOT_BUY_OWN: 'Cannot buy your own item',
  ORDER_EXISTS: 'You already have an active order for this item',
  ORDER_NOT_FOUND: 'Order not found',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  INVALID_TRANSITION: 'Cannot change status from current to requested',
  MEETUP_NOT_CONFIRMED: 'Both parties must confirm the meetup first',
  INVALID_STATUS: 'Invalid status value provided'
};