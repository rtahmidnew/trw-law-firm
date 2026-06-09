# TRW Law Firm — Deployment Guide
### Complete step-by-step instructions (no coding knowledge required)

---

## What you're setting up

| Service | What it does | Cost |
|---------|-------------|------|
| **Supabase** | Stores all your data, handles logins, stores uploaded files | Free (up to 500MB) |
| **Vercel** | Hosts the website so everyone can access it | Free |
| **GitHub** | Stores the code (Vercel reads from here) | Free |

Total cost: **$0** to start. Supabase's free tier covers a firm your size easily.

---

## PART 1 — Set up Supabase (your database & backend)

### Step 1: Create a Supabase account
1. Go to **https://supabase.com**
2. Click **"Start your project"** → sign up with Google or email
3. Click **"New project"**
4. Fill in:
   - **Organization**: TRW Law Firm
   - **Project name**: trw-law-firm
   - **Database password**: Choose a strong password and **save it somewhere safe**
   - **Region**: Choose **Southeast Asia (Singapore)** — closest to Bangladesh
5. Click **"Create new project"** — wait 1–2 minutes for it to set up

### Step 2: Run the database schema
1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase/schema.sql` from the project folder
4. Copy the **entire contents** of that file
5. Paste it into the SQL Editor
6. Click the **"Run"** button (green button, or press Ctrl+Enter)
7. You should see "Success" — your database tables are now created

### Step 3: Get your API keys
1. In Supabase, click **"Project Settings"** (gear icon) in the left sidebar
2. Click **"API"**
3. You will see:
   - **Project URL** — looks like `https://xxxxxxxx.supabase.co`
   - **anon public** key — a long string of letters and numbers
4. Copy both of these — you'll need them in Part 3

---

## PART 2 — Put the code on GitHub

### Step 1: Create a GitHub account
1. Go to **https://github.com**
2. Click **"Sign up"** → create a free account

### Step 2: Create a new repository
1. Once logged in, click the **"+"** icon (top right) → **"New repository"**
2. Name it: `trw-law-firm`
3. Set it to **Private**
4. Click **"Create repository"**

### Step 3: Upload the code
1. On the new repository page, click **"uploading an existing file"**
2. Drag and drop the entire `trw-law-firm` folder contents (all files inside it)
3. Scroll down, click **"Commit changes"**

> **Tip**: If you have trouble uploading folders, download and install **GitHub Desktop** from https://desktop.github.com — it makes uploading folders much easier with drag-and-drop.

---

## PART 3 — Deploy on Vercel (makes the app live on the internet)

### Step 1: Create a Vercel account
1. Go to **https://vercel.com**
2. Click **"Sign Up"** → choose **"Continue with GitHub"** — this links them together

### Step 2: Import your project
1. Click **"Add New..."** → **"Project"**
2. Find `trw-law-firm` in the list → click **"Import"**
3. Vercel will auto-detect it as a Next.js project
4. Before clicking Deploy, click **"Environment Variables"**

### Step 3: Add your environment variables
Add these two variables (you got these in Part 1, Step 3):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon public key |

Click **"Add"** after each one.

### Step 4: Deploy
1. Click **"Deploy"**
2. Wait 2–3 minutes — Vercel builds and deploys your app
3. When done, you'll see a green checkmark and a URL like `trw-law-firm.vercel.app`
4. **That URL is your app** — share it with your team!

### Step 5 (Optional): Add a custom domain
If you want `app.trwlaw.com` instead of `trw-law-firm.vercel.app`:
1. In Vercel, go to your project → **"Settings"** → **"Domains"**
2. Add your domain and follow the DNS instructions

---

## PART 4 — Add your team members

Each associate and partner needs an account. You create these manually through Supabase.

### Step 1: Invite a user via Supabase Auth
1. In Supabase, go to **"Authentication"** → **"Users"** in the left sidebar
2. Click **"Invite user"**
3. Enter their email address → click **"Send invitation"**
4. They receive an email to set their password

### Step 2: Set their role in the database
After they accept the invitation, you need to set whether they're an associate or partner:

1. In Supabase, go to **"Table Editor"** → click the **"profiles"** table
2. Find the new user's row
3. Click on the **"role"** field
4. Type either `associate` or `partner`
5. Click outside to save

**Partners to set as `partner`:** Tahmidur, Syed Wahid, Remura Mahbub  
**Everyone else:** set as `associate`

---

## PART 5 — Daily usage guide

### For Associates:
1. Go to your app URL → log in
2. **To open a new case**: Click "Open New Case" → fill in the details
3. **To update a case**: Click the case → use the Timeline tab to add updates
4. **To upload documents**: Click the case → Documents tab → "Choose Files"
5. **To add deadlines**: Click the case → Deadlines tab → "+ Add Deadline"

### For Partners (you, Syed Wahid, Remura Mahbub):
1. Log in → you'll land on the **Partner Overview** page
2. **See all associates**: Left panel shows each associate and their case count
3. **Drill into an associate**: Click their name → see all their cases
4. **See all cases at once**: Click "All Cases" in the top navigation
5. **View a case's full history**: Click any case → Timeline / Documents / Deadlines tabs
6. Partners can view everything but cannot accidentally edit or delete associates' work

---

## Troubleshooting

**"Error: Invalid API key"**
→ Check that your environment variables in Vercel match exactly what's in Supabase (no extra spaces)

**User can log in but sees nothing**
→ Check their role in the `profiles` table in Supabase — it must be exactly `associate` or `partner` (lowercase)

**File upload not working**
→ Make sure the `case-documents` storage bucket was created. In Supabase → Storage — you should see it listed.

**Need to reset someone's password**
→ In Supabase → Authentication → Users → find the user → click the three-dot menu → "Send password recovery"

---

## Getting help

If you get stuck at any step:
- Supabase docs: https://supabase.com/docs
- Vercel docs: https://vercel.com/docs
- Or bring this guide + the error message back to Claude for help
