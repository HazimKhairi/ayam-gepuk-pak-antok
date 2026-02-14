interface Order {
    id: string;
    orderNo: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    fulfillmentType: string;
    bookingDate: Date;
    subtotal: any;
    sst: any;
    deliveryFee: any;
    total: any;
    deliveryAddress?: string | null;
    notes?: string | null;
    outlet?: {
        name: string;
        address: string;
        phone: string;
    };
    paxCount?: number | null;
    table?: {
        tableNo: string;
        capacity: number;
        zone: string;
    } | null;
    timeSlot?: {
        time: string;
    } | null;
}
/**
 * Send confirmation email after successful payment
 */
export declare const sendConfirmationEmail: (order: Order) => Promise<boolean>;
/**
 * Schedule a reminder email 1 hour before booking time
 */
export declare const scheduleReminder: (order: Order) => Promise<void>;
export {};
//# sourceMappingURL=email.d.ts.map