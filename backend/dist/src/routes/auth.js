"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Password strength validation
function validatePassword(password) {
    const errors = [];
    if (password.length < 8)
        errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password))
        errors.push('Password must contain an uppercase letter');
    if (!/[a-z]/.test(password))
        errors.push('Password must contain a lowercase letter');
    if (!/[0-9]/.test(password))
        errors.push('Password must contain a number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
        errors.push('Password must contain a special character');
    return { valid: errors.length === 0, errors };
}
// Check email availability
router.get('/check-email', async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const existing = await prisma_1.default.customer.findUnique({ where: { email } });
        res.json({ available: !existing });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check email' });
    }
});
// Check phone availability
router.get('/check-phone', async (req, res) => {
    try {
        const phone = req.query.phone;
        if (!phone) {
            return res.status(400).json({ error: 'Phone is required' });
        }
        const existing = await prisma_1.default.customer.findUnique({ where: { phone } });
        res.json({ available: !existing });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to check phone' });
    }
});
// Register new customer
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ error: passwordCheck.errors[0] });
        }
        const existingEmail = await prisma_1.default.customer.findUnique({ where: { email } });
        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const existingPhone = await prisma_1.default.customer.findUnique({ where: { phone } });
        if (existingPhone) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const customer = await prisma_1.default.customer.create({
            data: { name, email, phone, password: hashedPassword },
        });
        const token = (0, auth_1.generateCustomerToken)(customer);
        res.status(201).json({
            success: true,
            token,
            user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to register' });
    }
});
// Login customer
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const customer = await prisma_1.default.customer.findUnique({ where: { email } });
        if (!customer) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, customer.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = (0, auth_1.generateCustomerToken)(customer);
        res.json({
            success: true,
            token,
            user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
});
// Admin login — validates against database
router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const admin = await prisma_1.default.admin.findUnique({ where: { email } });
        if (!admin || !admin.isActive) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = (0, auth_1.generateAdminToken)(admin);
        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                outletId: admin.outletId,
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to login' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map