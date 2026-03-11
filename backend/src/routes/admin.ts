import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { requireAdmin } from '../middlewares/auth';
import { cache } from '../config/redis';
import { getSettlementData, syncSettlementData } from '../utils/settlementSync';

const router = Router();

// All admin routes require authentication
router.use(requireAdmin);

// GET /api/v1/admin/dashboard - Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const { outletId, startDate, endDate, recentOrdersPage, recentOrdersLimit, recentOrdersSortBy } = req.query;

    // Show only paid orders
    const where: any = {
      ...(outletId && { outletId: outletId as string }),
    };

    // Add date filter if provided
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      where.bookingDate = {
        gte: start,
        lte: end,
      };
    }

    // Base filter for paid orders only
    const paidOrdersWhere = {
      ...where,
      payment: {
        is: {
          status: 'SUCCESS'
        }
      }
    };

    // Get order counts - only count successfully paid orders
    const [totalOrders, pendingOrders, completedOrders] = await Promise.all([
      prisma.order.count({ where: paidOrdersWhere }),
      prisma.order.count({ where: { ...paidOrdersWhere, status: 'PENDING' } }),
      prisma.order.count({ where: { ...paidOrdersWhere, status: 'COMPLETED' } }),
    ]);

    // Get total sales - only count successfully paid orders
    const salesData = await prisma.order.aggregate({
      where: { ...paidOrdersWhere, status: 'COMPLETED' },
      _sum: { total: true },
    });

    // Get orders by fulfillment type - only count successfully paid orders
    const ordersByType = await prisma.order.groupBy({
      by: ['fulfillmentType'],
      where: { ...paidOrdersWhere, status: 'COMPLETED' },
      _count: true,
    });

    // Pagination & sorting for recent orders
    const roPage = Math.max(1, parseInt(recentOrdersPage as string) || 1);
    const roLimit = Math.min(50, Math.max(5, parseInt(recentOrdersLimit as string) || 10));
    const roSkip = (roPage - 1) * roLimit;

    const sortByMap: Record<string, any> = {
      date_desc:   { createdAt: 'desc' },
      date_asc:    { createdAt: 'asc' },
      total_desc:  { total: 'desc' },
      total_asc:   { total: 'asc' },
      status:      { status: 'asc' },
    };
    const roOrderBy = sortByMap[(recentOrdersSortBy as string) || 'date_desc'] ?? { createdAt: 'desc' };

    const recentOrdersWhere = {
      ...where,
      payment: { is: { status: 'SUCCESS' } },
    };

    const [recentOrders, recentOrdersTotal] = await Promise.all([
      prisma.order.findMany({
        where: recentOrdersWhere,
        orderBy: roOrderBy,
        skip: roSkip,
        take: roLimit,
        include: {
          outlet: true,
          table: true,
          timeSlot: true,
          payment: true,
        },
      }),
      prisma.order.count({ where: recentOrdersWhere }),
    ]);

    // Get settlement data (memory cache → DB fallback)
    const settlement = await getSettlementData();

    res.json({
      stats: {
        totalOrders,
        pendingOrders,
        completedOrders,
        // Subtract RM 1.00 ToyyibPay fee per transaction for net revenue
        totalSales: Number(salesData._sum.total || 0) - completedOrders,
      },
      settlement: settlement || null,
      ordersByType: ordersByType.reduce((acc, curr) => {
        acc[curr.fulfillmentType] = curr._count;
        return acc;
      }, {} as Record<string, number>),
      recentOrders,
      recentOrdersTotal,
      recentOrdersPage: roPage,
      recentOrdersLimit: roLimit,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET /api/v1/admin/sales - Get sales report
router.get('/sales', async (req, res) => {
  try {
    const { outletId, startDate, endDate, groupBy = 'month' } = req.query;

    const where: any = {};

    if (outletId) where.outletId = outletId;
    if (startDate && endDate) {
      // Set start date to beginning of day
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);

      // Set end date to end of day (23:59:59.999)
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      where.bookingDate = {
        gte: start,
        lte: end,
      };
    }

    // Get sales orders - only count orders with successful payment
    const orders = await prisma.order.findMany({
      where: {
        ...where,
        payment: {
          is: {
            status: 'SUCCESS'
          }
        }
      },
      include: { outlet: true, payment: true },
      orderBy: { bookingDate: 'asc' },
    });

    // Group by date or month based on groupBy parameter
    const salesByPeriod = orders.reduce((acc, order) => {
      let period: string;
      if (groupBy === 'month') {
        // Format as "YYYY-MM" for grouping, but store full date for display
        const date = new Date(order.bookingDate);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        period = `${year}-${month}`;
      } else {
        // Daily grouping
        period = order.bookingDate.toISOString().split('T')[0];
      }

      if (!acc[period]) {
        acc[period] = { period, total: 0, count: 0 };
      }
      // Subtract RM 1.00 ToyyibPay fee per transaction to show net revenue
      acc[period].total += Number(order.total) - 1;
      acc[period].count += 1;
      return acc;
    }, {} as Record<string, { period: string; total: number; count: number }>);

    // Sales by outlet
    const salesByOutlet = orders.reduce((acc, order) => {
      const outletName = order.outlet.name;
      if (!acc[outletName]) {
        acc[outletName] = { outlet: outletName, total: 0, count: 0 };
      }
      // Subtract RM 1.00 ToyyibPay fee per transaction to show net revenue
      acc[outletName].total += Number(order.total) - 1;
      acc[outletName].count += 1;
      return acc;
    }, {} as Record<string, { outlet: string; total: number; count: number }>);

    res.json({
      salesByPeriod: Object.values(salesByPeriod),
      salesByOutlet: Object.values(salesByOutlet),
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total) - 1, 0),
      totalOrders: orders.length,
      groupBy: groupBy as string,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/v1/admin/orders - Get all orders
router.get('/orders', async (req, res) => {
  try {
    const { outletId, status, fulfillmentType, page = '1', limit = '20', paymentStatus, startDate, endDate, search } = req.query;

    const where: any = {};
    if (outletId) where.outletId = outletId;
    if (status) where.status = status;
    if (fulfillmentType) where.fulfillmentType = fulfillmentType;
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      where.bookingDate = { gte: start, lte: end };
    }

    // Search functionality - search by order number, customer name, phone, or email
    if (search && typeof search === 'string') {
      const searchTerm = search.trim();
      where.OR = [
        { orderNo: { contains: searchTerm } },
        { customerName: { contains: searchTerm } },
        { customerPhone: { contains: searchTerm } },
        { customerEmail: { contains: searchTerm } },
      ];
    }

    // Filter by payment status
    if (paymentStatus) {
      where.payment = { is: { status: paymentStatus } };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Build base where without paymentStatus for counting
    const baseWhere = { ...where };
    delete baseWhere.payment;

    const [orders, total, successCount, failedCount, pendingCount] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: {
          outlet: true,
          table: true,
          timeSlot: true,
          payment: true,
        },
      }),
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...baseWhere, payment: { is: { status: 'SUCCESS' } } } }),
      prisma.order.count({ where: { ...baseWhere, payment: { is: { status: 'FAILED' } } } }),
      prisma.order.count({ where: { ...baseWhere, payment: { is: { status: 'PENDING' } } } }),
    ]);

    // Enrich orderItems with menu item images
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        if (order.orderItems && Array.isArray(order.orderItems)) {
          const menuItemNames = order.orderItems
            .map((item: any) => item.menuItemName)
            .filter((name): name is string => name !== undefined && name !== null);

          // Only fetch if we have valid menu item names
          const menuItems = menuItemNames.length > 0 ? await prisma.menuItem.findMany({
            where: {
              name: { in: menuItemNames },
            },
            select: {
              name: true,
              image: true,
            },
          }) : [];

          // Create a map for quick lookup
          const menuItemMap = new Map(menuItems.map((item) => [item.name, item.image]));

          // Add image to each order item
          const enrichedItems = order.orderItems.map((item: any) => ({
            ...item,
            menuItemImage: menuItemMap.get(item.menuItemName) || '',
          }));

          return {
            ...order,
            orderItems: enrichedItems,
          };
        }
        return order;
      })
    );

    res.json({
      orders: enrichedOrders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
      paymentCounts: {
        successful: successCount,
        unsuccessful: failedCount,
        pending: pendingCount,
      },
    });
  } catch (error) {
    console.error('❌ Orders endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// PUT /api/v1/admin/orders/:id/status - Update order status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    // Block setting COMPLETED if payment is not SUCCESS
    if (status === 'COMPLETED') {
      const existing = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { payment: true },
      });
      if (existing?.payment?.status !== 'SUCCESS') {
        return res.status(400).json({
          error: 'Cannot mark as Completed — payment has not been received yet. Payment status: ' + (existing?.payment?.status || 'N/A')
        });
      }
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        outlet: true,
        table: true,
        timeSlot: true,
        payment: true,
      },
    });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// PUT /api/v1/admin/orders/:id/items - Update order items
