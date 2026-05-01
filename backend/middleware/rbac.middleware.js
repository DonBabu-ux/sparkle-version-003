const logger = require('../utils/logger');

/**
 * Role-Based Access Control Middleware
 * roles: 'system_admin' | 'data_analyst' | 'business_admin' | 'moderator' | 'user'
 */
const authorize = (allowedRoles = []) => {
    return (req, res, next) => {
        const user = req.user; // Assumes user is attached via auth middleware
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        // System Admin bypasses all checks
        if (user.role === 'system_admin') return next();

        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            logger.warn(`RBAC Violation: User ${user.user_id} (role: ${user.role}) attempted to access ${req.originalUrl}`);
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Insufficient permissions for this intelligence layer.' 
            });
        }

        next();
    };
};

module.exports = authorize;
