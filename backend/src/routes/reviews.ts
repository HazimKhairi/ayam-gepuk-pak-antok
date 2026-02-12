import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

const router = Router();

// Get all reviews
router.get('/', async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get featured reviews (for Home page)
router.get('/featured', async (req: Request, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { isFeatured: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured reviews' });
  }
});

export default router;
