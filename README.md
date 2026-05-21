# City Real Space CRM 🏙️

AI-powered Real Estate CRM for City Real Space, Ahmedabad.

---

## ⚡ Quick Start (5 Steps)

### 1. Install dependencies
```bash
cd "crs crm"
npm install
```

### 2. Setup environment variables
Edit `.env.local` and fill in your keys:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/cityrealscrm
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-...
CLOUDINARY_CLOUD_NAME=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
```

### 3. Setup database
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Run development server
```bash
npm run dev
```

### 5. Open browser
```
http://localhost:3000
```

---

## 📁 Project Structure

```
crs crm/
├── app/
│   ├── (auth)/              # Sign in / Sign up pages
│   ├── (dashboard)/         # All CRM pages
│   │   ├── dashboard/       # Main dashboard
│   │   ├── leads/           # Lead management
│   │   ├── properties/      # Property listings
│   │   ├── deals/           # Deal pipeline (Kanban)
│   │   ├── visits/          # Site visit scheduler
│   │   ├── commissions/     # Commission tracker
│   │   ├── reports/         # Analytics & reports
│   │   ├── marketing/       # Campaign management
│   │   ├── ai-assistant/    # AI chat assistant
│   │   └── settings/        # CRM settings
│   ├── api/                 # Backend API routes
│   └── page.tsx             # Landing page
├── lib/
│   ├── prisma.ts            # Database client
│   ├── openai.ts            # AI functions
│   ├── whatsapp.ts          # WhatsApp via Twilio
│   └── cloudinary.ts        # Image upload
├── prisma/
│   ├── schema.prisma        # Full DB schema
│   └── seed.ts              # Demo data seed
└── .env.local               # Environment variables
```

---

## 🔑 Required API Keys

| Service | Where to get |
|---------|-------------|
| Clerk   | https://clerk.com |
| OpenAI  | https://platform.openai.com |
| Cloudinary | https://cloudinary.com |
| Twilio (WhatsApp) | https://twilio.com |
| Google Maps | https://console.cloud.google.com |

---

## 🚀 Modules

1. **Lead Management** – Auto capture, scoring, follow-ups
2. **Property Management** – Commercial & Residential listings
3. **Deal Pipeline** – Drag-and-drop Kanban board
4. **Site Visits** – Schedule, remind, track
5. **Commissions** – Track & generate invoices
6. **Reports** – Revenue, broker performance, funnel
7. **Marketing** – WhatsApp & email campaigns
8. **AI Assistant** – GPT-4o powered chat
9. **Settings** – Integrations, roles, notifications

---

## 🌐 Deploy to Vercel

```bash
npm run build
vercel --prod
```

Set all `.env.local` variables in Vercel dashboard → Settings → Environment Variables.
