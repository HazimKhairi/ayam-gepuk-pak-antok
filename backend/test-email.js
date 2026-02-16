const nodemailer = require('nodemailer');
require('dotenv').config();

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

// Test email HTML
const testEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #8f1e1f, #6d1718); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; }
    .content { background: #fff; padding: 30px; border: 1px solid #eee; border-radius: 0 0 10px 10px; }
    .info-box { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8f1e1f; }
    .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍗 SMTP Test Email</h1>
    </div>
    <div class="content">
      <h2>Assalamualaikum Hazim! 👋</h2>

      <div class="success">
        ✅ <strong>SMTP Email System Working Perfectly!</strong>
      </div>

      <p>This is a <strong>test email</strong> from the Ayam Gepuk Pak Antok booking system to verify that the email functionality is working correctly.</p>

      <div class="info-box">
        <h3 style="margin-top: 0;">📧 SMTP Configuration Details:</h3>
        <ul style="margin: 10px 0;">
          <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
          <li><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</li>
          <li><strong>From Email:</strong> ${process.env.SMTP_USER}</li>
          <li><strong>Test Date:</strong> ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</li>
        </ul>
      </div>

      <p>If you received this email, it means:</p>
      <ul>
        <li>✅ SMTP server connection successful</li>
        <li>✅ Gmail authentication working</li>
        <li>✅ Email sending functionality operational</li>
        <li>✅ HTML email rendering properly</li>
      </ul>

      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <strong>📝 Next Steps:</strong><br>
        The booking system will automatically send confirmation emails to customers when they make reservations. No further action needed!
      </div>

      <p style="text-align: center; margin-top: 30px; font-size: 18px;">
        🎉 <strong>Email System Ready!</strong> 🎉
      </p>
    </div>
    <div class="footer">
      <p><strong>Ayam Gepuk Pak Antok</strong> | Ramadhan Booking System 2026</p>
      <p>This is a test email sent from the production server</p>
    </div>
  </div>
</body>
</html>
`;

// Send test email
async function sendTestEmail() {
  try {
    console.log('🚀 Sending test email to hazim4128@gmail.com...');
    console.log('📧 SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM,
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Ayam Gepuk Pak Antok" <ayamgepukpakantok@gmail.com>',
      to: 'hazim4128@gmail.com',
      subject: '✅ SMTP Test Email - Ayam Gepuk Pak Antok Booking System',
      html: testEmailHtml,
    });

    console.log('✅ Email sent successfully!');
    console.log('📬 Message ID:', info.messageId);
    console.log('📊 Response:', info.response);
    console.log('\n🎉 Test completed! Check hazim4128@gmail.com inbox.');
  } catch (error) {
    console.error('❌ Failed to send email:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
sendTestEmail();
