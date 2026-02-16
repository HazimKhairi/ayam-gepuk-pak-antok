"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const redis_1 = require("../config/redis");
const router = (0, express_1.Router)();
// GET /api/v1/menu
// Get all menu items (CACHED)
router.get('/', async (req, res) => {
    try {
        const { category, categoryId } = req.query;
        // Create cache key based on query params
        const cacheKey = `menu:${categoryId || category || 'all'}`;
        // Try cache first
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        // Cache miss - fetch from database
        const where = {
            isActive: true,
        };
        // Support filtering by category slug (backward compatible) or categoryId
        if (categoryId) {
            where.categoryId = categoryId;
        }
        else if (category) {
            // Find category by slug for backward compatibility
            const categoryRecord = await prisma_1.default.category.findUnique({
                where: { slug: category },
            });
            if (categoryRecord) {
                where.categoryId = categoryRecord.id;
            }
        }
        const menuItems = await prisma_1.default.menuItem.findMany({
            where,
            include: {
                category: true, // Include category details
            },
            orderBy: {
                name: 'asc',
            },
        });
        // Store in cache for 5 minutes
        await redis_1.cache.set(cacheKey, menuItems, 300);
        res.json(menuItems);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
});
// GET /api/v1/menu/all (Admin - get all including inactive)
router.get('/all', async (req, res) => {
    try {
        const menuItems = await prisma_1.default.menuItem.findMany({
            include: {
                category: true, // Include category details
            },
            orderBy: {
                name: 'asc',
            },
        });
        res.json(menuItems);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu items' });
    }
});
// GET /api/v1/menu/featured
// Get featured menu items (CACHED)
router.get('/featured', async (req, res) => {
    try {
        const cacheKey = 'menu:featured';
        // Try cache first
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        // Cache miss - fetch from database
        const featuredItems = await prisma_1.default.menuItem.findMany({
            where: {
                isActive: true,
                isFeatured: true,
            },
            take: 3,
        });
        // Store in cache for 10 minutes
        await redis_1.cache.set(cacheKey, featuredItems, 600);
        res.json(featuredItems);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch featured items' });
    }
});
// GET /api/v1/menu/:id
// Get single menu item
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const menuItem = await prisma_1.default.menuItem.findUnique({
            where: { id },
        });
        if (!menuItem) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json(menuItem);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch menu item' });
    }
});
// POST /api/v1/menu (Admin - create menu item)
router.post('/', async (req, res) => {
    try {
        const { name, description, price, categoryId, image, ingredients, isActive, isFeatured } = req.body;
        if (!categoryId) {
            return res.status(400).json({ error: 'Category ID is required' });
        }
        const menuItem = await prisma_1.default.menuItem.create({
            data: {
                name,
                description,
                price,
                categoryId,
                image: image || '',
                ingredients: ingredients || '',
                isActive: isActive !== undefined ? isActive : true,
                isFeatured: isFeatured || false,
            },
            include: {
                category: true,
            },
        });
        // Invalidate menu caches
        await redis_1.cache.clear('menu:*');
        res.status(201).json(menuItem);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create menu item' });
    }
});
// PUT /api/v1/menu/:id (Admin - update menu item)
router.put('/:id', async (req, res) => {
    try {
        const { name, description, price, categoryId, image, ingredients, isActive, isFeatured } = req.body;
        const menuItem = await prisma_1.default.menuItem.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(price !== undefined && { price }),
                ...(categoryId && { categoryId }),
                ...(image !== undefined && { image }),
                ...(ingredients !== undefined && { ingredients }),
                ...(isActive !== undefined && { isActive }),
                ...(isFeatured !== undefined && { isFeatured }),
            },
            include: {
                category: true,
            },
        });
        // Invalidate menu caches
        await redis_1.cache.clear('menu:*');
        res.json(menuItem);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update menu item' });
    }
});
// DELETE /api/v1/menu/:id (Admin - delete menu item)
router.delete('/:id', async (req, res) => {
    try {
        await prisma_1.default.menuItem.delete({
            where: { id: req.params.id },
        });
        // Invalidate menu caches
        await redis_1.cache.clear('menu:*');
        res.json({ message: 'Menu item deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete menu item' });
    }
});
exports.default = router;
//# sourceMappingURL=menu.js.map