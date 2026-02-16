/**
 * Verify and Fix Stuck Payments Script
 *
 * This script finds orders stuck in PENDING status where webhooks failed,
 * then verifies payment status with ToyyibPay and updates the database.
 *
 * Usage:
 *   npx ts-node scripts/verify-stuck-payments.ts
 *
 * Features:
 * - Finds PENDING orders from last 7 days
 * - Queries ToyyibPay for actual payment status
 * - Updates database for successful payments
 * - Sends confirmation emails for recovered orders
 * - Generates detailed report
 */

import prisma from '../src/config/prisma';
import { getBillTransactions } from '../src/utils/toyyibpay';
import { sendConfirmationEmail, scheduleReminder } from '../src/utils/email';

interface StuckOrder {
  orderNo: string;
  billCode: string | null;
  customerName: string;
  customerEmail: string;
  total: string;
  createdAt: Date;
}

interface VerificationResult {
  orderNo: string;
  status: 'fixed' | 'still_pending' | 'error';
  message: string;
  transactionId?: string;
}

async function findStuckOrders(): Promise<StuckOrder[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const orders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      createdAt: {
        gte: sevenDaysAgo,
      },
      payment: {
        callbackData: null,
      },
    },
    include: {
      payment: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return orders.map((order) => ({
    orderNo: order.orderNo,
    billCode: order.payment?.billCode || null,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    total: order.total.toString(),
    createdAt: order.createdAt,
  }));
}

async function verifyOrder(orderNo: string, billCode: string | null): Promise<VerificationResult> {
  if (!billCode) {
    return {
      orderNo,
      status: 'error',
      message: 'No billCode found for this order',
    };
  }

  try {
    // Get transaction status from ToyyibPay
    const result = await getBillTransactions(billCode);

    if (!result.success || !result.transactions || result.transactions.length === 0) {
      return {
        orderNo,
        status: 'error',
        message: `Failed to get transactions: ${result.error || 'Unknown error'}`,
      };
    }

    // Find successful transaction (billpaymentStatus = "1")
    const successfulTxn = result.transactions.find((txn: any) => txn.billpaymentStatus === '1');

    if (!successfulTxn) {
      return {
        orderNo,
        status: 'still_pending',
        message: 'No successful payment found in ToyyibPay',
      };
    }

    // Get full order details
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        payment: true,
        outlet: true,
        table: true,
        timeSlot: true,
      },
    });

    if (!order || !order.payment) {
      return {
        orderNo,
        status: 'error',
        message: 'Order or payment not found in database',
      };
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: 'SUCCESS',
        transactionId: successfulTxn.billpaymentInvoiceNo,
        paidAt: new Date(),
        callbackData: {
          recovered: true,
          recoveredAt: new Date().toISOString(),
          recoveredBy: 'verify-stuck-payments-script',
          transaction: successfulTxn,
        },
      },
    });

    // Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED' },
    });

    // Send confirmation email (non-blocking)
    sendConfirmationEmail(order).catch((err) => {
      console.error(`Email error for ${orderNo}:`, err.message);
    });

    // Schedule reminder (non-blocking)
    scheduleReminder(order).catch((err) => {
      console.error(`Reminder error for ${orderNo}:`, err.message);
    });

    return {
      orderNo,
      status: 'fixed',
      message: 'Payment verified and order completed',
      transactionId: successfulTxn.billpaymentInvoiceNo,
    };
  } catch (error: any) {
    return {
      orderNo,
      status: 'error',
      message: `Error: ${error.message}`,
    };
  }
}

async function main() {
  console.log('🔍 Searching for stuck payments...\n');

  const stuckOrders = await findStuckOrders();

  if (stuckOrders.length === 0) {
    console.log('✅ No stuck orders found. All payments are processing correctly.\n');
    return;
  }

  console.log(`Found ${stuckOrders.length} stuck order(s):\n`);

  const results: VerificationResult[] = [];

  for (const order of stuckOrders) {
    console.log(`📋 Processing ${order.orderNo}...`);
    console.log(`   Customer: ${order.customerName}`);
    console.log(`   Amount: RM ${order.total}`);
    console.log(`   Created: ${order.createdAt.toLocaleString()}`);

    const result = await verifyOrder(order.orderNo, order.billCode);
    results.push(result);

    if (result.status === 'fixed') {
      console.log(`   ✅ FIXED - Transaction: ${result.transactionId}\n`);
    } else if (result.status === 'still_pending') {
      console.log(`   ⏳ STILL PENDING - ${result.message}\n`);
    } else {
      console.log(`   ❌ ERROR - ${result.message}\n`);
    }

    // Add delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const fixed = results.filter((r) => r.status === 'fixed');
  const pending = results.filter((r) => r.status === 'still_pending');
  const errors = results.filter((r) => r.status === 'error');

  console.log(`Total Orders Processed: ${results.length}`);
  console.log(`✅ Fixed: ${fixed.length}`);
  console.log(`⏳ Still Pending: ${pending.length}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (fixed.length > 0) {
    console.log('\n✅ Fixed Orders:');
    fixed.forEach((r) => {
      console.log(`   - ${r.orderNo} (${r.transactionId})`);
    });
  }

  if (pending.length > 0) {
    console.log('\n⏳ Still Pending:');
    pending.forEach((r) => {
      console.log(`   - ${r.orderNo}: ${r.message}`);
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((r) => {
      console.log(`   - ${r.orderNo}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

main()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
