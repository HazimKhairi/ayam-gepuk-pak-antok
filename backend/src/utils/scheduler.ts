import { cleanupAbandonedOrders } from './cleanupOrders';

/**
 * Run cleanup every hour
 */
export function startPeriodicCleanup() {
  // Run cleanup every 1 hour (3600000 ms)
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  console.log('🔄 Starting periodic cleanup scheduler (every 1 hour)');

  // Run immediately on start
  cleanupAbandonedOrders(60).catch(err => {
    console.error('Cleanup error:', err);
  });

  // Then run every hour
  setInterval(() => {
    console.log('⏰ Running scheduled cleanup...');
    cleanupAbandonedOrders(60).catch(err => {
      console.error('Cleanup error:', err);
    });
  }, CLEANUP_INTERVAL);
}
