System Design Documentation: Ramadhan Reservation System
This document outlines the design specifications for the Ayam Gepuk Pak Antok Ramadhan Reservation Website. The design prioritizes a clean, modern interface optimized for high-volume bookings across five outlets.


1. Design Philosophy & Visual Theme
The UI follows a "Modern Clean" aesthetic with a focus on high-contrast elements and intuitive navigation to minimize "WhatsApp overload".

Color Palette:

Primary: #FFC107 (Warm Amber/Yellow) – Used for primary CTA buttons and active states to match the brand energy.

Background: #F8F9FA (Off-White/Light Gray) – To ensure text readability and a professional look.

Accents: Dark Slate (#212529) for typography and Soft Red for "Booked" or "Full" statuses.

Typography: Sans-serif fonts (e.g., Inter or Roboto) for a professional, tech-forward customer experience.

Responsiveness: A "Mobile-First" approach ensuring the grid system adapts seamlessly from desktop monitors to smartphone screens.

2. Interface Modules
2.1 Customer Landing Page & Outlet Selection

Header: Features the Ayam Gepuk Pak Antok logo and a persistent outlet switcher.


Service Selector: Large, pill-shaped buttons to toggle between Dine-in, Takeaway, and Delivery.


2.2 Dine-in Booking (Interactive Floor Plan)

Table Grid: A visual representation of the restaurant floor.


Available: White cards with table ID and capacity (e.g., "Table 1A | 4 Pax").


Booked: Grayed-out cards with a red "Booked" badge to prevent double-booking.

Real-time Updates: Table statuses update instantly without page refreshes.

2.3 Takeaway & Delivery UI

Time Slot Grid: For takeaways, slots (e.g., 4:00 PM, 4:30 PM) are displayed as selectable chips.


Address Validation: A streamlined form for delivery with integrated Google Maps API for address accuracy.


3. Admin Dashboard Design
The admin panel is designed for rapid monitoring of daily operations.

3.1 Layout Components

Sidebar Navigation: Icons for Dashboard, Orders, Table Management, and Settings.

Sales Analytics: A "Reservation per Week" bar chart to track outlet performance and occupancy trends.

Order Sidebar: A persistent right-hand panel showing "Reservation Data" for the currently selected order, including customer name, phone, and payment status (via ToyyibPay).



4. Technical Workflow Design
Stage	UI Component	Backend Action
Selection	
Outlet & Fulfillment Toggle 

Fetch real-time availability for the selected outlet.

Booking	
Table/Slot Picker 

Temporary "lock" on the table/slot for 10 minutes.
Checkout	
Payment Form 

Redirect to ToyyibPay Secure Gateway.

Confirmation	
Success State 

Trigger automated Email confirmation and schedule 1-hour reminder.

5. System Constraints & Rules
Order Window: System automatically locks/unlocks based on configured "Open/Close" times (e.g., 10:00 AM – 3:00 PM).


Booking Limit: Customers can only book for the current date (Same-day only).

Tax Calculation: All summaries will automatically calculate 6% SST.