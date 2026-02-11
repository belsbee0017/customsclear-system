# CustomsClear System - Deployment Guide

## 📋 Pre-Deployment Summary

**Project:** CustomsClear - Formal Entry Processing System  
**Framework:** Next.js 16.1.4 (App Router)  
**Database:** Supabase (PostgreSQL)  
**OCR:** Gemini 2.5 Flash AI  
**Deployment:** Vercel  
**Status:** ✅ Production Ready

---

## 🔐 Required Accounts

### 1. Supabase Account (Database & Auth)
- Already configured: `https://vziasnnzmmuhcuthbxcp.supabase.co`
- Tables: `users`, `document_sets`, `documents`, `extracted_fields`, `audit_logs`
- Storage bucket: `documents`

### 2. Google AI Studio (OCR)
- Get free API key: https://aistudio.google.com/app/apikey
- Free tier: 1500 requests/day
- Already configured in `.env`

### 3. Vercel Account (Hosting)
- Sign up: https://vercel.com
- Connect with GitHub
- Free tier: Unlimited deployments

---

## 🚀 Deployment Steps

### Step 1: Push to GitHub

```bash
# Navigate to project
cd e:\CoreDev\Projects\customsclear-system

# Check git status
git status

# If not initialized:
git init
git add .
git commit -m "Production ready: CustomsClear system"

# Add remote (replace with client's repo)
git remote add origin https://github.com/CLIENT_USERNAME/customsclear-system.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

**Option A: Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/new
2. Import Git Repository
3. Select the GitHub repo
4. Framework Preset: **Next.js** (auto-detected)
5. Click **"Deploy"**

**Option B: Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel
```

### Step 3: Configure Environment Variables

**In Vercel Dashboard:**
1. Go to: **Project Settings → Environment Variables**
2. Add these 4 variables for **Production**, **Preview**, and **Development**:

```
NEXT_PUBLIC_SUPABASE_URL=https://vziasnnzmmuhcuthbxcp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aWFzbm56bW11aGN1dGhieGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjAwMjksImV4cCI6MjA4Mzc5NjAyOX0.oPy7geXApOy8Va6e8c5xRaA28VhEN8jDy4QiubmMhWw
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6aWFzbm56bW11aGN1dGhieGNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIyMDAyOSwiZXhwIjoyMDgzNzk2MDI5fQ.LemYmN1BWnHm7VnVC2wCdZ8zEBaemQXdxzdaBrGZfIA
GEMINI_API_KEY=AIzaSyABPI9LCdYc07PP5VgKp3ODzQp5RwWU1jo
```

⚠️ **SECURITY NOTE:** These keys were exposed in chat. Recommend rotating them:
- Supabase: Dashboard → Project Settings → API → Regenerate keys
- Gemini: Delete old key, create new one

### Step 4: Redeploy (after adding env vars)

Click **"Redeploy"** in Vercel Dashboard or run:
```bash
vercel --prod
```

---

## 🧪 Post-Deployment Testing

### Test URLs (replace with your actual Vercel URL):
- Production: `https://customsclear-system.vercel.app`
- Admin: `https://customsclear-system.vercel.app/admin-login`

### Test Accounts (already seeded in Supabase):

| Role | Email | Password | Login URL |
|------|-------|----------|-----------|
| **Broker** | broker@customsclear.local | BrokerSeed2025! | `/login` |
| **Customs Officer** | officer@customsclear.local | OfficerSeed2025! | `/login` |
| **Admin** | admin@customsclear.local | AdminSeed2025! | `/admin-login` |

### Test Flow:

**1. Broker Test:**
```
✓ Login → /broker
✓ Submit Entry → Upload 4 PDFs (GD, Invoice, Packing, AWB)
✓ Review → Click "Run OCR & Auto-Extract"
✓ Fields populate (HS Code, Invoice Number, etc.)
✓ Edit fields → Click "Save Changes"
✓ Check Submission Status → See timestamps in PH time
```

