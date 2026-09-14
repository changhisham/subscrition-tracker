# Subscription Payment Tracker

A web-first, mobile-friendly subscription reimbursement tracker for subscriptions such as Netflix, Apple One, Spotify, cloud storage, and other shared services.

The application is designed around one important rule:

> **Each member's subscription amount is manually configurable and is the source of truth.**

Equal splitting is therefore not required. A subscription can have five members paying equally, while an additional member can have a different amount.

## Stack

- React + Vite
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Recharts
- React Router
- Lucide React
- Vercel-ready static deployment

Current Supabase browser configuration uses the project's URL and publishable key. Do **not** put a service-role key in the frontend.

## Features

### Admin

- Email/password login
- Dashboard with monthly and yearly summaries
- Outstanding and overdue payments prominently displayed
- Subscription CRUD
- Member/friend CRUD
- Per-subscription member pricing
- Billing-period generation
- Payment status management:
  - Pending
  - Paid
  - Overdue
  - Waived
- Payment date and amount paid
- Receipt upload to private Supabase Storage
- Reports:
  - Monthly summary
  - Yearly summary
  - Payment history
  - Outstanding payments
  - Overdue payments
  - Friend payment history
  - Subscription summary
  - Subscription cost history
- CSV export for report data
- Settings / profile
- Manual generation of a billing period

### Guest

The database supports a GUEST role, but this release keeps the guest experience intentionally read-only.

A guest can be linked to a `members` record through `profiles.member_id`. Guest policies restrict data to their own member/payment information. Admin-only records remain protected.

## Important business rules

### Individual pricing

A member can have a different amount for every subscription.

Example:

```text
Netflix bill: RM65.90

Ali       RM13.18
Abu       RM13.18
Ahmad     RM13.18
Hassan    RM13.18
Hisham    RM13.18
```

If another person is added:

```text
Sarah     RM8.00
```

the application does not force the total member charges to equal the provider bill. It shows the difference so the admin can understand the situation.

### Historical amounts

When a billing period is generated, the current member amount is copied into `payments.amount_due`.

Changing the member amount later does **not** change previous payment records.

Example:

```text
Jan-Jun: RM13.18
Jul-onward: RM15.00
```

January through June remain RM13.18.

### Joining and leaving

`subscription_members.joined_date` and `left_date` determine whether a member is active for a billing period.

Existing payments are retained when a member leaves.

### Subscription cancellation

Cancelling a subscription does not delete historical billing periods or payments.

## 1. Prerequisites

Install:

- Node.js 20.19+ (or a newer supported Node release)
- npm
- A Supabase account
- A Vercel account if deploying to Vercel

Check:

```bash
node --version
npm --version
```

## 2. Create the Supabase project

1. Open the Supabase dashboard.
2. Create a new project.
3. Wait for the database to finish provisioning.
4. Open **SQL Editor**.

## 3. Create the database

Open:

```text
supabase/migrations/001_initial_schema.sql
```

Copy the entire file into Supabase SQL Editor and run it.

This creates:

- profiles
- members
- subscriptions
- subscription_price_history
- subscription_members
- billing_periods
- payments
- payment_receipts
- report views
- helper functions
- RLS policies
- receipt storage bucket and storage policies

## 4. Create your first Auth user

In Supabase:

1. Open **Authentication**.
2. Open **Users**.
3. Create a user with your email and password.
4. Confirm the user if your project requires email confirmation.

The database trigger creates the matching `profiles` row.

### Make yourself ADMIN

The migration creates profiles with `GUEST` by default.

Run this in SQL Editor:

```sql
update public.profiles
set role = 'ADMIN'
where id = 'YOUR_AUTH_USER_UUID';
```

You can find the UUID in Authentication > Users.

Then log into the application.

## 5. Get Supabase credentials

Open your Supabase project's **Connect** / API settings and copy:

- Project URL
- Publishable key

Create a local file:

```text
.env.local
```

Example:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Do not commit `.env.local`.

## 6. Install and run

From the project root:

```bash
npm install
npm run dev
```

Open the URL shown by Vite, normally:

```text
http://localhost:5173
```

## 7. First-time application setup

After logging in:

### Step A - Add friends

Go to:

```text
Friends
```

Create each friend.

Example:

```text
Ali
Abu
Ahmad
Hassan
```

### Step B - Add subscriptions

Go to:

```text
Subscriptions
```

Create:

```text
Netflix
Provider: Netflix
Price: RM65.90
Billing day: 15
Frequency: Monthly
```

### Step C - Add subscription members

Open the subscription and add members.

Set each member's amount manually.

For example:

```text
Ali      RM13.18
Abu      RM13.18
Ahmad    RM13.18
Hassan   RM13.18
Hisham   RM13.18
```

