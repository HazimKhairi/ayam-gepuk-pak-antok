"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const router = (0, express_1.Router)();
// Get all reviews
router.get('/', async (req, res) => {
    try {
        const reviews = await prisma_1.default.review.findMany({
            orderBy: { createdAt: 'desc' },
        });
        res.json(reviews);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});
// Get featured reviews (for Home page)
router.get('/featured', async (req, res) => {
    try {
        const reviews = await prisma_1.default.review.findMany({
            where: { isFeatured: true },
            take: 3,
            orderBy: { createdAt: 'desc' },
        });
        res.json(reviews);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch featured reviews' });
    }
});
exports.default = router;
//# sourceMappingURL=reviews.js.map