**2. Officer Test:**
```
✓ Login → /officer/home
✓ Submitted Entries → View entry
✓ See extracted fields + validation advice
✓ Compute Entries → Forex rate loads (live USD→PHP)
✓ Compute Preview → See duty, VAT, total tax
✓ Actions: Send Back / Reject / Proceed
```

**3. Admin Test:**
```
✓ Login → /admin
✓ Activity Logs → See all actions with PH timestamps
✓ Broker Approval → Approve/reject pending brokers
```

---

## 📊 System Features (All Working)

### ✅ Broker Side
- Document upload (4 PDFs)
- AI-powered OCR extraction (Gemini 2.5 Flash)
- Field editing and saving
- Submission status tracking
- Timestamps (PH time)

### ✅ Officer Side
- View submitted entries
- Validation advice panel
- **Live forex rate** (USD→PHP from exchangerate-api.io)
- **Tax computation** (correct BOC formula: 0% duty, 12% VAT)
- Officer actions (Send Back / Reject / Proceed)

### ✅ Admin Side
- Broker approval system
- **Activity logs** (all actions tracked with PH timestamps)
- Audit trail

### ✅ Technical
- Middleware (auth token refresh)
- Role-based routing
- Session persistence
- All timestamps in Philippine time
- Real-time forex rates
- Comprehensive activity logging

---

## 🔧 Maintenance Scripts

```bash
# Seed test accounts
npm run seed

# Clear all submissions (reset for testing)
npm run clear-db

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 📝 Database Schema

### Required Tables (already in Supabase):
- `users` — user accounts with roles
- `document_sets` — submission containers
- `documents` — uploaded PDFs
- `extracted_fields` — OCR results
- `audit_logs` — activity tracking
- `validation_results` — validation checks
- `tax_computation` — tax calculations

### Storage:
- Bucket: `documents` (for PDF files)

---

## 🌐 Expected Vercel URLs

After deployment:
- **Production:** `https://customsclear-system.vercel.app`
- **Admin:** `https://customsclear-system.vercel.app/admin-login`
- **API:** `https://customsclear-system.vercel.app/api/*`

---

## 💰 Cost Estimate

### Free Tier (Sufficient for Demo/Testing):
- **Vercel:** Free (hobby plan)
- **Supabase:** Free (500 MB database, 1 GB storage)
- **Gemini AI:** Free (1500 requests/day)
- **Forex API:** Free (unlimited)

### If Scaling to Production:
- **Vercel Pro:** $20/month (team features)
- **Supabase Pro:** $25/month (8 GB database, 100 GB storage)
- **Gemini AI:** Pay-as-you-go (~$0.01-0.02 per document)

**Total for demo/thesis:** $0 (all free tiers)

---

## 🐛 Troubleshooting

### Build Fails on Vercel
- Check: All env vars are set
- Check: No `.env` file committed (it's in `.gitignore`)
- Solution: Redeploy after adding env vars

### Auth Not Working
- Check: Supabase URL and keys are correct
- Check: Middleware is deployed (should see in Vercel logs)
- Solution: Rotate Supabase keys if exposed

### OCR Not Extracting
- Check: `GEMINI_API_KEY` is set in Vercel
- Check: Gemini API quota not exceeded (1500/day)
- Solution: Fallback to pdf-parse works automatically

### Timestamps Wrong
- Check: Browser timezone
- Note: All timestamps display in Philippine time (Asia/Manila)
- Solution: Already configured correctly

---

## 📞 Support Contacts

**For Supabase Issues:**
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs

**For Vercel Issues:**
- Dashboard: https://vercel.com/dashboard
- Docs: https://vercel.com/docs

**For Gemini AI Issues:**
- Console: https://aistudio.google.com
- Docs: https://ai.google.dev/docs

---

## ✅ Ready to Deploy?

**Yes!** Everything is configured and tested. Just:
1. Push to GitHub
2. Import to Vercel
3. Add 4 environment variables
4. Deploy

**Estimated time:** 10-15 minutes total.

**Want me to help with the actual deployment?** I can:
- Generate the exact git commands
- Create a Vercel deployment config
- Write instructions for your client
- Test the deployed version

Just let me know!