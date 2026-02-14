import { Router } from 'express';
import prisma from '../config/prisma';

const router = Router();

// GET /api/v1/menu
// Get all menu items
router.get('/', async (req, res) => {
  try {
    const { category, categoryId } = req.query;

    const where: any = {
      isActive: true,
    };

    // Support filtering by category slug (backward compatible) or categoryId
    if (categoryId) {
      where.categoryId = categoryId as string;
    } else if (category) {
      // Find category by slug for backward compatibility
      const categoryRecord = await prisma.category.findUnique({
        where: { slug: category as string },
      });
      if (categoryRecord) {
        where.categoryId = categoryRecord.id;
      }
    }

    const menuItems = await prisma.menuItem.findMany({
      where,
      include: {
        category: true, // Include category details
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET /api/v1/menu/all (Admin - get all including inactive)
router.get('/all', async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      include: {
        category: true, // Include category details
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET /api/v1/menu/featured
// Get featured menu items
router.get('/featured', async (req, res) => {
  try {
    const featuredItems = await prisma.menuItem.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      take: 3,
    });

    res.json(featuredItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured items' });
  }
});

// GET /api/v1/menu/:id
// Get single menu item
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const menuItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(menuItem);
  } catch (error) {
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

    const menuItem = await prisma.menuItem.create({
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

    res.status(201).json(menuItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// PUT /api/v1/menu/:id (Admin - update menu item)
router.put('/:id', async (req, res) => {
  try {
    const { name, description, price, categoryId, image, ingredients, isActive, isFeatured } = req.body;

    const menuItem = await prisma.menuItem.update({
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

    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// DELETE /api/v1/menu/:id (Admin - delete menu item)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.menuItem.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

export default router;

