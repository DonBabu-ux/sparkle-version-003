const { validationResult } = require('express-validator');

/**
 * Express-validator based validation middleware
 */
const validate = (validations, validationSource = 'body') => {
    return async (req, res, next) => {
        try {
            // Check if it's an array of validations (express-validator style)
            if (Array.isArray(validations)) {
                await Promise.all(validations.map(validation => validation.run(req)));

                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({
                        success: false,
                        errors: errors.array()
                    });
                }
                return next();
            }

            // If it's a single validation schema
            if (typeof validations === 'function') {
                return validations(req, res, next);
            }

            // Joi-style validation
            const value = await validations.validateAsync(req[validationSource], {
                abortEarly: false,
                stripUnknown: true
            });

            // If validation fails, Joi throws an error which is caught by the catch block below

            // Replace with validated data
            req[validationSource] = value;
            next();

        } catch (error) {
            console.error('Validation error:', error);

            // Handle Joi validation errors
            if (error.isJoi) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.details.map(detail => ({
                        field: detail.path.join('.'),
                        message: detail.message
                    }))
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message || 'Validation failed'
            });
        }
    };
};

module.exports = {
    validate
};