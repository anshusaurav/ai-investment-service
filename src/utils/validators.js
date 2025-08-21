const Joi = require('joi');

const schemas = {
    verifyToken: Joi.object({
        idToken: Joi.string().required().min(1).max(4096)
    }),

    googleSignIn: Joi.object({
        idToken: Joi.string().required().min(1).max(4096)
    }),

    googleSignUp: Joi.object({
        idToken: Joi.string().required().min(1).max(4096)
    }),

    refreshToken: Joi.object({
        refreshToken: Joi.string().required().min(1).max(4096)
    }),

    userProfile: Joi.object({
        idToken: Joi.string().required().min(1).max(4096)
    }),

    followCompany: Joi.object({
        companyCode: Joi.string().required().min(1).max(50).pattern(/^[A-Z0-9_-]+$/)
    }),

    unfollowCompany: Joi.object({
        companyCode: Joi.string().required().min(1).max(50).pattern(/^[A-Z0-9_-]+$/)
    })
};

const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.details.map(detail => detail.message)
            });
        }
        next();
    };
};

module.exports = {
    schemas,
    validate
};