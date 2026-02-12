import { Router } from 'express';
import prisma from '../config/prisma';

const router = Router();

// GET /api/v1/menu
// Get all menu items
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category as string;
    }

    const menuItems = await prisma.menuItem.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET /api/v1/menu/all (Admin - get all including inactive)
router.get('/all', async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching all menu items:', error);
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
    console.error('Error fetching featured items:', error);
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
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// POST /api/v1/menu (Admin - create menu item)
router.post('/', async (req, res) => {
  try {
    const { name, description, price, category, image, ingredients, isActive, isFeatured } = req.body;

    const menuItem = await prisma.menuItem.create({
      data: {
        name,
        description,
        price,
        category,
        image: image || '',
        ingredients: ingredients || '',
        isActive: isActive !== undefined ? isActive : true,
        isFeatured: isFeatured || false,
      },
    });

    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// PUT /api/v1/menu/:id (Admin - update menu item)
router.put('/:id', async (req, res) => {
  try {
    const { name, description, price, category, image, ingredients, isActive, isFeatured } = req.body;

    const menuItem = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(category && { category }),
        ...(image !== undefined && { image }),
        ...(ingredients !== undefined && { ingredients }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
      },
    });

    res.json(menuItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
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
    console.error('Error deleting menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

export default router;