The page shows:

```text
Provider bill
Member charges
Difference
```

### Step D - Generate a billing period

Open the subscription and choose the billing period action.

The application calls the database function that:

1. Creates the billing period.
2. Finds active members.
3. Copies each member's current amount.
4. Creates a payment record.
5. Prevents duplicate generation for the same subscription/month.

## 8. Payment workflow

Generated payments start as:

```text
PENDING
```

Admin can change them to:

```text
PAID
OVERDUE
WAIVED
```

For a paid payment:

- enter payment date
- enter amount paid
- optionally upload a receipt

The receipt is stored in the private `payment-receipts` bucket.

## 9. Guest setup

Create another Supabase Auth user.

Then connect the user to a member.

Example:

```sql
update public.profiles
set
  role = 'GUEST',
  member_id = 'MEMBER_UUID'
where id = 'AUTH_USER_UUID';
```

The guest can sign in but cannot modify admin data.

## 10. Deploy to Vercel

Push the project to GitHub.

Then:

1. Open Vercel.
2. Add New Project.
3. Import the GitHub repository.
4. Framework preset: **Vite**.
5. Build command:

```bash
npm run build
```

6. Output directory:

```text
dist
```

7. Add environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

8. Deploy.

## 11. Supabase Auth redirect URL

After Vercel deployment, configure Supabase:

**Authentication > URL Configuration**

Set the Site URL to your Vercel URL:

```text
https://your-app.vercel.app
```

Add the same URL to the redirect URLs if required by your authentication flow.

## 12. Test production

Test these cases:

### Admin

- Login
- Dashboard
- Create friend
- Create subscription
- Add member
- Change member amount
- Generate billing period
- Mark payment paid
- Upload receipt
- View reports
- Export CSV

### Guest

- Login
- View own dashboard/payment information
- Attempt to edit data
- Verify admin-only data is unavailable

## 13. Security

This application relies on PostgreSQL Row Level Security.

Do not disable RLS.

Do not put these in frontend environment variables:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Only the publishable/anon key belongs in the browser.

Receipt files are stored in a private bucket and access is controlled by Storage RLS policies.

## 14. Useful SQL

### Find your profile

```sql
select *
from public.profiles
where id = auth.uid();
```

### Make a user admin

```sql
update public.profiles
set role = 'ADMIN'
where id = 'AUTH_USER_UUID';
```

### Make a user guest

```sql
update public.profiles
set role = 'GUEST',
    member_id = 'MEMBER_UUID'
where id = 'AUTH_USER_UUID';
```

### View payment records

```sql
select *
from public.payments
order by due_date desc;
```

### Generate a billing period manually

```sql
select public.generate_billing_period(
  'SUBSCRIPTION_UUID',
  '2026-09-01'
);
```

## 15. Resetting development data

If you are still developing and want to remove application data, use the SQL Editor carefully.

Do not delete Supabase Auth users unless you intentionally want to remove authentication accounts.

## Project structure

```text
subscription-payment-tracker/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── layout/
│   │   └── ui/
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   └── supabase.js
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Friends.jsx
│   │   ├── Login.jsx
│   │   ├── Payments.jsx
│   │   ├── Reports.jsx
│   │   ├── Settings.jsx
│   │   ├── SubscriptionDetails.jsx
│   │   └── Subscriptions.jsx
│   ├── services/
│   │   ├── billing.js
│   │   ├── friends.js
│   │   ├── payments.js
│   │   ├── reports.js
│   │   └── subscriptions.js
│   ├── utils/
│   │   ├── currency.js
│   │   └── dates.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
└── vite.config.js
```

## Troubleshooting

### "Missing Supabase environment variables"

Make sure `.env.local` exists and contains:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Restart Vite after changing environment variables.

### Login works but dashboard is empty

Check that the logged-in user has a profile:

```sql
select *
from public.profiles;
```

Then make sure the user's role is `ADMIN`.

### Permission denied / RLS errors

Check that:

1. The migration was executed completely.
2. RLS policies exist.
3. The user is authenticated.
4. The user's profile role is correct.

### Receipt upload fails

Check that the migration created the `payment-receipts` storage bucket and storage policies.

### Vercel works but local development does not

Check `.env.local`.

### Local works but Vercel does not

Check Vercel > Project > Settings > Environment Variables and make sure both `VITE_*` variables are configured for Production.

## Future upgrades

The database design intentionally leaves room for:

- automated payment reminders
- WhatsApp integration
- email reminders
- recurring background jobs
- PDF reports
- Excel exports
- dashboard notifications
- payment links
- multiple currencies
- prorated first/last billing periods
- service-specific pricing rules
- family/group plans
- audit log
- admin activity history

The current release intentionally keeps reminders out of the core workflow, as requested.
