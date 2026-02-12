1. Technical Stack Overview
The system utilizes a modern JavaScript-based stack to ensure rapid development and seamless integration.

Frontend: Next.js (App Router) – For a responsive, SEO-friendly customer interface.

Backend: Express.js – A lightweight Node.js framework to handle API logic and payment integration.


Database: MySQL – Relational database for structured storage of outlet configurations, table availability, and sales.



Payment Gateway: ToyyibPay API.

Email Service: Nodemailer or SendGrid for automated reminders.

2. Backend Architecture (Express.js + MVC)
The backend is structured using the Model-View-Controller pattern (though the "View" in this case is the JSON API response) to ensure the logic for 5 different outlets remains organized.



Directory Structure

Plaintext
backend/
├── src/
│   ├── config/         # Database connection (MySQL)
│   ├── controllers/    # Request handling (Reservation logic)
│   ├── models/         # MySQL Schemas & Queries (Tables, Orders)
│   ├── routes/         # API Endpoints (Dine-in, Takeaway, Delivery)
│   ├── middlewares/    # Auth (Admin) & SST calculation logic
│   └── utils/          # ToyyibPay & Email helpers
└── server.js
MVC Role Breakdown

Model: Handles direct interaction with MySQL. It manages table availability states and order records per outlet.



Controller: Processes the reservation flow. It validates if the booking is "Same-day only" before proceeding to payment.


Route: Defines paths like /api/v1/reservations/dine-in or /api/v1/admin/sales.



3. Frontend Architecture (Next.js)
The frontend utilizes Next.js for the customer-facing site and the specialized Admin Panel.

Directory Structure

Plaintext
frontend/
├── src/
│   ├── app/            # Pages (Booking, Admin Dashboard)
│   ├── components/     # UI Elements (Table Grid, Outlet Switcher)
│   ├── hooks/          # Custom state for real-time slot checking
│   ├── services/       # API calls to Express backend
│   └── lib/            # Formatting (SST 6% calculations)
4. Database Design (MySQL)
To support 5 outlets and the different fulfillment options, the relational schema is designed for data integrity.


Table	Purpose
Outlets	
Stores name, address, and contact for the 5 locations.

Tables	
Maps table numbers and pax capacity to specific outlets.

Orders	
Central record for Name, Email, Phone, and Fulfillment type.

Time_Slots	
Configurable limits for takeaway orders per time window.

Payments	
Tracks ToyyibPay transaction IDs and payment status.

5. Implementation Workflow
Backend API: Set up Express routes to handle the three fulfillment options: Dine-in, Takeaway, and Delivery.

Payment Integration: Connect the Controller to ToyyibPay to ensure reservations are only confirmed after successful payment.


Frontend State: Use Next.js to build the interactive floor plan (Dine-in) and real-time slot availability display.


Admin Panel: Create the "Master Admin" view to track real-time sales across all outlets.