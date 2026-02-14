import { Router } from 'express';
import prisma from '../config/prisma';

const router = Router();

// GET /api/v1/promotions/active - Get active promotion for popup
router.get('/active', async (req, res) => {
  try {
    const today = new Date();

    const promotion = await prisma.promotion.findFirst({
      where: {
        isActive: true,
        OR: [
          // No date restrictions
          { startDate: null, endDate: null },
          // Within date range
          {
            startDate: { lte: today },
            endDate: { gte: today },
          },
          // Only start date set
          { startDate: { lte: today }, endDate: null },
          // Only end date set
          { startDate: null, endDate: { gte: today } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotion' });
  }
});

// GET /api/v1/promotions - Get all promotions (admin)
router.get('/', async (req, res) => {
  try {
    const promotions = await prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// GET /api/v1/promotions/:id - Get single promotion
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const promotion = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion not found' });
    }

    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch promotion' });
  }
});

// POST /api/v1/promotions - Create promotion (admin)
router.post('/', async (req, res) => {
  try {
    const { title, description, image, buttonText, buttonLink, isActive, startDate, endDate } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const promotion = await prisma.promotion.create({
      data: {
        title,
        description,
        image,
        buttonText,
        buttonLink,
        isActive: isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

// PUT /api/v1/promotions/:id - Update promotion (admin)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image, buttonText, buttonLink, isActive, startDate, endDate } = req.body;

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        title,
        description,
        image,
        buttonText,
        buttonLink,
        isActive,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });

    res.json(promotion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update promotion' });
  }
});

// DELETE /api/v1/promotions/:id - Delete promotion (admin)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.promotion.delete({
      where: { id },
    });

    res.json({ message: 'Promotion deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete promotion' });
  }
});

export default router;
