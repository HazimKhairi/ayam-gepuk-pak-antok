"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// Register new customer
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        // Validate required fields
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        // Check if customer already exists
        const existingCustomer = await prisma.customer.findUnique({
            where: { email },
        });
        if (existingCustomer) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create customer
        const customer = await prisma.customer.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
            },
        });
        // Return user without password
        res.status(201).json({
            success: true,
            user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            },
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register' });
    }
});
// Login customer
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Find customer
        const customer = await prisma.customer.findUnique({
            where: { email },
        });
        if (!customer) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, customer.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        // Return user without password
        res.json({
            success: true,
            user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map