const Joi = require('joi');

const signupSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    campus: Joi.string().optional(),
    major: Joi.string().optional(),
    year: Joi.string().optional()
});

const loginSchema = Joi.object({
    username: Joi.string().required(), // Can be username or email
    password: Joi.string().required()
});

module.exports = {
    signupSchema,
    loginSchema
};
