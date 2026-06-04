const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
const protect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized, no token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        // Token invalidation: reject JWTs issued before the last password change/reset.
        if (req.user.passwordChangedAt && decoded.iat) {
            const changedAtSec = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
            if (decoded.iat < changedAtSec) {
                return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
            }
        }

        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
};

// Role-based access
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' is not authorized to access this route`
            });
        }
        next();
    };
};

// Resource ownership check (Phase 1): true if req.user owns `doc` (admins always pass).
// Use in routes to prevent IDOR, e.g.:
//   if (!isOwner(analysis, req)) return res.status(403).json({ success: false, message: 'Not authorized' });
const isOwner = (doc, req, ownerField = 'user') => {
    if (!doc || !req.user) return false;
    if (req.user.role === 'admin') return true;
    const owner = doc[ownerField];
    if (!owner) return false;
    // owner may be an ObjectId or a populated doc with _id
    const ownerId = owner._id || owner;
    return typeof ownerId.equals === 'function'
        ? ownerId.equals(req.user._id)
        : String(ownerId) === String(req.user._id);
};

module.exports = { protect, authorize, isOwner };