router.put('/orders/:id/items', async (req, res) => {
  try {
    const { orderItems } = req.body;

    // Validate orderItems is an array
    if (!Array.isArray(orderItems)) {
      return res.status(400).json({ error: 'orderItems must be an array' });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { orderItems: JSON.stringify(orderItems) },
      include: {
        outlet: true,
        table: true,
        timeSlot: true,
        payment: true,
      },
    });

    res.json(order);
  } catch (error) {
    console.error('Failed to update order items:', error);
    res.status(500).json({ error: 'Failed to update order items' });
  }
});

// GET /api/v1/admin/outlets - Get all outlets for admin
router.get('/outlets', async (req, res) => {
  try {
    const { page = '1', limit = '10' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [outlets, total] = await Promise.all([
      prisma.outlet.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit as string),
        include: {
          _count: {
            select: {
              tables: true,
              timeSlots: true,
              orders: true,
            },
          },
        },
      }),
      prisma.outlet.count(),
    ]);

    res.json({
      outlets,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch outlets' });
  }
});

// POST /api/v1/admin/outlets - Create a new outlet
router.post('/outlets', async (req: Request, res: Response) => {
  try {
    const { name, address, phone, googleMapsUrl, openTime, closeTime, dineInOpenTime, dineInCloseTime, takeawayOpenTime, takeawayCloseTime, deliveryFee, maxCapacity, maxTakeawayOrders, deliveryEnabled, isActive } = req.body;

    // Validate required fields
    if (!name || !address || !phone) {
      return res.status(400).json({ error: 'Name, address, and phone are required' });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (dineInOpenTime && !timeRegex.test(dineInOpenTime)) {
      return res.status(400).json({ error: 'Invalid dineInOpenTime format. Use HH:MM' });
    }
    if (dineInCloseTime && !timeRegex.test(dineInCloseTime)) {
      return res.status(400).json({ error: 'Invalid dineInCloseTime format. Use HH:MM' });
    }
    if (takeawayOpenTime && !timeRegex.test(takeawayOpenTime)) {
      return res.status(400).json({ error: 'Invalid takeawayOpenTime format. Use HH:MM' });
    }
    if (takeawayCloseTime && !timeRegex.test(takeawayCloseTime)) {
      return res.status(400).json({ error: 'Invalid takeawayCloseTime format. Use HH:MM' });
    }

    // Create outlet with defaults
    const outlet = await prisma.outlet.create({
      data: {
        name,
        address,
        phone,
        googleMapsUrl: googleMapsUrl || '',
        openTime: openTime || '10:00',
        closeTime: closeTime || '22:00',
        dineInOpenTime: dineInOpenTime || '17:00',
        dineInCloseTime: dineInCloseTime || '23:00',
        takeawayOpenTime: takeawayOpenTime || '19:00',
        takeawayCloseTime: takeawayCloseTime || '23:00',
        deliveryFee: deliveryFee ?? 0,
        maxCapacity: maxCapacity ?? 50,
        maxTakeawayOrders: maxTakeawayOrders ?? 30,
        deliveryEnabled: deliveryEnabled ?? false,
        isActive: isActive ?? true,
      },
      include: {
        _count: {
          select: {
            tables: true,
            timeSlots: true,
            orders: true,
          },
        },
      },
    });

    res.status(201).json(outlet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create outlet' });
  }
});

// PUT /api/v1/admin/outlets/:id - Update an outlet
router.put('/outlets/:id', async (req: Request, res: Response) => {
  try {
    const { name, address, phone, googleMapsUrl, openTime, closeTime, dineInOpenTime, dineInCloseTime, takeawayOpenTime, takeawayCloseTime, deliveryFee, maxCapacity, maxTakeawayOrders, deliveryEnabled, isActive } = req.body;

    // Validate time format if provided
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (dineInOpenTime && !timeRegex.test(dineInOpenTime)) {
      return res.status(400).json({ error: 'Invalid dineInOpenTime format. Use HH:MM' });
    }
    if (dineInCloseTime && !timeRegex.test(dineInCloseTime)) {
      return res.status(400).json({ error: 'Invalid dineInCloseTime format. Use HH:MM' });
    }
    if (takeawayOpenTime && !timeRegex.test(takeawayOpenTime)) {
      return res.status(400).json({ error: 'Invalid takeawayOpenTime format. Use HH:MM' });
    }
    if (takeawayCloseTime && !timeRegex.test(takeawayCloseTime)) {
      return res.status(400).json({ error: 'Invalid takeawayCloseTime format. Use HH:MM' });
    }

    // Check if outlet exists
    const existingOutlet = await prisma.outlet.findUnique({
      where: { id: req.params.id },
    });

    if (!existingOutlet) {
      return res.status(404).json({ error: 'Outlet not found' });
    }

    const outlet = await prisma.outlet.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(phone && { phone }),
        ...(googleMapsUrl !== undefined && { googleMapsUrl }),
        ...(openTime && { openTime }),
        ...(closeTime && { closeTime }),
        ...(dineInOpenTime && { dineInOpenTime }),
        ...(dineInCloseTime && { dineInCloseTime }),
        ...(takeawayOpenTime && { takeawayOpenTime }),
        ...(takeawayCloseTime && { takeawayCloseTime }),
        ...(deliveryFee !== undefined && { deliveryFee }),
        ...(maxCapacity !== undefined && { maxCapacity }),
        ...(maxTakeawayOrders !== undefined && { maxTakeawayOrders }),
        ...(deliveryEnabled !== undefined && { deliveryEnabled }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: {
            tables: true,
            timeSlots: true,
            orders: true,
          },
        },
      },
    });

    res.json(outlet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update outlet' });
  }
});

