"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBillTransactions = exports.createBill = void 0;
const axios_1 = __importDefault(require("axios"));
const TOYYIBPAY_URL = process.env.TOYYIBPAY_URL || 'https://dev.toyyibpay.com';
const SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY || '';
const CATEGORY_CODE = process.env.TOYYIBPAY_CATEGORY_CODE || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
/**
 * Create a bill on ToyyibPay
 * @param order - Order object
 * @param paymentId - Payment record ID for reference
 */
const createBill = async (order, paymentId) => {
    try {
        // Check if credentials are placeholders or missing
        const isPlaceholder = (value) => {
            return !value ||
                value === 'placeholder' ||
                value.includes('your_') ||
                value.includes('_here') ||
                value === 'your_secret_key_here' ||
                value === 'your_category_code_here';
        };
        // For sandbox testing, return mock data if no credentials or placeholders
        if (isPlaceholder(SECRET_KEY) || isPlaceholder(CATEGORY_CODE)) {
            console.log('⚠️ ToyyibPay credentials not set or using placeholders, using sandbox mock mode');
            const mockBillCode = `MOCK${Date.now()}`;
            return {
                success: true,
                billCode: mockBillCode,
                paymentUrl: `${FRONTEND_URL}/checkout/mock?billCode=${mockBillCode}&orderId=${order.id}`,
            };
        }
        const billData = new URLSearchParams({
            userSecretKey: SECRET_KEY,
            categoryCode: CATEGORY_CODE,
            billName: `Order ${order.orderNo}`,
            billDescription: `Reservation at ${order.outlet?.name || 'Ayam Gepuk Pak Antok'}`,
            billPriceSetting: '1',
            billPayorInfo: '1',
            billAmount: Math.round(Number(order.total) * 100).toString(), // Convert to cents
            billReturnUrl: `${FRONTEND_URL}/confirmation/${order.orderNo}`,
            billCallbackUrl: `${BACKEND_URL}/api/v1/payments/callback`,
            billExternalReferenceNo: order.orderNo,
            billTo: order.customerName,
            billEmail: order.customerEmail,
            billPhone: order.customerPhone.replace(/[^0-9]/g, ''),
            billSplitPayment: '0',
            billSplitPaymentArgs: '',
            billPaymentChannel: '0', // FPX only
            billContentEmail: `Thank you for your reservation at Ayam Gepuk Pak Antok. Your order number is ${order.orderNo}.`,
            billChargeToCustomer: '1',
            billExpiryDate: '',
            billExpiryDays: '1',
        });
        const response = await axios_1.default.post(`${TOYYIBPAY_URL}/index.php/api/createBill`, billData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        if (response.data && response.data[0]?.BillCode) {
            const billCode = response.data[0].BillCode;
            console.log('✅ ToyyibPay bill created:', billCode);
            return {
                success: true,
                billCode,
                paymentUrl: `${TOYYIBPAY_URL}/${billCode}`,
            };
        }
        console.error('❌ ToyyibPay API response:', JSON.stringify(response.data));
        return {
            success: false,
            error: `Failed to create bill: ${JSON.stringify(response.data)}`,
        };
    }
    catch (error) {
        console.error('❌ ToyyibPay error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.message,
        };
    }
};
exports.createBill = createBill;
/**
 * Get bill transactions from ToyyibPay
 * @param billCode - The bill code to check
 */
const getBillTransactions = async (billCode) => {
    try {
        if (!SECRET_KEY) {
            return { success: false, error: 'No secret key configured' };
        }
        const response = await axios_1.default.post(`${TOYYIBPAY_URL}/index.php/api/getBillTransactions`, new URLSearchParams({
            billCode,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return {
            success: true,
            transactions: response.data,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message,
        };
    }
};
exports.getBillTransactions = getBillTransactions;
//# sourceMappingURL=toyyibpay.js.map