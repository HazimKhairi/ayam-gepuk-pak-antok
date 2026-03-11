import prisma from '../config/prisma';
import { getBillTransactions } from './toyyibpay';
import { sendConfirmationEmail, scheduleReminder } from './email';

/**
 * Periodic payment audit — catches mismatches between our system and ToyyibPay.
 *
 * Scenario 1: System says SUCCESS but ToyyibPay says FAILED
 *   → Auto-cancel the order (false positive)
 *
 * Scenario 2: System says FAILED/CANCELLED but ToyyibPay says PAID (status "1")
 *   → Auto-recover the order to COMPLETED
 *
 * Only audits orders from the last 7 days to limit API calls.
 */
export async function auditPayments() {
  console.log('🔍 Payment audit started...');
  const startTime = Date.now();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let falsePositives = 0;
  let recovered = 0;
  let checked = 0;
  let errors = 0;

  // ── Scenario 1: System SUCCESS but ToyyibPay might be FAILED ──────────
  const successPayments = await prisma.payment.findMany({
    where: {
      status: 'SUCCESS',
      billCode: { not: null },
      updatedAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      billCode: true,
      amount: true,
      order: { select: { id: true, orderNo: true, status: true, timeSlotId: true } },
    },
  });

  for (const p of successPayments) {
    if (!p.billCode) continue;
    try {
      const result = await getBillTransactions(p.billCode);
      const txns = result.transactions;
      checked++;

      if (!Array.isArray(txns) || txns.length === 0) continue;

      // Check if ANY transaction is status "1" (settled) — if so, it's legit
      const hasPaid = txns.some((t: any) => t.billpaymentStatus === '1');

      // Also accept webhook-confirmed status "3" — if webhook already set SUCCESS,
      // and there's a status "3" txn, it might be legit pending settlement.
      // Only flag as false positive if ALL txns are status "4" (failed).
      const allFailed = txns.every((t: any) => t.billpaymentStatus === '4');

      if (!hasPaid && allFailed) {
        // FALSE POSITIVE: System says paid but ToyyibPay says all failed
        console.log(`🚨 FALSE POSITIVE: ${p.order.orderNo} — system SUCCESS but ToyyibPay ALL FAILED. Cancelling...`);

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: p.id },
            data: {
              status: 'FAILED',
              statusReason: 'Audit: ToyyibPay confirms all transactions failed',
              callbackData: {
                auditCancelled: true,
                auditAt: new Date().toISOString(),
                allTransactions: txns,
              },
            },
          }),
          prisma.order.update({
            where: { id: p.order.id },
            data: { status: 'CANCELLED' },
          }),
        ]);

        // Release time slot if takeaway
        if (p.order.timeSlotId) {
          await prisma.timeSlot.update({
            where: { id: p.order.timeSlotId },
            data: { currentOrders: { decrement: 1 } },
          }).catch(() => {}); // Ignore if already 0
        }

        falsePositives++;
      }
    } catch (e) {
      errors++;
    }
  }

  // ── Scenario 2: System FAILED/CANCELLED but ToyyibPay might be PAID ───
  const failedPayments = await prisma.payment.findMany({
    where: {
      status: 'FAILED',
      billCode: { not: null },
      updatedAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      billCode: true,
      amount: true,
      order: {
        select: {
          id: true,
          orderNo: true,
          status: true,
          timeSlotId: true,
        },
      },
    },
  });

  for (const p of failedPayments) {
    if (!p.billCode) continue;
    try {
      const result = await getBillTransactions(p.billCode);
      const txns = result.transactions;
      checked++;

      if (!Array.isArray(txns) || txns.length === 0) continue;

      // Only recover on status "1" (definitively settled) — never on ambiguous "3"
      const settledTxn = txns.find((t: any) => t.billpaymentStatus === '1');

      if (settledTxn) {
        console.log(`🔄 RECOVERY: ${p.order.orderNo} — system FAILED but ToyyibPay confirms PAID (status "1"). Recovering...`);

        await prisma.payment.update({
          where: { id: p.id },
          data: {
            status: 'SUCCESS',
            statusCode: '1',
            statusReason: 'Audit: ToyyibPay confirms settled',
            transactionId: settledTxn.billpaymentInvoiceNo,
            paidAt: new Date(),
            callbackData: {
              auditRecovered: true,
              auditAt: new Date().toISOString(),
              transaction: settledTxn,
            },
          },
        });

        const updatedOrder = await prisma.order.update({
          where: { id: p.order.id },
          data: { status: 'COMPLETED' },
          include: { outlet: true, table: true, timeSlot: true, payment: true },
        });

        // Send confirmation email for recovered order (non-blocking)
        sendConfirmationEmail(updatedOrder).catch(() => {});
        scheduleReminder(updatedOrder).catch(() => {});

        recovered++;
      }
    } catch (e) {
      errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`🔍 Payment audit done in ${elapsed}s — checked: ${checked}, false positives cancelled: ${falsePositives}, recovered: ${recovered}, errors: ${errors}`);

  return { checked, falsePositives, recovered, errors };
}