// DELETE /api/v1/admin/outlets/:id - Delete an outlet
router.delete('/outlets/:id', async (req: Request, res: Response) => {
  try {
    // Block deletion if there are any non-cancelled orders
    const activeOrderCount = await prisma.order.count({
      where: {
        outletId: req.params.id,
        status: { not: 'CANCELLED' },
      },
    });

    if (activeOrderCount > 0) {
      return res.status(400).json({
        error: `Cannot delete outlet with ${activeOrderCount} active order(s). Cancel all orders first or deactivate the outlet instead.`,
      });
    }

    // Delete the outlet (tables and timeSlots cascade automatically)
    await prisma.outlet.delete({
      where: { id: req.params.id },
    });

    // Invalidate outlet caches
    await cache.del(`outlets:${req.params.id}`);
    await cache.del('outlets:all');

    res.json({ message: 'Outlet deleted successfully' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Outlet not found' });
    }
    res.status(500).json({ error: 'Failed to delete outlet' });
  }
});

// GET /api/v1/admin/tables/:outletId - Get all tables for an outlet (admin view)
router.get('/tables/:outletId', async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      where: { outletId: req.params.outletId },
      orderBy: [{ zone: 'asc' }, { tableNo: 'asc' }],
    });

    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// POST /api/v1/admin/tables - Create a new table
