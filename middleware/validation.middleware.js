const Joi = require('joi');

const validate = (schema, property = 'body') => {
    const middleware = (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        // Replace request data with validated data
        req[property] = value;
        next();
    };

    // Attach schema to the middleware function for introspection
    middleware.schema = schema;
    middleware.property = property;

    return middleware;
};

module.exports = { validate };
