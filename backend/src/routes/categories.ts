import { Router } from 'express';
import { prisma } from '../config/prisma';

const router = Router();

// GET /api/v1/categories - Get all categories (public)
router.get('/', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/v1/categories/all - Get all categories including inactive (admin only)
router.get('/all', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching all categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/v1/categories - Create new category (admin only)
router.post('/', async (req, res) => {
  try {
    const { name, slug, displayOrder, isActive } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    // Check if slug already exists
    const existing = await prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Category with this slug already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        displayOrder: displayOrder !== undefined ? displayOrder : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/v1/categories/:id - Update category (admin only)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, displayOrder, isActive } = req.body;

    // Check if category exists
    const existing = await prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // If slug is being changed, check for duplicates
    if (slug && slug !== existing.slug) {
      const duplicate = await prisma.category.findUnique({
        where: { slug },
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Category with this slug already exists' });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(slug !== undefined && { slug }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/v1/categories/:id - Delete category (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { menuItems: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check if category has menu items
    if (existing._count.menuItems > 0) {
      return res.status(400).json({
        error: `Cannot delete category with ${existing._count.menuItems} menu items. Please reassign or delete the items first.`,
      });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
