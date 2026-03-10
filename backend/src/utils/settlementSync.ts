import prisma from '../config/prisma';
import { cache } from '../config/redis';
import { getBillTransactions } from './toyyibpay';

const SETTINGS_KEY = 'settlement_data';
const CACHE_KEY = 'settlement_data';

/**
 * Sync settlement data from ToyyibPay by checking each SUCCESS payment.
 *
 * getBillTransactions returns multiple transactions per bill. Each has:
 *   - billpaymentStatus: "1" (Successful), "3" (ambiguous), "4" (Failed)
 *   - billpaymentAmount: bill amount (does NOT include RM1 fee)
 *   - transactionCharge: RM1.00 fee (separate from billpaymentAmount)
 *   - billpaymentSettlement: "Pending Settlement", "Done", or empty
 *
 * IMPORTANT FINDINGS (verified from actual API data):
 *   - Status "1" = reliably paid. ToyyibPay counts these in their dashboard.
 *   - Status "3" = UNRELIABLE for settlement. Even with transactionCharge > 0
 *     and "Pending Settlement", many are expired/cancelled and NOT counted by
 *     ToyyibPay dashboard. Only status "1" matches ToyyibPay's numbers.
 *   - Status "4" = failed attempt (charge 0, empty settlement).
 *   - billpaymentAmount = gross bill amount. ToyyibPay dashboard shows
 *     NET settlement (after RM1 fee), so we subtract RM1 per transaction.
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

      // Only count status "1" (definitively successful).
      // Status "3" is unreliable for settlement — see docblock above.
      const paidTxn = txns.find((t: any) => t.billpaymentStatus === '1');

      if (!paidTxn) {
        skipped++;
        continue;
      }

      // billpaymentAmount = gross. Subtract RM1 fee to match ToyyibPay
      // dashboard which shows net settlement amounts.
      const fee = Number(paidTxn.transactionCharge || 1);
      const amount = Number(paidTxn.billpaymentAmount) - fee;
      const isSettled = (paidTxn.billpaymentSettlement || '').toLowerCase().includes('done');

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
