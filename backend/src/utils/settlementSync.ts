import prisma from '../config/prisma';
import { cache } from '../config/redis';
import { getBillTransactions } from './toyyibpay';

const SETTINGS_KEY = 'settlement_data';
const CACHE_KEY = 'settlement_data';

/**
 * Sync settlement data from ToyyibPay by checking each SUCCESS payment.
 *
 * IMPORTANT: billpaymentStatus "3" is AMBIGUOUS in getBillTransactions API.
 * It can mean "Pending Settlement" (paid) OR "Unsuccessful" (failed).
 * We only count status "3" as paid if:
 *   - No status "4" (failed) transactions exist for the same bill
 *   - The transaction has a valid billpaymentInvoiceNo
 */
export async function syncSettlementData() {
  console.log('💰 Settlement sync started...');
  const startTime = Date.now();

  const payments = await prisma.payment.findMany({
    where: { status: 'SUCCESS', billCode: { not: null } },
    select: { id: true, billCode: true, amount: true, paidAt: true },
  });

  let pendingSettlement = 0;
  let settlementReceived = 0;
  let todayAmount = 0;
  let monthAmount = 0;
  let checked = 0;
  let skipped = 0;
  let errors = 0;

  const nowMY = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  const todayStr = `${nowMY.getFullYear()}-${String(nowMY.getMonth() + 1).padStart(2, '0')}-${String(nowMY.getDate()).padStart(2, '0')}`;
  const monthStr = `${nowMY.getFullYear()}-${String(nowMY.getMonth() + 1).padStart(2, '0')}`;

  for (const p of payments) {
    if (!p.billCode) continue;
    try {
      const result = await getBillTransactions(p.billCode);
      const txns = result.transactions;
      if (!Array.isArray(txns)) continue;

      // Per ToyyibPay API (confirmed via omnipay-toyyibpay library):
      //   billpaymentStatus 1 = Successful transaction
      //   billpaymentStatus 2 = Pending transaction
      //   billpaymentStatus 3 = Unsuccessful transaction (NOT "pending settlement"!)
      //   billpaymentStatus 4 = Pending (alternative)
      // Only count status "1" as paid.
      const settledTxn = txns.find((t: any) => t.billpaymentStatus === '1');

      if (!settledTxn) {
        skipped++;
        continue;
      }

      const paidTxn = settledTxn;

      // billpaymentAmount includes RM1 online banking fee charged to customer.
      // Subtract RM1 to get the net settlement amount (matches ToyyibPay dashboard).
      const amount = Number(paidTxn.billpaymentAmount) - 1;
      const isSettled = paidTxn.billpaymentSettlement?.toLowerCase().includes('done');

      if (isSettled) {
        settlementReceived += amount;
      } else {
        pendingSettlement += amount;
      }

      const tpDate = paidTxn.billPaymentDate || '';
      const dateMatch = tpDate.match(/(\d{2})-(\d{2})-(\d{4})/);
      if (dateMatch) {
        const tpDateStr = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        if (tpDateStr === todayStr) todayAmount += amount;
        if (tpDateStr.startsWith(monthStr)) monthAmount += amount;
      }

      checked++;
    } catch (e) {
      errors++;
    }
  }

  const data = {
    synced: true,
    syncedAt: new Date().toISOString(),
    pendingSettlement: Math.round(pendingSettlement * 100) / 100,
    settlementReceived: Math.round(settlementReceived * 100) / 100,
    todayAmount: Math.round(todayAmount * 100) / 100,
    monthAmount: Math.round(monthAmount * 100) / 100,
    totalChecked: checked,
    totalSkipped: skipped,
    totalErrors: errors,
  };

  await cache.set(CACHE_KEY, data, 7200);

  await prisma.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(data) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(data) },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`💰 Settlement sync done in ${elapsed}s — checked: ${checked}, skipped: ${skipped}, pending: RM${data.pendingSettlement}, received: RM${data.settlementReceived}`);

  return data;
}

/**
 * Get cached settlement data (memory first, then DB fallback)
 */
export async function getSettlementData() {
  const cached = await cache.get<any>(CACHE_KEY);
  if (cached) return cached;

  const setting = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (setting) {
    const data = JSON.parse(setting.value);
    await cache.set(CACHE_KEY, data, 7200);
    return data;
  }

  return null;
}
