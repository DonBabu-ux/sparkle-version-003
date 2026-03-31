const Joi = require('joi');

const signupSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    username: Joi.string().pattern(/^[a-zA-Z0-9._]+$/).min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    campus: Joi.string().allow('', null).optional(),
    major: Joi.string().allow('', null).optional(),
    year: Joi.string().allow('', null).optional(),
    phone_number: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).allow('', null).optional() // E.164 format
});

const loginSchema = Joi.object({
    username: Joi.string().required(), // Can be username or email
    password: Joi.string().required()
});

module.exports = {
    signupSchema,
    loginSchema
};
