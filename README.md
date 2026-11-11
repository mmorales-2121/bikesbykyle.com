# Bikes By Kyle website

Booking site for Bikes By Kyle, Austin's concierge bike service. Customers pick a service and a time, pay online (Stripe) or at pickup, add a tip, and follow their bike's status. Confirmed bookings go onto Google Calendar. The owner dashboard has bookings, metrics and customers.

Built with Next.js 14, Prisma (SQLite) and Stripe. Services, prices and hours live in `config/business.ts`.

- Run it locally, keys, and deploying to Render: **SETUP.md**
- `preview.html` is the clickable customer preview; `owner-demo.html` is the owner dashboard with sample data.