router.post('/tables', async (req, res) => {
  try {
    const { outletId, tableNo, capacity, zone } = req.body;

    // Check if table number already exists for this outlet
    const existingTable = await prisma.table.findUnique({
      where: { outletId_tableNo: { outletId, tableNo } },
    });

    if (existingTable) {
      return res.status(400).json({ error: 'Table number already exists for this outlet' });
    }

    const table = await prisma.table.create({
      data: {
        outletId,
        tableNo,
        capacity: capacity || 4,
        zone: zone || 'Regular',
      },
    });

    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/v1/admin/tables/:id - Update table configuration
router.put('/tables/:id', async (req, res) => {
  try {
    const { tableNo, capacity, zone, status } = req.body;

    const table = await prisma.table.update({
      where: { id: req.params.id },
      data: {
        ...(tableNo && { tableNo }),
        ...(capacity !== undefined && { capacity }),
        ...(zone && { zone }),
        ...(status && { status }),
      },
    });

    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// DELETE /api/v1/admin/tables/:id - Delete a table
router.delete('/tables/:id', async (req, res) => {
  try {
    // Check if table has any active bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = await prisma.order.count({
      where: {
        tableId: req.params.id,
        bookingDate: { gte: today },
        status: { in: ['PENDING'] },
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ error: 'Cannot delete table with active bookings' });
    }

    await prisma.table.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true, message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// GET /api/v1/admin/outlets/:outletId/slots - Get ALL slots (including inactive) for admin
router.get('/outlets/:outletId/slots', async (req, res) => {
  try {
    const slots = await prisma.timeSlot.findMany({
      where: { outletId: req.params.outletId },
      orderBy: { time: 'asc' },
    });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
});

// PUT /api/v1/admin/slots/:id - Update time slot configuration
router.put('/slots/:id', async (req, res) => {
  try {
    const {
      time,
      maxOrders,
      isActive, // DEPRECATED: kept for backward compatibility
      isActiveForDineIn,
      isActiveForTakeaway,
      isActiveForDelivery,
    } = req.body;

    const slot = await prisma.timeSlot.update({
      where: { id: req.params.id },
      data: {
        ...(time && { time }),
        ...(maxOrders !== undefined && { maxOrders }),
        // Support new separate active flags
        ...(isActiveForDineIn !== undefined && { isActiveForDineIn }),
        ...(isActiveForTakeaway !== undefined && { isActiveForTakeaway }),
        ...(isActiveForDelivery !== undefined && { isActiveForDelivery }),
        // Backward compatibility: if old isActive is sent, update all flags
        ...(isActive !== undefined && {
          isActive,
          isActiveForDineIn: isActive,
          isActiveForTakeaway: isActive,
          isActiveForDelivery: isActive,
        }),
      },
    });

    res.json(slot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update time slot' });
  }
});

// Create time slot
router.post('/slots', async (req: Request, res: Response) => {
  try {
    const {
      outletId,
      time,
      maxOrders,
      isActive, // DEPRECATED: kept for backward compatibility
      isActiveForDineIn,
      isActiveForTakeaway,
      isActiveForDelivery,
    } = req.body;

    // Validate required fields
    if (!outletId || !time) {
      return res.status(400).json({ error: 'Outlet ID and time are required' });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM format' });
    }

    // Verify outlet exists
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
    });

    if (!outlet) {
      return res.status(404).json({ error: 'Outlet not found' });
    }

    // Check for duplicate time slot
    const existingSlot = await prisma.timeSlot.findUnique({
      where: {
        outletId_time: {
          outletId,
          time,
        },
      },
    });

    if (existingSlot) {
      return res.status(400).json({ error: 'Time slot already exists for this outlet' });
    }

    // Create time slot with defaults
    // If old isActive is provided, use it for all types; otherwise use individual flags
    const activeDefault = isActive ?? true;
    const slot = await prisma.timeSlot.create({
      data: {
        outletId,
        time,
        maxOrders: maxOrders ?? 10,
        isActive: activeDefault, // DEPRECATED: kept for backward compatibility
        isActiveForDineIn: isActiveForDineIn ?? activeDefault,
        isActiveForTakeaway: isActiveForTakeaway ?? activeDefault,
        isActiveForDelivery: isActiveForDelivery ?? activeDefault,
      },
    });

    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create time slot' });
  }
});

// Delete time slot
router.delete('/slots/:id', async (req: Request, res: Response) => {
  try {
    // Check if slot exists
    const slot = await prisma.timeSlot.findUnique({
      where: { id: req.params.id },
    });

    if (!slot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }

    // Check for active bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeBookings = await prisma.order.count({
      where: {
        timeSlotId: req.params.id,
        status: { in: ['PENDING'] },
        bookingDate: { gte: today }, // Today or future
      },
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        error: `Cannot delete time slot with ${activeBookings} active booking(s)`,
      });
    }

    // Delete the time slot
    await prisma.timeSlot.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Time slot deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
});

// POST /api/v1/admin/payments/verify-all - Bulk verify all pending/cancelled payments with actual payment
router.post('/payments/verify-all', async (req, res) => {
  try {
    // Import getBillTransactions dynamically to avoid circular dependency
    const { getBillTransactions } = await import('../utils/toyyibpay');

    // Only check PENDING orders — cancelled/failed orders are final
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ordersToCheck = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        payment: {
          status: 'PENDING',
        },
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      include: {
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`🔍 Bulk verify: Found ${ordersToCheck.length} orders to check (PENDING or CANCELLED)`);

    const results = {
      checked: ordersToCheck.length,
      updated: [] as any[],
      stillPending: [] as any[],
      failed: [] as any[]
    };

    // Verify each order
    for (const order of ordersToCheck) {
      try {
        if (!order.payment?.billCode) {
          results.failed.push({
            orderNo: order.orderNo,
            customerName: order.customerName,
            reason: 'No bill code'
          });
          continue;
        }

        // Get transaction status from ToyyibPay
        const txResponse = await getBillTransactions(order.payment.billCode);

        if (!txResponse.success || !txResponse.transactions) {
          results.failed.push({
            orderNo: order.orderNo,
            customerName: order.customerName,
            reason: 'Failed to fetch transactions'
          });
          continue;
        }

        const transactions = txResponse.transactions;

        // IMPORTANT: Only trust status "1" (fully settled).
        // Status "3" is AMBIGUOUS — can mean "Pending Settlement" OR "Unsuccessful".
        // Never auto-confirm based on status "3" alone.
        const successfulTx = transactions.find((tx: any) =>
          tx.billpaymentStatus === '1'
        );
        const allFailed = transactions.every((tx: any) =>
          tx.billpaymentStatus === '4'
        );

        if (successfulTx) {
          await prisma.payment.update({
            where: { id: order.payment.id },
            data: {
              status: 'SUCCESS',
              statusCode: '1',
              statusReason: 'Successful',
              transactionId: successfulTx.billpaymentInvoiceNo,
              paidAt: new Date(),
              callbackData: {
                verified: true,
                verifiedAt: new Date().toISOString(),
                bulkVerify: true,
                transaction: successfulTx
              }
            }
          });

          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' }
          });

          results.updated.push({
            orderNo: order.orderNo,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            total: order.total,
            paidAt: successfulTx.billPaymentDate,
            newStatus: 'Successful'
          });

          console.log(`Bulk verify: ${order.orderNo} -> Successful`);
        } else if (allFailed) {
          await prisma.$transaction([
            prisma.payment.update({
              where: { id: order.payment.id },
              data: {
                status: 'FAILED',
                statusCode: '3',
                statusReason: 'All transactions failed',
              }
            }),
            prisma.order.update({
              where: { id: order.id },
              data: { status: 'CANCELLED' }
            }),
          ]);

          results.updated.push({
            orderNo: order.orderNo,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            total: order.total,
            newStatus: 'Failed'
          });

          console.log(`Bulk verify: ${order.orderNo} -> Failed`);
        } else {
          // Status "2" or "4" = still pending
          const pendingTx = transactions[0];
          const pendingCode = pendingTx?.billpaymentStatus || '2';
          await prisma.payment.update({
            where: { id: order.payment.id },
            data: {
              statusCode: pendingCode,
            }
          });

          results.stillPending.push({
            orderNo: order.orderNo,
            customerName: order.customerName,
            total: order.total,
            statusCode: pendingCode
          });
        }
      } catch (error: any) {
        console.error(`❌ Bulk verify error for ${order.orderNo}:`, error.message);
        results.failed.push({
          orderNo: order.orderNo,
          customerName: order.customerName,
          reason: error.message
        });
      }
    }

    res.json({
      success: true,
      message: results.updated.length > 0
        ? `System updated ${results.updated.length} order(s)`
        : 'All verified - no updates needed',
      results
    });

  } catch (error: any) {
    console.error('Bulk verify failed:', error);
    res.status(500).json({ error: 'Bulk verification failed' });
  }
});

// GET /api/v1/admin/settings - Get all system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();

    // Convert to key-value object for easier frontend consumption
    const settingsObj = settings.reduce((acc: any, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    res.json(settingsObj);
  } catch (error: any) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/v1/admin/settings/:key - Update a specific setting
router.put('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value && value !== '') {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Validation for dineInCutoffTime (must be HH:mm format)
    if (key === 'dineInCutoffTime') {
      const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(value)) {
        return res.status(400).json({ error: 'Invalid time format. Use HH:mm (e.g., 18:00)' });
      }
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value },
    });

    res.json({ success: true, setting });
  } catch (error: any) {
    console.error('Failed to update setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// GET /api/v1/admin/settlement - Get cached settlement data
router.get('/settlement', async (req, res) => {
  try {
    const data = await getSettlementData();
    if (data) return res.json(data);
    res.json({ synced: false, message: 'No settlement data yet. Sync runs automatically every hour.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settlement data' });
  }
});

// POST /api/v1/admin/settlement/sync - Manual sync trigger
router.post('/settlement/sync', async (req, res) => {
  try {
    const data = await syncSettlementData();
    res.json(data);
  } catch (error: any) {
    console.error('Settlement sync error:', error);
    res.status(500).json({ error: 'Failed to sync settlement data' });
  }
});

export default router;
