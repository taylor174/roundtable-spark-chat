# Database Setup Guide

This guide will help you set up the database for your Classroom Sessions app.

## Prerequisites

- A Supabase account (free at [supabase.com](https://supabase.com))
- A new Supabase project created

## Quick Setup

### Step 1: Access SQL Editor

1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New query** to create a new SQL script

### Step 2: Run the Schema Script

1. Copy the entire contents of `database-schema.sql`
2. Paste it into the SQL Editor
3. Click **Run** button (or press Ctrl/Cmd + Enter)
4. Wait for the script to complete (should take 10-30 seconds)

### Step 3: Verify Setup

You should see a success message at the bottom. To verify everything is working:

1. Go to **Table Editor** in the left sidebar
2. You should see these tables:
   - `profiles`
   - `tables` 
   - `participants`
   - `rounds`
   - `suggestions`
   - `votes`
   - `blocks`
   - `chat_messages`

## What the Script Creates

### Tables
- **tables**: Stores classroom session information
- **participants**: Tracks who's in each session
- **rounds**: Manages discussion rounds within sessions
- **suggestions**: Stores student suggestions
- **votes**: Records votes on suggestions
- **blocks**: Timeline of winning ideas
- **profiles**: User profile information
- **chat_messages**: Session chat functionality

### Security Features
- **Row Level Security (RLS)**: Ensures data privacy and proper access control
- **Database Functions**: Handles complex operations like phase transitions
- **Validation**: Prevents invalid data and duplicate votes

### Functions Created
- `start_table_session()`: Initializes new discussion rounds
- `advance_phase_atomic_v2()`: Manages phase transitions (suggest → vote → result)
- `submit_vote_with_validation()`: Validates and records votes
- `update_updated_at_column()`: Automatic timestamp updates

## Troubleshooting

### Common Issues

**Error: "relation already exists"**
- This is normal if running the script multiple times
- The script uses `CREATE TABLE IF NOT EXISTS` to prevent conflicts

**Error: "permission denied"**
- Make sure you're running the script in your own Supabase project
- Verify you have admin access to the project

**Error: "function does not exist"**
- Ensure the entire script completed successfully
- Try running it again - some functions depend on tables being created first

### Verification Steps

1. **Check Tables**: All 8 tables should be visible in Table Editor
2. **Check Functions**: Go to Database > Functions - you should see the created functions
3. **Check RLS**: Go to Authentication > Policies - policies should be listed for each table

### Need Help?

If you encounter issues:

1. Check the Supabase project logs (Logs section in dashboard)
2. Ensure your Supabase project is active (not paused)
3. Try creating a fresh Supabase project and running the script again
4. Make sure you copied the entire `database-schema.sql` file content

## Next Steps

After successful database setup:

1. Update your `.env` file with your Supabase credentials
2. Deploy your application
3. Test by creating a session and having participants join

Your database is now ready to power engaging classroom discussions!