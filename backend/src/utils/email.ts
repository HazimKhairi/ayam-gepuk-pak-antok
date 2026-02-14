import nodemailer from 'nodemailer';

// Create Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// HTML escape to prevent XSS in emails
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
export const sendConfirmationEmail = async (order: Order): Promise<boolean> => {
  try {
    const fulfillmentText = {
      DINE_IN: order.paxCount
        ? `${order.paxCount} pax at ${order.timeSlot?.time || 'scheduled time'}`
        : `Table ${order.table?.tableNo} (${order.table?.zone} - ${order.table?.capacity} Pax)`,
      TAKEAWAY: `Pickup at ${order.timeSlot?.time}`,
      DELIVERY: `Delivery to: ${order.deliveryAddress}`,
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FFC107, #FF9800); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: #fff; margin: 0; font-size: 28px; }
          .content { background: #fff; padding: 30px; border: 1px solid #eee; }
          .order-info { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .order-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .order-row:last-child { border-bottom: none; }
          .total { font-size: 20px; font-weight: bold; color: #FFC107; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #FFC107; color: #212529; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🍗 Booking Confirmed!</h1>
          </div>
          <div class="content">
            <p>Assalamualaikum <strong>${escapeHtml(order.customerName)}</strong>,</p>
            <p>Thank you for your reservation at <strong>${order.outlet?.name}</strong>!</p>
            
            <div class="order-info">
              <h3 style="margin-top: 0;">Order Details</h3>
              <div class="order-row">
                <span>Order Number:</span>
                <strong>${order.orderNo}</strong>
              </div>
              <div class="order-row">
                <span>Type:</span>
                <strong>${order.fulfillmentType.replace('_', '-')}</strong>
              </div>
              <div class="order-row">
                <span>Details:</span>
                <strong>${fulfillmentText[order.fulfillmentType as keyof typeof fulfillmentText]}</strong>
              </div>
              <div class="order-row">
                <span>Date:</span>
                <strong>${new Date(order.bookingDate).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>
            </div>

            <div class="order-info">
              <h3 style="margin-top: 0;">Payment Summary</h3>
              <div class="order-row">
                <span>Subtotal:</span>
                <span>RM ${Number(order.subtotal).toFixed(2)}</span>
              </div>
              <div class="order-row">
                <span>SST (6%):</span>
                <span>RM ${Number(order.sst).toFixed(2)}</span>
              </div>
              ${order.fulfillmentType === 'DELIVERY' ? `
              <div class="order-row">
                <span>Delivery Fee:</span>
                <span>RM ${Number(order.deliveryFee).toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="order-row total">
                <span>Total Paid:</span>
                <span>RM ${Number(order.total).toFixed(2)}</span>
              </div>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>📍 Outlet Address:</strong><br>
              ${order.outlet?.address}<br>
              <strong>📞 Contact:</strong> ${order.outlet?.phone}
            </div>

            ${order.notes ? `
            <div style="background: #e7f3ff; padding: 15px; border-radius: 8px;">
              <strong>📝 Your Notes:</strong><br>
              ${escapeHtml(order.notes || '')}
            </div>
            ` : ''}

            <p style="text-align: center; margin-top: 30px;">
              We look forward to serving you!
            </p>
          </div>
          <div class="footer">
            <p>Ayam Gepuk Pak Antok | Ramadhan 2026</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Ayam Gepuk Pak Antok" <noreply@ayamgepuk.com>',
      to: order.customerEmail,
      subject: `✅ Booking Confirmed - ${order.orderNo}`,
      html,
    });

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Schedule a reminder email 1 hour before booking time
 */
export const scheduleReminder = async (order: Order): Promise<void> => {
  // In production, use a job scheduler like node-cron or Bull
  // For now, we'll use setTimeout for simplicity
  
  const bookingDate = new Date(order.bookingDate);
  let bookingTime: Date;

  if (order.fulfillmentType === 'TAKEAWAY' && order.timeSlot?.time) {
    const [hours, minutes] = order.timeSlot.time.split(':').map(Number);
    bookingTime = new Date(bookingDate);
    bookingTime.setHours(hours, minutes, 0, 0);
  } else if (order.fulfillmentType === 'DINE_IN' && order.timeSlot?.time) {
    const [hours, minutes] = order.timeSlot.time.split(':').map(Number);
    bookingTime = new Date(bookingDate);
    bookingTime.setHours(hours, minutes, 0, 0);
  } else if (order.fulfillmentType === 'DINE_IN') {
    bookingTime = new Date(bookingDate);
    bookingTime.setHours(19, 0, 0, 0);
  } else {
    // For delivery, no specific reminder time
    return;
  }

  // Calculate reminder time (1 hour before)
  const reminderTime = new Date(bookingTime.getTime() - 60 * 60 * 1000);
  const now = new Date();
  const delay = reminderTime.getTime() - now.getTime();

  if (delay > 0) {
    setTimeout(async () => {
      await sendReminderEmail(order);
    }, delay);
  }
};

/**
 * Send reminder email
 */
const sendReminderEmail = async (order: Order): Promise<boolean> => {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FFC107, #FF9800); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: #fff; margin: 0; }
          .content { background: #fff; padding: 30px; border: 1px solid #eee; }
          .reminder-box { background: #fff3cd; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Reminder: 1 Hour to Go!</h1>
          </div>
          <div class="content">
            <p>Assalamualaikum <strong>${escapeHtml(order.customerName)}</strong>,</p>
            <p>This is a friendly reminder about your reservation at <strong>${order.outlet?.name}</strong>.</p>
            
            <div class="reminder-box">
              <h2 style="margin: 0; color: #856404;">Your booking is in 1 hour!</h2>
              <p style="margin: 10px 0 0;">Order: <strong>${order.orderNo}</strong></p>
            </div>

            <p><strong>📍 Address:</strong> ${order.outlet?.address}</p>
            <p><strong>📞 Contact:</strong> ${order.outlet?.phone}</p>

            <p style="text-align: center; margin-top: 30px;">
              See you soon! 🍗
            </p>
          </div>
          <div class="footer">
            <p>Ayam Gepuk Pak Antok | Ramadhan 2026</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Ayam Gepuk Pak Antok" <noreply@ayamgepuk.com>',
      to: order.customerEmail,
      subject: `⏰ Reminder: 1 Hour Until Your Booking - ${order.orderNo}`,
      html,
    });

    return true;
  } catch (error) {
    return false;
  }
};
