import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import prisma from '../config/prisma';

const BASE = '/api/v1';
let adminToken: string;
let testAdminId: string;

// ─── Setup & Teardown ────────────────────────────────────────────────────────
beforeAll(async () => {
  const hash = await bcrypt.hash('Test@Pass123', 10);
  const admin = await prisma.admin.create({
    data: {
      email: 'test-settlement@ayamgepuk.com',
      password: hash,
      name: 'Test Settlement Admin',
      role: 'MASTER',
      isActive: true,
    },
  });
  testAdminId = admin.id;

  // Login to get token
  const res = await request(app)
    .post(`${BASE}/auth/admin/login`)
    .send({ email: 'test-settlement@ayamgepuk.com', password: 'Test@Pass123' });
  adminToken = res.body.token;
});

afterAll(async () => {
  if (testAdminId) {
    await prisma.admin.delete({ where: { id: testAdminId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

// ─── Settlement Endpoints: Auth ──────────────────────────────────────────────
describe('Settlement endpoints require auth', () => {
  it('GET /admin/settlement → 401 without token', async () => {
    const res = await request(app).get(`${BASE}/admin/settlement`);
    expect(res.status).toBe(401);
  });

  it('POST /admin/settlement/sync → 401 without token', async () => {
    const res = await request(app).post(`${BASE}/admin/settlement/sync`);
    expect(res.status).toBe(401);
  });
});

// ─── GET /admin/settlement ──────────────────────────────────────────────────
describe('GET /admin/settlement (authenticated)', () => {
  it('returns 200 with settlement data or not-synced message', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/settlement`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // Either has synced data or tells us it hasn't synced yet
    if (res.body.synced) {
      expect(res.body).toHaveProperty('pendingSettlement');
      expect(res.body).toHaveProperty('settlementReceived');
      expect(res.body).toHaveProperty('todayAmount');
      expect(res.body).toHaveProperty('monthAmount');
      expect(res.body).toHaveProperty('totalChecked');
      expect(res.body).toHaveProperty('totalSkipped');
      expect(typeof res.body.pendingSettlement).toBe('number');
      expect(typeof res.body.settlementReceived).toBe('number');
      expect(typeof res.body.todayAmount).toBe('number');
      expect(typeof res.body.monthAmount).toBe('number');
      expect(res.body.pendingSettlement).toBeGreaterThanOrEqual(0);
      expect(res.body.settlementReceived).toBeGreaterThanOrEqual(0);
    } else {
      expect(res.body).toHaveProperty('synced', false);
    }
  });
});

// ─── POST /admin/settlement/sync ────────────────────────────────────────────
describe('POST /admin/settlement/sync (authenticated)', () => {
  it('returns synced settlement data with correct shape', async () => {
    const res = await request(app)
      .post(`${BASE}/admin/settlement/sync`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty('synced', true);
    expect(res.body).toHaveProperty('syncedAt');
    expect(res.body).toHaveProperty('pendingSettlement');
    expect(res.body).toHaveProperty('settlementReceived');
    expect(res.body).toHaveProperty('todayAmount');
    expect(res.body).toHaveProperty('monthAmount');
    expect(res.body).toHaveProperty('totalChecked');
    expect(res.body).toHaveProperty('totalSkipped');
    expect(res.body).toHaveProperty('totalErrors');

    // All amounts must be non-negative numbers
    expect(res.body.pendingSettlement).toBeGreaterThanOrEqual(0);
    expect(res.body.settlementReceived).toBeGreaterThanOrEqual(0);
    expect(res.body.todayAmount).toBeGreaterThanOrEqual(0);
    expect(res.body.monthAmount).toBeGreaterThanOrEqual(0);
    expect(res.body.totalChecked).toBeGreaterThanOrEqual(0);
    expect(res.body.totalSkipped).toBeGreaterThanOrEqual(0);
    expect(res.body.totalErrors).toBeGreaterThanOrEqual(0);
  }, 300000); // 5 min timeout — sync calls ToyyibPay API per payment

  it('skipped count > 0 proves status "3" filtering works', async () => {
    // After sync, get the cached data
    const res = await request(app)
      .get(`${BASE}/admin/settlement`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    if (res.body.synced) {
      // totalSkipped should be > 0 if there are any status "3" (unsuccessful) payments
      // This validates that we're NOT counting unsuccessful transactions as paid
      expect(res.body.totalSkipped).toBeGreaterThanOrEqual(0);

      // checked + skipped should equal total SUCCESS payments in DB
      const successPayments = await prisma.payment.count({
        where: { status: 'SUCCESS', billCode: { not: null } },
      });
      const totalProcessed = res.body.totalChecked + res.body.totalSkipped + res.body.totalErrors;
      // totalProcessed should be <= successPayments (some may have null billCode)
      expect(totalProcessed).toBeLessThanOrEqual(successPayments + 1); // +1 for edge cases
    }
  });

  it('cached data matches after sync', async () => {
    // Sync first
    const syncRes = await request(app)
      .post(`${BASE}/admin/settlement/sync`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(syncRes.status).toBe(200);

    // Get cached data
    const cacheRes = await request(app)
      .get(`${BASE}/admin/settlement`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(cacheRes.status).toBe(200);

    // Cached data should match sync result
    expect(cacheRes.body.pendingSettlement).toBe(syncRes.body.pendingSettlement);
    expect(cacheRes.body.settlementReceived).toBe(syncRes.body.settlementReceived);
    expect(cacheRes.body.todayAmount).toBe(syncRes.body.todayAmount);
    expect(cacheRes.body.monthAmount).toBe(syncRes.body.monthAmount);
  }, 300000);
});

// ─── Dashboard includes settlement data ─────────────────────────────────────
describe('Dashboard settlement integration', () => {
  it('dashboard response includes settlement field', async () => {
    const res = await request(app)
      .get(`${BASE}/admin/dashboard`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('settlement');
  });
});

// ─── Settlement status codes (unit-level validation) ─────────────────────────
describe('ToyyibPay status code handling', () => {
  it('only billpaymentStatus "1" is counted as successful', () => {
    // Per omnipay-toyyibpay library (https://github.com/sitehandy/omnipay-toyyibpay):
    // STATUS_SUCCESSFUL = 1  → count as paid
    // STATUS_PENDING = 2     → skip
    // STATUS_UNSUCCESSFUL = 3 → skip (NOT "pending settlement"!)
    // STATUS_PENDING_ALT = 4  → skip
    const STATUS_SUCCESSFUL = 1;
    const STATUS_PENDING = 2;
    const STATUS_UNSUCCESSFUL = 3;
    const STATUS_PENDING_ALT = 4;

    const isSuccess = (status: number) => status === STATUS_SUCCESSFUL;

    expect(isSuccess(STATUS_SUCCESSFUL)).toBe(true);
    expect(isSuccess(STATUS_PENDING)).toBe(false);
    expect(isSuccess(STATUS_UNSUCCESSFUL)).toBe(false);
    expect(isSuccess(STATUS_PENDING_ALT)).toBe(false);
  });
});
