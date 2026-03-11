import prisma from '../config/prisma';
import { getBillTransactions } from './toyyibpay';

/**
 * Cleanup abandoned PENDING orders older than specified minutes
 * IMPORTANT: Checks ToyyibPay first to avoid deleting paid orders!
 * Run this periodically via cron job or scheduler
 */
export async function cleanupAbandonedOrders(olderThanMinutes: number = 60) {
  try {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    // Find PENDING orders older than cutoff with payment info
    const abandonedOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoffTime },
      },
      select: {
        id: true,
        orderNo: true,
        payment: {
          select: {
            id: true,
            billCode: true,
            status: true
          }
        }
      },
    });

    if (abandonedOrders.length === 0) {
      console.log('✅ No abandoned orders to clean up');
      return { deleted: 0, recovered: 0 };
    }

    const toDelete: string[] = [];
    const recovered: string[] = [];

    // Check each order with ToyyibPay before deleting
    for (const order of abandonedOrders) {
      if (!order.payment?.billCode) {
        toDelete.push(order.id);
        continue;
      }

      try {
        // Verify with ToyyibPay API
        const billStatus = await getBillTransactions(order.payment.billCode);

        // Check if payment was successful (status 1 or 3)
        // Status 1 = Success (settled), Status 3 = Pending Settlement (paid but not yet settled)
        const successfulPayment = billStatus.transactions?.find(
          (tx: any) => tx.billpaymentStatus === '1' || tx.billpaymentStatus === '3'
        );

        if (successfulPayment) {
          // PAYMENT FOUND! Recover the order instead of deleting
          console.log(`💰 Recovery: Order ${order.orderNo} was PAID! Marking as COMPLETED`);

          await prisma.payment.update({
            where: { id: order.payment.id },
            data: {
              status: 'SUCCESS',
              transactionId: successfulPayment.billpaymentInvoiceNo,
              paidAt: new Date(successfulPayment.billPaymentDate),
              callbackData: {
                recovered: true,
                recoveredAt: new Date().toISOString(),
                transaction: successfulPayment
              }
            }
          });

          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' }
          });

          recovered.push(order.orderNo);
        } else {
          // No payment found - safe to delete
          toDelete.push(order.id);
        }
      } catch (error) {
        console.error(`⚠️  Could not verify ${order.orderNo} with ToyyibPay:`, error);
        // On error, don't delete - better safe than sorry
        continue;
      }
    }

    // Delete truly abandoned orders
    if (toDelete.length > 0) {
      await prisma.payment.deleteMany({
        where: { orderId: { in: toDelete } },
      });

      const result = await prisma.order.deleteMany({
        where: { id: { in: toDelete } },
      });

      console.log(`🗑️  Deleted ${result.count} truly abandoned orders`);
    }

    if (recovered.length > 0) {
      console.log(`✅ Recovered ${recovered.length} paid orders: ${recovered.join(', ')}`);
    }

    return {
      deleted: toDelete.length,
      recovered: recovered.length,
      recoveredOrders: recovered
    };
  } catch (error) {
    console.error('❌ Failed to cleanup abandoned orders:', error);
    throw error;
  }
}

/**
 * Run cleanup on server start (optional)
 */
export async function cleanupOnStartup() {
  console.log('🔄 Running abandoned order cleanup on startup...');
  await cleanupAbandonedOrders(60); // Clean orders older than 1 hour
}
