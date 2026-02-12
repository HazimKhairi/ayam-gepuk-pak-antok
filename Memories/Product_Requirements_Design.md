Product Requirements Document: Ramadhan Reservation Website
1.0 Project Overview
The goal of this project is to develop a specialized reservation system to streamline customer orders for Ayam Gepuk Pak Antok across 5 outlets during the Ramadhan season. The system replaces manual WhatsApp handling to improve coordination, reduce no-shows via secured payments, and enhance brand professionalism.





2.0 User Features & Fulfillment Options
The website will be fully responsive for both mobile and desktop users.

2.1 Fulfillment Modules

Feature	Description
Dine-in Booking	
Customers select specific tables based on real-time outlet availability.



Takeaway	
Customers select specific time slots (e.g., 4:00 PM, 4:30 PM) with admin-defined order limits.


Delivery	
Customers provide a delivery address; fees are set by the client and riders are managed manually by outlets.

2.2 General Logic

Same-Day Only: The system only supports bookings for the current day; no advance bookings are permitted.

Payment Integration: All transactions are processed through ToyyibPay.

Automated Notifications: The system sends an immediate confirmation after payment and an email reminder 1 hour before the scheduled time.

3.0 System Architecture & Admin Panel
The system includes a dual-layered administration backend to monitor real-time sales and manage operations.


3.1 Admin Capabilities

Master Admin: Full control and oversight across all 5 outlets.

Outlet Admin: Management restricted to a specific outlet.

Configuration Tools: Ability to set booking open/close times, configure table layouts, and set takeaway time slot limits.



4.0 Reservation Flow
Access: Customer visits the site during active hours (e.g., 10:00 AM – 3:00 PM).

Selection: Customer selects one of the 5 outlets.

Service Choice: Choose between Dine-in, Takeaway, or Delivery.

Specifics: * Dine-in: Select Table.

Takeaway: Select Time Slot.

Delivery: Enter Address.

Details: Input Name, Email, and Phone Number.

Checkout: Complete payment via gateway.

Completion: Receive digital confirmation and subsequent 1-hour reminder.

5.0 Project Execution
5.1 Timeline & Terms

Deadline: Completion is estimated for 3 days before the start of Ramadhan.

Payment: 30% deposit upon confirmation; 70% balance before the site goes live.

5.2 Client Requirements

To begin development, the client must provide:

Full outlet details (names, addresses, and contacts).

Table configurations (pax capacity and table numbers).

Delivery fee structures and takeaway time slot limits.

Daily order opening and closing times.