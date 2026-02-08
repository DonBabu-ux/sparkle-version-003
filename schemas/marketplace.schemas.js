const Joi = require('joi');

const marketplaceSchemas = {
    // Create listing validation
    createListing: Joi.object({
        title: Joi.string()
            .trim()
            .min(3)
            .max(100)
            .required()
            .messages({
                'string.min': 'Title must be at least 3 characters',
                'string.max': 'Title cannot exceed 100 characters',
                'any.required': 'Title is required'
            }),

        description: Joi.string()
            .trim()
            .min(10)
            .max(1000)
            .required()
            .messages({
                'string.min': 'Description must be at least 10 characters',
                'string.max': 'Description cannot exceed 1000 characters',
                'any.required': 'Description is required'
            }),

        price: Joi.number()
            .positive()
            .max(1000000)
            .required()
            .messages({
                'number.positive': 'Price must be a positive number',
                'number.max': 'Price cannot exceed $1,000,000',
                'any.required': 'Price is required'
            }),

        category: Joi.string()
            .valid('electronics', 'books', 'clothing', 'furniture', 'services', 'student_market', 'secondhand', 'other')
            .default('other'),

        condition: Joi.string()
            .valid('new', 'like_new', 'good', 'fair', 'poor')
            .default('good'),

        campus: Joi.string()
            .valid('main_campus', 'north_campus', 'south_campus', 'downtown')
            .required()
            .messages({
                'any.only': 'Invalid campus selection',
                'any.required': 'Campus is required'
            }),

        location: Joi.string()
            .trim()
            .max(255)
            .allow(''),

        tags: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        ).default([])
    }),

    // Update listing validation
    updateListing: Joi.object({
        title: Joi.string()
            .trim()
            .min(3)
            .max(100),

        description: Joi.string()
            .trim()
            .min(10)
            .max(1000),

        price: Joi.number()
            .positive()
            .max(1000000),

        category: Joi.string()
            .valid('electronics', 'books', 'clothing', 'furniture', 'services', 'student_market', 'secondhand', 'other'),

        condition: Joi.string()
            .valid('new', 'like_new', 'good', 'fair', 'poor'),

        status: Joi.string()
            .valid('active', 'sold', 'pending', 'inactive'),

        location: Joi.string()
            .trim()
            .max(255)
            .allow(''),

        tags: Joi.alternatives().try(
            Joi.string(),
            Joi.array().items(Joi.string())
        )
    }),

    // Search listings validation
    searchListings: Joi.object({
        search: Joi.string()
            .trim()
            .max(100)
            .allow(''),

        category: Joi.string()
            .valid('electronics', 'books', 'clothing', 'furniture', 'services', 'student_market', 'secondhand', 'other', 'all')
            .default('all'),

        min_price: Joi.number()
            .min(0)
            .max(1000000),

        max_price: Joi.number()
            .min(0)
            .max(1000000),

        campus: Joi.string()
            .valid('main_campus', 'north_campus', 'south_campus', 'downtown'),

        condition: Joi.string()
            .valid('new', 'like_new', 'good', 'fair', 'poor'),

        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(20),

        offset: Joi.number()
            .integer()
            .min(0)
            .default(0),

        sortBy: Joi.string()
            .valid('price', 'created_at', 'view_count')
            .default('created_at'),

        sortOrder: Joi.string()
            .valid('ASC', 'DESC')
            .default('DESC')
    }),

    // Contact seller validation
    contactSeller: Joi.object({
        sellerId: Joi.string()
            .guid({ version: 'uuidv4' })
            .required()
            .messages({
                'string.guid': 'Invalid seller ID format',
                'any.required': 'Seller ID is required'
            }),

        listingId: Joi.string()
            .guid({ version: 'uuidv4' })
            .allow(null),

        message: Joi.string()
            .trim()
            .max(500)
            .allow('')
    }),

    // Send message validation
    sendMessage: Joi.object({
        content: Joi.string()
            .trim()
            .min(1)
            .max(1000)
            .required()
            .messages({
                'string.min': 'Message cannot be empty',
                'string.max': 'Message cannot exceed 1000 characters',
                'any.required': 'Message content is required'
            })
    }),

    // Create lost/found item validation
    createLostFoundItem: Joi.object({
        type: Joi.string()
            .valid('lost', 'found')
            .required()
            .messages({
                'any.only': 'Type must be either "lost" or "found"',
                'any.required': 'Type is required'
            }),

        title: Joi.string()
            .trim()
            .min(3)
            .max(255)
            .required()
            .messages({
                'string.min': 'Title must be at least 3 characters',
                'string.max': 'Title cannot exceed 255 characters',
                'any.required': 'Title is required'
            }),

        description: Joi.string()
            .trim()
            .min(10)
            .max(1000)
            .required(),

        category: Joi.string()
            .max(50)
            .allow(''),

        campus: Joi.string()
            .valid('main_campus', 'north_campus', 'south_campus', 'downtown')
            .required(),

        location: Joi.string()
            .trim()
            .max(255)
            .allow(''),

        date_lost_found: Joi.date()
            .max('now')
            .allow(null)
    }),

    // Create skill offer validation
    createSkillOffer: Joi.object({
        title: Joi.string()
            .trim()
            .min(3)
            .max(255)
            .required(),

        description: Joi.string()
            .trim()
            .min(10)
            .max(1000)
            .required(),

        category: Joi.string()
            .max(50)
            .allow(''),

        skill_type: Joi.string()
            .max(100)
            .allow(''),

        price: Joi.number()
            .min(0)
            .max(10000)
            .allow(null),

        is_free: Joi.boolean()
            .default(false),

        campus: Joi.string()
            .valid('main_campus', 'north_campus', 'south_campus', 'downtown')
            .required()
    }),

    // Toggle favorite validation
    toggleFavorite: Joi.object({
        listingId: Joi.string()
            .guid({ version: 'uuidv4' })
            .required()
            .messages({
                'string.guid': 'Invalid listing ID format',
                'any.required': 'Listing ID is required'
            })
    })
};

module.exports = marketplaceSchemas;