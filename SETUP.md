# BBK website: setup guide

This site lets customers pick a service and time, pay with Stripe, and follow their booking's status. Confirmed bookings go onto your Google Calendar, and times you're busy in Google Calendar are hidden from customers.

## 1. Make it yours (5 minutes)

Open `config/business.ts` and change:
- `name` and `tagline`
- `timeZone` (for example `America/Chicago`)
- `hours` (days and opening times)
- `services` (name, description, price in cents, length in minutes)

## 2. Run it on your computer

Needs Node.js 20 or newer.

```bash
npm install
cp .env.example .env      # then fill in the values below
npx prisma db push        # creates the local database
npm run dev               # open http://localhost:3000
```

Owner dashboard: http://localhost:3000/admin (password is `ADMIN_PASSWORD` in `.env`).

## 3. Stripe keys

Customers enter their card on your own site's payment page. The card fields are Stripe's secure fields, so card numbers go straight to Stripe and never touch your server.

1. Sign in at https://dashboard.stripe.com and turn on **Test mode** (top right) while you try things out.
2. **Developers > API keys**: copy the **Publishable key** into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and the **Secret key** into `STRIPE_SECRET_KEY`.
3. Payment confirmation uses a webhook (Stripe tells the site when a payment succeeds):
   - **On your computer:** install the Stripe CLI and run
     `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
     It prints a `whsec_...` secret: put it in `STRIPE_WEBHOOK_SECRET`.
   - **On the live site:** **Developers > Webhooks > Add endpoint**, URL
     `https://YOUR-SITE/api/stripe/webhook`, events `payment_intent.succeeded` and
     `payment_intent.canceled`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Test card: `4242 4242 4242 4242`, any future date, any CVC, any ZIP.
5. When ready for real money, switch off Test mode and use the live keys and a live webhook.
6. Optional: in **Settings > Payment methods** you can turn on Apple Pay, Google Pay or Link; they appear on the payment page automatically.

How the money flows: booking form > held slot (30 min) > your payment page (`/checkout/...`) > Stripe charges the card > webhook marks the booking Confirmed and adds it to Google Calendar > customer lands on their booking status page.

Refunds: cancel the booking in the owner dashboard (frees the slot and removes the calendar event), then refund it from the Stripe dashboard.

## 4. Google Calendar

The site works without this, but won't see your other appointments.

1. Go to https://console.cloud.google.com, create a project (e.g. "BBK website").
2. **APIs & Services > Library**: enable **Google Calendar API**.
3. **APIs & Services > OAuth consent screen**: choose **External**, fill in the app name and your email, add yourself as a **Test user**, then **Publish app** (so the sign-in doesn't expire after 7 days).
4. **APIs & Services > Credentials > Create credentials > OAuth client ID**, type **Web application**, add the redirect URI `http://localhost:5555/callback`.
5. Put the Client ID and Client secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Run `npm run google:auth`, open the link, sign in with the Google account whose calendar you use, and paste the printed `GOOGLE_REFRESH_TOKEN` into `.env`.
7. `GOOGLE_CALENDAR_ID` can stay `primary`, or use a specific calendar's ID (Google Calendar > Settings > the calendar > "Calendar ID").

## 5. Put it online (Render)

The repo includes `render.yaml`, which sets up one web service with a 1 GB disk for the database (Render's Starter plan, about $7.25 a month in total). The free plan has no disk, so bookings would be lost on every restart.

1. Push this code to a private GitHub repository.
2. In Render, choose **New > Blueprint**, pick the repository, and Render reads `render.yaml`.
3. When asked, fill in `ADMIN_PASSWORD` (your owner dashboard password) and your Stripe keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). Leave `STRIPE_WEBHOOK_SECRET` and the Google values blank for now if you don't have them yet.
4. After the first deploy, copy your `onrender.com` address and add the Stripe webhook (step 3 above) pointing at `https://YOUR-ADDRESS.onrender.com/api/stripe/webhook`. Paste its signing secret into `STRIPE_WEBHOOK_SECRET` in Render (**Environment** tab). Render redeploys by itself.
5. Run `npm run google:auth` once on your computer (step 4 above) and paste the three Google values into Render's **Environment** tab.
6. Every push to the repository's main branch redeploys the site automatically.

The site uses Render's address automatically. If you add your own domain (Render > **Settings > Custom Domains**), also set `SITE_URL` to it, for example `https://bikesbykyle.com`.

Back up the disk: it holds every booking and customer account. Render's Starter plan keeps daily disk snapshots.

## How it works

- **Booking:** a customer picks a time; the slot is held for 30 minutes while they pay on the site's payment page. If they don't pay, it frees up.
- **Pay at pickup:** customers can choose this instead of paying online. The booking is confirmed right away and shows "Due at pickup" in your dashboard; press **Mark paid** once they pay you in person (you can adjust the tip there).
- **Tips:** customers can add no tip, 10%, 15%, 20% or a custom amount, both on the online payment page and when choosing pay at pickup. Online tips are charged with the service; Stripe receipts show the total.
- **Payment:** when Stripe confirms payment, the booking becomes Confirmed and is added to your Google Calendar (the customer gets a calendar invite).
- **Status updates:** after paying, each customer lands on a private booking page (bookmark it). In the dashboard you set the status (Confirmed, In progress, Ready for pickup, Completed, Cancelled) with an optional message, and it shows on that page.

## Customer accounts

- Customers can create an account at `/account/signup` (name, email, phone, bike details, password) and log in at `/account/login`.
- Logged-in customers get their details filled in when booking, and their account page (`/account`) lists past bookings with a "Book again" button.
- Guest bookings made earlier with the same email are linked to the account when it's created.
- Passwords are stored hashed (scrypt). There's no "forgot password" email yet, because the site doesn't send email; that needs an email service such as Resend or Postmark.

## Owner dashboard

Log in at `/admin` with `ADMIN_PASSWORD`. Only someone with that password can see these pages.

- **Bookings:** upcoming bookings, status updates, Mark paid.
- **Metrics:** revenue collected (including tips), revenue after estimated Stripe fees, bookings, average ticket, money still due at pickup, a monthly revenue chart for the last 12 months, and the most-booked services. Switch between 30 days, 90 days, 12 months and all time.
- **Customers:** everyone who has booked (account holders and guests): contact info, saved bike details, number of bookings, total spent and last visit. Search, or download as CSV.

"Profit" on the metrics page is revenue minus estimated Stripe fees (2.9% + 30¢ per online payment, set in `lib/metrics.ts`). It doesn't subtract parts or other costs.
