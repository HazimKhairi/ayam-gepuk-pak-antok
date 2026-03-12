import { Router } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { sendConfirmationEmail, scheduleReminder } from '../utils/email';
import { getBillTransactions } from '../utils/toyyibpay';
import { requireAdmin } from '../middlewares/auth';
import { logEvent } from '../utils/systemLogger';

const TOYYIBPAY_SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY || '';

const router = Router();

// POST /api/v1/payments/callback - ToyyibPay callback
router.post('/callback', async (req, res) => {
  try {
    console.log('🔔 ToyyibPay webhook received:', JSON.stringify(req.body));

    const { billcode, order_id, status_id, transaction_id, refno, amount, reason, transaction_time, hash } = req.body;

    if (!billcode || !status_id) {
      console.error('❌ Webhook missing parameters:', req.body);
      return res.status(400).json({ error: 'Missing required callback parameters' });
    }

    // --- HASH VALIDATION ---
    // ToyyibPay docs: MD5(userSecretKey + status + order_id + refno + "ok")
    // Note: "status" in hash formula refers to status_id from callback
    if (TOYYIBPAY_SECRET_KEY && hash) {
      const expectedHash = crypto
        .createHash('md5')
        .update(TOYYIBPAY_SECRET_KEY + status_id + (order_id || '') + (refno || '') + 'ok')
        .digest('hex');

      if (hash !== expectedHash) {
        console.error('❌ Webhook hash validation FAILED for billCode:', billcode, '| received:', hash, '| expected:', expectedHash);
        logEvent('SECURITY', 'Webhook hash validation failed', `billCode: ${billcode}, order_id: ${order_id}`, { billcode, order_id, receivedHash: hash });
        return res.status(403).json({ error: 'Invalid callback hash' });
      }
      console.log('🔐 Webhook hash validated OK');
    } else if (TOYYIBPAY_SECRET_KEY && !hash) {
      // Hash not provided but we have a secret key — log warning but don't block
      // (DuitNow QR callbacks may have different hash format)
      console.warn('⚠️ Webhook received without hash parameter for billCode:', billcode);
    }

    // Find payment by billCode
    const payment = await prisma.payment.findFirst({
      where: { billCode: billcode },
      include: {
        order: {
          include: {
            outlet: true,
            table: true,
            timeSlot: true,
          },
        },
      },
    });

    if (!payment) {
      console.error('❌ Payment not found for billCode:', billcode);
      return res.status(404).json({ error: 'Payment not found' });
    }

    console.log('📦 Found payment for order:', payment.order.orderNo);

    // --- AMOUNT VALIDATION ---
    // ToyyibPay sends amount as string in RM (e.g. "55.70")
    // Our payment.amount is the order total in RM
    if (amount && (status_id === '1' || status_id === '3')) {
      const callbackAmount = parseFloat(amount);
      const expectedAmount = Number(payment.amount);
      if (!isNaN(callbackAmount) && Math.abs(callbackAmount - expectedAmount) > 0.01) {
        console.error(`❌ Amount mismatch! Callback: RM${callbackAmount}, Expected: RM${expectedAmount}, Order: ${payment.order.orderNo}`);
        logEvent('SECURITY', 'Payment amount mismatch', `Order ${payment.order.orderNo}: callback RM${callbackAmount} vs expected RM${expectedAmount}`, { orderNo: payment.order.orderNo, callbackAmount, expectedAmount });
        return res.status(400).json({ error: 'Payment amount mismatch' });
      }
    }

    // Determine new payment status from webhook
    // Webhook status_id: 1=Settled(success), 3=Pending Settlement(success), 4=Failed
    const incomingStatus = (status_id === '1' || status_id === '3') ? 'SUCCESS' :
                           status_id === '4' ? 'FAILED' : 'PENDING';

    // Prevent duplicate processing — but ALWAYS allow SUCCESS to override FAILED
    // (customer may retry after a failed attempt, and the success webhook arrives after the fail one)
    if (payment.status === 'SUCCESS') {
      console.log('⚠️ Payment already SUCCESS, skipping:', payment.order.orderNo);
      return res.json({ success: true, message: 'Already processed' });
    }
    if (payment.status === 'FAILED' && incomingStatus !== 'SUCCESS') {
      console.log('⚠️ Payment already FAILED, ignoring non-success webhook:', payment.order.orderNo);
      return res.json({ success: true, message: 'Already processed' });
    }
    if (payment.status === 'FAILED' && incomingStatus === 'SUCCESS') {
      console.log('🔄 SUCCESS webhook overriding previous FAILED status for:', payment.order.orderNo);
    }

    const paymentStatus = incomingStatus;
    // Map webhook status_id to ToyyibPay transaction status code
    // Webhook 1,3 → txn "1" (Successful), Webhook 4 → txn "3" (Unsuccessful), Webhook 2 → txn "2" (Pending)
    const txnStatusCode = paymentStatus === 'SUCCESS' ? '1' :
                          paymentStatus === 'FAILED' ? '3' : '2';
    console.log(`Payment status: ${paymentStatus} (status_id: ${status_id})`);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        transactionId: transaction_id || refno || null,
        status: paymentStatus,
        statusCode: txnStatusCode,
        statusReason: reason || null,
        paidAt: paymentStatus === 'SUCCESS' ? new Date() : null,
        callbackData: req.body,
      },
    });

    // Update order status if payment successful
    if (paymentStatus === 'SUCCESS') {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'COMPLETED' },
      });

      console.log('✅ Order completed:', payment.order.orderNo);
      logEvent('PAYMENT', 'Payment successful (webhook)', `Order ${payment.order.orderNo} paid via webhook`, { orderNo: payment.order.orderNo, transactionId: transaction_id, statusId: status_id });

      // Send confirmation email (non-blocking)
      sendConfirmationEmail(payment.order).catch((err) => {
        console.error('Email error:', err.message);
      });

      // Schedule reminder (non-blocking)
      scheduleReminder(payment.order).catch((err) => {
        console.error('Reminder error:', err.message);
      });
    } else if (paymentStatus === 'FAILED') {
      await prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'CANCELLED' },
      });

      console.log('❌ Order cancelled due to failed payment:', payment.order.orderNo);
      logEvent('PAYMENT', 'Payment failed (webhook)', `Order ${payment.order.orderNo} payment failed`, { orderNo: payment.order.orderNo, statusId: status_id });

      // If takeaway, decrement time slot
      if (payment.order.timeSlotId) {
        await prisma.timeSlot.update({
          where: { id: payment.order.timeSlotId },
          data: { currentOrders: { decrement: 1 } },
        });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    logEvent('ERROR', 'Webhook processing error', (error as Error).message || 'Unknown error', { body: req.body });
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

// GET /api/v1/payments/status/:billCode - Check payment status
router.get('/status/:billCode', async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { billCode: req.params.billCode },
      include: {
        order: {
          include: { outlet: true, table: true, timeSlot: true },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ status: payment.status, order: payment.order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// POST /api/v1/payments/verify/:orderNo - Verify and sync payment status from ToyyibPay
router.post('/verify/:orderNo', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNo: req.params.orderNo },
      include: {
        payment: true,
        outlet: true,
        table: true,
        timeSlot: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.payment || !order.payment.billCode) {
      return res.status(404).json({ error: 'Payment record or billCode not found' });
    }

    // Already successful, no need to verify
    if (order.payment.status === 'SUCCESS') {
      return res.json({
        success: true,
        message: 'Payment already completed',
        order,
        alreadyCompleted: true
      });
    }

    // If our system says FAILED/CANCELLED, still check ToyyibPay API to confirm.
    // Webhook may have been wrong (e.g. status "3" ambiguity) — ToyyibPay might
    // actually show status "1" (settled). If so, we recover the order.
    const wasMarkedFailed = order.payment.status === 'FAILED' || order.status === 'CANCELLED';

    console.log(`🔍 Verifying payment for order ${order.orderNo} with billCode ${order.payment.billCode}`);

    // Get transaction status from ToyyibPay
    const result = await getBillTransactions(order.payment.billCode);

    if (!result.success || !result.transactions || result.transactions.length === 0) {
      console.error('Failed to get transactions from ToyyibPay:', result.error);
      return res.status(500).json({
        error: 'Failed to verify payment with ToyyibPay',
        details: result.error
      });
    }

    // Find successful transaction
    // IMPORTANT: Only trust status "1" (fully settled) from polling.
    // Status "3" is AMBIGUOUS in getBillTransactions — can mean "Pending Settlement" (paid)
    // OR "Unsuccessful" (failed). We CANNOT distinguish reliably.
    // Only the webhook (pushed by ToyyibPay) can be trusted for status "3".
    // So here we only auto-confirm on status "1". For status "3", we wait for webhook.
    const settledTxn = result.transactions.find((txn: any) =>
      txn.billpaymentStatus === '1'
    );

    if (settledTxn) {
      if (wasMarkedFailed) {
        console.log(`🔄 RECOVERY: Order ${order.orderNo} was marked FAILED/CANCELLED but ToyyibPay confirms PAID. Recovering...`);
        logEvent('PAYMENT', 'Payment recovered (verify)', `Order ${order.orderNo} was FAILED but ToyyibPay confirms PAID. Recovered.`, { orderNo: order.orderNo, transactionId: settledTxn.billpaymentInvoiceNo });
      }
      console.log(`✅ Found settled payment for ${order.orderNo}:`, settledTxn.billpaymentInvoiceNo);

      // Update payment status
      await prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          status: 'SUCCESS',
          statusCode: '1',
          statusReason: 'Successful',
          transactionId: settledTxn.billpaymentInvoiceNo,
          paidAt: new Date(),
          callbackData: {
            verified: true,
            verifiedAt: new Date().toISOString(),
            transaction: settledTxn,
            allTransactions: result.transactions,
          },
        },
      });

      // Update order status to COMPLETED
      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' },
        include: {
          outlet: true,
          table: true,
          timeSlot: true,
          payment: true,
        },
      });

      // Send confirmation email (non-blocking)
      sendConfirmationEmail(updatedOrder).catch((err) => {
        console.error('Email error:', err.message);
      });

      // Schedule reminder (non-blocking)
      scheduleReminder(updatedOrder).catch((err) => {
        console.error('Reminder error:', err.message);
      });

      return res.json({
        success: true,
        message: 'Payment verified and order completed',
        order: updatedOrder,
        wasVerified: true
      });
    }

    // Check for status "3" — ambiguous, could be paid or failed
    const status3Txn = result.transactions.find((txn: any) => txn.billpaymentStatus === '3');

    // Check if ALL transactions are status "4" (definitively failed)
    const allFailed = result.transactions.every((txn: any) => txn.billpaymentStatus === '4');

    if (allFailed) {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: order.payment.id },
          data: {
            status: 'FAILED',
            statusCode: '3',
            statusReason: 'All transactions failed',
            callbackData: {
              verified: true,
              verifiedAt: new Date().toISOString(),
              allTransactions: result.transactions,
            },
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        }),
      ]);
      console.log(`❌ All transactions failed for ${order.orderNo}, order cancelled`);

      return res.json({
        success: false,
        failed: true,
        message: 'Payment was declined by the bank. Please place a new order.',
      });
    }

    if (status3Txn) {
      // Status "3" found but NOT settled yet — don't auto-confirm.
      if (wasMarkedFailed) {
        // Already marked failed + status "3" is ambiguous → confirm failed
        console.log(`❌ Order ${order.orderNo} was FAILED and ToyyibPay shows ambiguous status "3" — confirming failed`);
        return res.json({
          success: false,
          failed: true,
          message: 'Payment was unsuccessful. Please place a new order.',
        });
      }
      // Fresh order — tell frontend to keep waiting. Webhook will confirm.
      console.log(`⏳ Status "3" (ambiguous) for ${order.orderNo} — waiting for webhook confirmation`);
      return res.json({
        success: false,
        message: 'Payment is being processed by the bank. Please wait a moment.',
        stillPending: true
      });
    }

    // No settled, no status 3, not all failed — genuinely still pending
    if (wasMarkedFailed) {
      // Was marked failed and ToyyibPay has no success — confirm failed
      return res.json({
        success: false,
        failed: true,
        message: 'Payment was unsuccessful. Please place a new order.',
      });
    }
    return res.json({
      success: false,
      message: 'Payment is still being processed',
      stillPending: true
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// POST /api/v1/payments/complete/:orderNo - Manual payment completion (admin only)
router.post('/complete/:orderNo', requireAdmin, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNo: req.params.orderNo },
      include: {
        payment: true,
        outlet: true,
        table: true,
        timeSlot: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Prevent duplicate processing
    if (order.payment.status === 'SUCCESS') {
      return res.json({ success: true, message: 'Payment already completed', order });
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: 'SUCCESS',
        paidAt: new Date(),
        transactionId: `MANUAL_${Date.now()}`,
      },
    });

    // Update order status to COMPLETED
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED' },
      include: {
        outlet: true,
        table: true,
        timeSlot: true,
        payment: true,
      },
    });

    // Send confirmation email (non-blocking)
    sendConfirmationEmail(updatedOrder).catch(() => {});

    // Schedule reminder (non-blocking)
    scheduleReminder(updatedOrder).catch(() => {});

    res.json({
      success: true,
      message: 'Payment completed successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Manual payment completion error:', error);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
});

export default router;
