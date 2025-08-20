# 🎁 Classroom Sessions - Gift Setup Guide

Welcome! You've received this interactive classroom discussion tool as a gift. Follow this simple guide to set up your own independent version.

## 🚀 Quick Start (30 minutes)

### Step 1: Get Your Own Supabase Backend (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project" and fill in:
   - Project name: `classroom-sessions` (or anything you like)
   - Database password: Choose a strong password
   - Region: Choose closest to your location
3. Wait 2-3 minutes for your project to be created
4. Copy these three values from your project settings:
   - **Project URL** (from Settings > API)
   - **Project Reference ID** (from Settings > General)
   - **Anon Key** (from Settings > API)

### Step 2: Set Up Your Database (10 minutes)

1. In your Supabase project, go to the **SQL Editor**
2. Copy the entire contents of `database-schema.sql` (in this package)
3. Paste it into the SQL Editor and click **Run**
4. You should see "Success. No rows returned" - this means your database is ready!

### Step 3: Configure Your App (5 minutes)

1. Copy `.env.example` to `.env`
2. Replace the placeholder values with your Supabase credentials:
   ```
   VITE_SUPABASE_PROJECT_ID="your-project-reference-id"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
   VITE_SUPABASE_URL="your-project-url"
   ```

### Step 4: Deploy Your App (10 minutes)

**Option A: Vercel (Recommended)**
1. Click this button: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/classroom-sessions)
2. Connect your GitHub account if needed
3. Add your environment variables when prompted
4. Click Deploy!

**Option B: Netlify**
1. Click this button: [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/your-username/classroom-sessions)
2. Connect your GitHub account if needed
3. Add your environment variables in Site Settings > Environment Variables
4. Click Deploy!

**Option C: Run Locally**
```bash
npm install
npm run dev
```

## 🎉 You're Done!

Your classroom sessions app is now live and completely independent! You can:

- Create discussion sessions for your classes
- Have students join with simple codes
- Manage real-time voting and suggestions
- View results and timelines

## 📖 How to Use

Check out the main README.md for detailed instructions on running classroom sessions.

## 🆘 Need Help?

If you run into issues:

1. Check `setup-database.md` for detailed database setup
2. Make sure all environment variables are correct
3. Verify your Supabase project is active (green status)
4. Try refreshing your deployment

## 🔧 Advanced Setup

For more control over your deployment, see the detailed instructions in the main README.md file.

---

**Enjoy your new classroom discussion tool!** 🎓