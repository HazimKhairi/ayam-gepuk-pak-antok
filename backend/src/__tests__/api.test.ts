import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import prisma from '../config/prisma';

const BASE = '/api/v1';
let adminToken: string;
let testAdminId: string;

// ─── Setup & Teardown ────────────────────────────────────────────────────────
beforeAll(async () => {
  // Create a test admin for authenticated tests
  const hash = await bcrypt.hash('Test@Pass123', 10);
  const admin = await prisma.admin.create({
    data: {
      email: 'test-regression@ayamgepuk.com',
      password: hash,
      name: 'Test Admin',
      role: 'MASTER',
      isActive: true,
    },
  });
  testAdminId = admin.id;
});

afterAll(async () => {
  // Clean up test admin
  if (testAdminId) {
    await prisma.admin.delete({ where: { id: testAdminId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ─── Health Check ────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns status ok with database connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
describe('POST /auth/admin/login', () => {
  it('returns 400 with missing credentials', async () => {
    const res = await request(app).post(`${BASE}/auth/admin/login`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/admin/login`)
      .send({ email: 'test-regression@ayamgepuk.com', password: 'WrongPass999!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 200 with valid credentials and token', async () => {
    const res = await request(app)
      .post(`${BASE}/auth/admin/login`)
      .send({ email: 'test-regression@ayamgepuk.com', password: 'Test@Pass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.admin).toBeDefined();
    adminToken = res.body.token;
  });
});

// ─── Protected Admin Routes (no token) ───────────────────────────────────────
describe('Admin routes without token return 401', () => {
  it('GET /admin/dashboard → 401', async () => {
    const res = await request(app).get(`${BASE}/admin/dashboard`);
    expect(res.status).toBe(401);
  });

  it('GET /admin/orders → 401', async () => {
    const res = await request(app).get(`${BASE}/admin/orders`);
    expect(res.status).toBe(401);
  });

  it('GET /admin/outlets → 401', async () => {
    const res = await request(app).get(`${BASE}/admin/outlets`);
    expect(res.status).toBe(401);
  });
});

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
describe('GET /admin/dashboard (authenticated)', () => {
  it('returns 200 with expected shape', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats).toHaveProperty('totalOrders');
    expect(res.body).toHaveProperty('recentOrders');
    expect(Array.isArray(res.body.recentOrders)).toBe(true);
  });

  it('pagination: recentOrdersPage and recentOrdersLimit params work', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/dashboard?recentOrdersPage=1&recentOrdersLimit=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.recentOrders.length).toBeLessThanOrEqual(5);
    expect(res.body.recentOrdersPage).toBe(1);
    expect(res.body.recentOrdersLimit).toBe(5);
  });

  it('sorting: recentOrdersSortBy=total_desc works', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/dashboard?recentOrdersSortBy=total_desc`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const orders = res.body.recentOrders;
    if (orders.length >= 2) {
      expect(orders[0].total).toBeGreaterThanOrEqual(orders[orders.length - 1].total);
    }
  });
});

// ─── Admin Orders ─────────────────────────────────────────────────────────────
describe('GET /admin/orders (authenticated)', () => {
  it('returns 200 with orders array and pagination', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/orders`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.pagination).toHaveProperty('page');
    expect(res.body.pagination).toHaveProperty('limit');
  });

  it('pagination: page=1&limit=5 returns max 5 orders', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/orders?page=1&limit=5`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeLessThanOrEqual(5);
  });
});

// ─── Admin Outlets ────────────────────────────────────────────────────────────
describe('GET /admin/outlets (authenticated)', () => {
  it('returns 200 with outlets and pagination', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/outlets`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.outlets)).toBe(true);
    expect(res.body).toHaveProperty('pagination');
  });
});

describe('DELETE /admin/outlets/:id (authenticated)', () => {
  it('returns 400 or 404 for non-existent outlet', async () => {
    const res = await request(app)
      .delete(`${BASE}/admin/outlets/non-existent-id-12345`)
      .set('Authorization', `Bearer ${adminToken}`);
    // 401 = still not authenticated (shouldn't happen), 400/404/500 = expected
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(401);
  });
});

// ─── Public Outlets ───────────────────────────────────────────────────────────
describe('GET /outlets', () => {
  it('returns 200 with outlets array', async () => {
    const res = await request(app).get(`${BASE}/outlets`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('each outlet has required fields', async () => {
    const res = await request(app).get(`${BASE}/outlets`);
    if (res.body.length > 0) {
      const outlet = res.body[0];
      expect(outlet).toHaveProperty('id');
      expect(outlet).toHaveProperty('name');
      expect(outlet).toHaveProperty('maxCapacity');
      expect(outlet).toHaveProperty('maxTakeawayOrders');
    }
  });
});

// ─── Public Menu ──────────────────────────────────────────────────────────────
describe('GET /menu', () => {
  it('returns 200 with menu items', async () => {
    const res = await request(app).get(`${BASE}/menu`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────
describe('GET /categories', () => {
  it('returns 200 with categories', async () => {
    const res = await request(app).get(`${BASE}/categories`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─── Payment Status ───────────────────────────────────────────────────────────
describe('GET /payments/status/:billCode', () => {
  it('returns error for non-existent bill code', async () => {
    const res = await request(app).get(`${BASE}/payments/status/INVALID_BILL_CODE`);
    // Could be 400 or 500 depending on ToyyibPay response
    expect([400, 404, 500]).toContain(res.status);
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
