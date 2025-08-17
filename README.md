# Classroom Sessions

Interactive group discussion and decision-making tool for classrooms.

## Quick Start

### Environment Setup

This app uses Supabase for the backend. The connection is already configured with these credentials:

- **Supabase URL**: `https://ykhukknbkfwlmstmkcdk.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlraHVra25ia2Z3bG1zdG1rY2RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNzMxNDQsImV4cCI6MjA3MDc0OTE0NH0.JXKccfpha5Zfji8a9bykPbtkLSur2QEOqsk4pD36Yz0`

No additional environment variables are required.

### Installation

```bash
npm install
npm run dev
```

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

## Security Note

This demo version uses relaxed database policies for smooth classroom participation. In a production environment, you should:

- Implement proper user authentication for instructors
- Add stricter access controls for sensitive operations  
- Enable email verification for accounts
- Review and tighten Row Level Security policies

## Features

- **Guest Participation**: Students join with just a name, no signup required
- **Real-time Updates**: All participants see live updates
- **Automatic Progression**: Phases advance automatically with timers
- **Tie-breaking**: Host can resolve voting ties
- **Timeline**: Track winning ideas across multiple rounds
- **Mobile Friendly**: Works on phones and tablets
- **Host Controls**: Add time, skip phases, end sessions

## Technical Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, real-time subscriptions)
- **Hosting**: Vercel