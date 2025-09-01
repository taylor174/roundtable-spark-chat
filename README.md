# Classroom Sessions

Interactive group discussion and decision-making tool for classrooms.

## 🚀 Quick Deploy

**New to this project?** Check out `GIFT-SETUP.md` for a simple 30-minute setup guide!

### Deploy to Production

#### Option 1: Vercel (Recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/classroom-sessions&env=VITE_SUPABASE_PROJECT_ID,VITE_SUPABASE_PUBLISHABLE_KEY,VITE_SUPABASE_URL&envDescription=Supabase%20credentials%20for%20your%20project&envLink=https://supabase.com/dashboard)

#### Option 2: Netlify
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/your-username/classroom-sessions)

#### Option 3: Other Platforms
- **Railway**: Connect your GitHub repo and deploy
- **Render**: Static site deployment from GitHub
- **GitHub Pages**: For static hosting (requires build setup)

## 🛠️ Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16 or higher)
- [Supabase account](https://supabase.com) (free tier available)

### 1. Backend Setup (Supabase)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and sign up
   - Click "New Project"
   - Choose your organization, project name, and region
   - Set a strong database password
   - Wait 2-3 minutes for setup

2. **Set Up Database**
   - Go to SQL Editor in your Supabase dashboard
   - Copy contents of `database-schema.sql` and run it
   - This creates all tables, policies, and functions needed

3. **Get Your Credentials**
   - Go to Settings > API in your Supabase project
   - Copy your Project URL and Anon Key
   - Note your Project Reference ID from Settings > General

### 2. Environment Configuration

1. **Copy Environment Template**
   ```bash
   cp .env.example .env
   ```

2. **Update Your Credentials**
   ```env
   VITE_SUPABASE_PROJECT_ID="your-project-reference-id"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key-here"
   VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
   ```

### 3. Local Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:8080`

## 📚 Complete Setup Guide

For detailed step-by-step instructions, see:
- `GIFT-SETUP.md` - Simple 30-minute setup guide
- `setup-database.md` - Detailed database configuration
- `database-schema.sql` - Complete database schema

## 🔧 Configuration Options

### Supabase Settings

**Optional Configurations:**
- **Email Confirmation**: Disable in Auth > Settings for faster testing
- **Email Templates**: Customize in Auth > Templates  
- **RLS Policies**: Already configured for security

### App Settings

You can customize default values in `src/constants/index.ts`:
- `DEFAULT_SUGGEST_SEC`: Suggestion phase duration (default: 120s)
- `DEFAULT_VOTE_SEC`: Voting phase duration (default: 60s)
- `MAX_SUGGESTION_LENGTH`: Maximum suggestion length (default: 1000 chars)

## Instructor Run-sheet

### Step 1: Create Session
1. Open the app homepage
2. Click "Create New Session" 
3. Enter session title (e.g., "Brainstorming Ideas")
4. Set timing: 
   - Suggestion phase: 120 seconds (default)
   - Voting phase: 60 seconds (default)
5. Click "Create Session"
6. **Copy the session code** (e.g., ABC123) to share with students

### Step 2: Share with Students
1. Give students the session code
2. Students visit the app and enter the code
3. Students enter their name and join
4. Wait for all students to join (you'll see the participant count)

### Step 3: Start Suggestions
1. Click "Start Session" in the host controls
2. Timer starts automatically
3. Students can submit their ideas
4. Add time (+15s) if needed using host controls
5. Skip to voting early if everyone has submitted

### Step 4: Start Voting
1. Voting phase starts automatically when suggestion time ends
2. Students vote on their favorite ideas
3. Add time (+15s) if needed
4. Skip to results early if everyone has voted

### Step 5: Handle Results
- **Single Winner**: Automatically moves to timeline and prepares next round
- **Tie**: You'll see a tie-breaker dialog to pick the winner
  1. Review tied suggestions
  2. Select the winner
  3. Winner gets added to timeline

### Step 6: Continue or End
- **Next Round**: Click "Start Next Round" to continue with a new topic
- **End Session**: Use host controls to close the session
- **View Timeline**: See all winning ideas from each round

## 🔒 Security & Production Notes

### Current Security Model
This app uses a guest-friendly approach optimized for classroom use:
- **No signup required** for students (join with name only)
- **Host controls** secured with secret tokens
- **RLS policies** protect data access appropriately
- **Real-time updates** work seamlessly for all users

### Production Considerations
For large-scale deployment, consider:
- **Rate limiting** for session creation
- **Cleanup jobs** for old sessions (see `cleanup_stale_rounds()` function)
- **Monitoring** through Supabase dashboard
- **Backup strategy** for important session data

### Optional Authentication
While not required, you can add full user authentication:
- Uncomment auth-related components in the codebase
- Enable email verification in Supabase Auth settings
- Add user profile management features

## Features

- **Guest Participation**: Students join with just a name, no signup required
- **Real-time Updates**: All participants see live updates
- **Automatic Progression**: Phases advance automatically with timers
- **Tie-breaking**: Host can resolve voting ties
- **Timeline**: Track winning ideas across multiple rounds
- **Mobile Friendly**: Works on phones and tablets
- **Host Controls**: Add time, skip phases, end sessions

## 🏗️ Technical Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling with design system
- **Vite** for fast development and building
- **Shadcn/ui** for component library
- **React Router** for navigation

### Backend
- **Supabase** for database, auth, and real-time
- **PostgreSQL** with Row Level Security
- **Real-time subscriptions** for live updates
- **Edge Functions** for advanced operations

### Deployment
- **Vercel/Netlify** for frontend hosting
- **Supabase** for backend infrastructure
- **GitHub** for version control and CI/CD

## 🚀 Deployment Guide

### Step 1: Prepare for Deployment

1. **Test Locally First**
   ```bash
   npm run build
   npm run preview
   ```

2. **Verify Environment Variables**
   - Ensure `.env` has correct Supabase credentials
   - Test all major features work

### Step 2: Deploy Frontend

**Using Vercel:**
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on every push

**Using Netlify:**
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in site settings

**Manual Deployment:**
```bash
npm run build
# Upload 'dist' folder to your hosting provider
```

### Step 3: Configure Domain (Optional)

1. Add your custom domain in hosting platform settings
2. Configure DNS records as instructed
3. Enable HTTPS (usually automatic)

## 🔧 Troubleshooting

### Common Issues

**"Failed to connect to Supabase"**
- Check your environment variables are correct
- Verify Supabase project is active (not paused)
- Ensure anon key has proper permissions

**"Database functions not found"**
- Re-run `database-schema.sql` in Supabase SQL Editor
- Check Functions section in Supabase dashboard

**Real-time updates not working**
- Verify RLS policies are properly set
- Check Supabase real-time settings
- Ensure network allows WebSocket connections

**Build failures**
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check Node.js version (requires 16+)
- Verify all environment variables are set

### Getting Help

1. Check the Supabase project logs
2. Use browser developer tools to check console errors
3. Verify database schema matches `database-schema.sql`
4. Test with a fresh Supabase project if issues persist

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push and create a pull request

## 📄 License

This project is open source and available under the MIT License.