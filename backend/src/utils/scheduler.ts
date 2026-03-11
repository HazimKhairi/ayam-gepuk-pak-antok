import { cleanupAbandonedOrders } from './cleanupOrders';
import { syncSettlementData } from './settlementSync';
import { auditPayments } from './paymentAudit';

/**
 * Run cleanup every hour + settlement sync every hour + payment audit every 2 hours
 */
export function startPeriodicCleanup() {
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  const AUDIT_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours

  console.log('🔄 Starting periodic cleanup scheduler (every 1 hour)');
  console.log('💰 Starting periodic settlement sync (every 1 hour)');
  console.log('🔍 Starting periodic payment audit (every 2 hours)');

  // Run immediately on start (staggered to avoid API overload)
  cleanupAbandonedOrders(60).catch(err => {
    console.error('Cleanup error:', err);
  });
  setTimeout(() => {
    syncSettlementData().catch(err => {
      console.error('Settlement sync error:', err);
    });
  }, 10000);
  setTimeout(() => {
    auditPayments().catch(err => {
      console.error('Payment audit error:', err);
    });
  }, 30000);

  // Cleanup + settlement sync every hour
  setInterval(() => {
    console.log('⏰ Running scheduled cleanup...');
    cleanupAbandonedOrders(60).catch(err => {
      console.error('Cleanup error:', err);
    });
    console.log('💰 Running scheduled settlement sync...');
    syncSettlementData().catch(err => {
      console.error('Settlement sync error:', err);
    });
  }, CLEANUP_INTERVAL);

  // Payment audit every 2 hours
  setInterval(() => {
    console.log('🔍 Running scheduled payment audit...');
    auditPayments().catch(err => {
      console.error('Payment audit error:', err);
    });
  }, AUDIT_INTERVAL);
}
