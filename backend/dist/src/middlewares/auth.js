"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAdminToken = generateAdminToken;
exports.generateCustomerToken = generateCustomerToken;
exports.requireAdmin = requireAdmin;
exports.requireMaster = requireMaster;
exports.optionalCustomerAuth = optionalCustomerAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../config/prisma"));
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-to-a-random-string';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
/**
 * Generate a JWT token for admin
 */
function generateAdminToken(admin) {
    return jsonwebtoken_1.default.sign({ id: admin.id, email: admin.email, role: admin.role, type: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
/**
 * Generate a JWT token for customer
 */
function generateCustomerToken(customer) {
    return jsonwebtoken_1.default.sign({ id: customer.id, email: customer.email, type: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
}
/**
 * Middleware: Require admin authentication
 */
async function requireAdmin(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded.type !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        const admin = await prisma_1.default.admin.findUnique({
            where: { id: decoded.id },
        });
        if (!admin || !admin.isActive) {
            return res.status(401).json({ error: 'Invalid or inactive admin account' });
        }
        req.admin = {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            outletId: admin.outletId,
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired, please login again' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}
/**
 * Middleware: Require MASTER admin role
 */
async function requireMaster(req, res, next) {
    if (!req.admin) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.admin.role !== 'MASTER') {
        return res.status(403).json({ error: 'Master admin access required' });
    }
    next();
}
/**
 * Middleware: Optional customer authentication (populates req.customer if token present)
 */
async function optionalCustomerAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        if (decoded.type !== 'customer') {
            return next();
        }
        const customer = await prisma_1.default.customer.findUnique({
            where: { id: decoded.id },
        });
        if (customer) {
            req.customer = {
                id: customer.id,
                email: customer.email,
                name: customer.name,
                phone: customer.phone,
            };
        }
    }
    catch {
        // Token invalid/expired — just continue without auth
    }
    next();
}
//# sourceMappingURL=auth.js.map