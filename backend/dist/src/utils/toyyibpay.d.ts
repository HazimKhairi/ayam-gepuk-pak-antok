interface BillResult {
    success: boolean;
    billCode?: string;
    paymentUrl?: string;
    error?: string;
}
interface Order {
    id: string;
    orderNo: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    total: any;
    outlet?: {
        name: string;
    };
}
/**
 * Create a bill on ToyyibPay
 * @param order - Order object
 * @param paymentId - Payment record ID for reference
 */
export declare const createBill: (order: Order, paymentId: string) => Promise<BillResult>;
/**
 * Get bill transactions from ToyyibPay
 * @param billCode - The bill code to check
 */
export declare const getBillTransactions: (billCode: string) => Promise<{
    success: boolean;
    transactions: any;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    transactions?: undefined;
}>;
export {};
//# sourceMappingURL=toyyibpay.d.ts.map