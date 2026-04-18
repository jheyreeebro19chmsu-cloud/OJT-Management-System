# OJT DTR System - Supabase Migration Guide

## Quick Start

Your OJT Daily Time Record System now supports both **localStorage** (browser-only) and **Supabase** (cloud database) storage modes. The app automatically detects which mode to use based on your configuration.

## Current Status

✅ **Supabase Client** - Installed and configured  
✅ **Service Layer** - Complete database operations  
✅ **AppContext** - Hybrid storage support  
✅ **Migration Utilities** - Data transfer tools  
✅ **UI Indicators** - Connection status display  

## Storage Modes

### 1. Local Storage Mode (Default)
- **Active when**: No Supabase credentials configured
- **Data location**: Browser localStorage
- **Access**: Single device only
- **Persistence**: Clears when browser cache is cleared
- **Use case**: Testing, development, single-user demos

### 2. Supabase Cloud Mode
- **Active when**: Environment variables configured
- **Data location**: Supabase PostgreSQL database
- **Access**: Multi-device, anywhere with internet
- **Persistence**: Permanent cloud storage
- **Use case**: Production, multi-user, enterprise

## How to Enable Supabase

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Choose organization and set project details:
   - **Name**: OJT DTR System
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your location
5. Wait for project to initialize (~2 minutes)

### Step 2: Get Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (a long JWT token)

### Step 3: Configure Environment

Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: Never commit `.env` to version control!

### Step 4: Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Open the `SUPABASE_SETUP.md` file in this project
3. Copy and run each SQL block in order:
   - Employees table
   - Time Records table
   - Geofence Zones table
   - App Settings table
   - Evaluations table
   - Announcements table
   - Row Level Security policies
   - (Optional) Seed data

### Step 5: Restart Application

```bash
# Stop your development server (Ctrl+C)
# Restart it
npm run dev
# or
yarn dev
```

The app will automatically detect Supabase configuration and switch to cloud mode!

## Verification

After setup, verify the connection:

1. **Login as Admin**:
   - Email: `admin@ojt.com`
   - Password: `admin123`

2. **Go to Settings Page**
   - Look for "Database Connection" section
   - Should show: ✅ "Connected to Supabase"
   - Storage Mode: "Cloud Database"
   - Sync Status: "Real-time"

3. **Test Data Operations**
   - Create a new announcement
   - Add a geofence zone
   - Check Supabase dashboard → Table Editor to see data

## Migrating Existing Data

If you have existing data in localStorage:

### Option 1: Browser Console (Recommended)

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run migration:

```javascript
// Backup current data (optional but recommended)
const backup = window.backupLocalStorage();
console.log(backup); // Copy and save this

// Run migration
const result = await window.migrateToSupabase();
console.log(result);

// If successful, you can clear localStorage
// window.clearLocalStorage(); // CAUTION: This deletes local data!
```

### Option 2: Manual Export/Import

1. **Export from localStorage**:
   - DevTools → Application → Local Storage
   - Copy each key's value
   
2. **Import to Supabase**:
   - Use Supabase dashboard → Table Editor
   - Insert JSON data manually

### Option 3: Keep Both

The app supports running with localStorage even after Supabase is configured. If you want to test both modes:
- Remove `.env` file → Uses localStorage
- Add `.env` file → Uses Supabase

## Data Synchronization

### How It Works

When Supabase is enabled:

1. **On App Load**:
   - Fetches all data from Supabase
   - Populates app state
   - Uses localStorage only for current user session

2. **On Data Changes**:
   - Immediately updates Supabase database
   - Updates local state for instant UI feedback
   - No localStorage writes (except current user)

3. **Multi-Device**:
   - Changes from Device A are in Supabase
   - Device B loads fresh data on page refresh
   - No automatic real-time sync yet (coming soon)

### What Gets Synced

✅ Employees  
✅ Time Records  
✅ Geofence Zones  
✅ App Settings  
✅ Evaluations  
✅ Announcements  

❌ Current User Session (stays in localStorage)

## Features by Storage Mode

| Feature | localStorage | Supabase |
|---------|-------------|----------|
| CRUD Operations | ✅ | ✅ |
| Face Photos | ✅ Base64 | ✅ Base64* |
| Geolocation | ✅ | ✅ |
| Multi-device | ❌ | ✅ |
| Data Persistence | Browser only | Permanent |
| Offline Mode | ✅ | ⚠️ Partial |
| Backup/Restore | Manual | Automatic |
| Reports/Analytics | ✅ | ✅ |

*Note: For production, consider Supabase Storage for images

## Troubleshooting

### App Won't Connect

**Check**:
1. `.env` file exists and has correct values
2. Restart dev server after creating `.env`
3. Supabase project is active (not paused)
4. No typos in environment variable names

**Test Connection**:
```javascript
// In browser console
import { supabase } from './src/app/lib/supabase'
const { data, error } = await supabase.from('employees').select('count')
console.log(data, error)
```

### Data Not Showing

**Check**:
1. Tables exist in Supabase (Table Editor)
2. RLS policies are enabled
3. Check browser console for errors
4. Verify data exists in Supabase

### Migration Errors

Common issues:
- **PGRST116**: Table doesn't exist → Run schema SQL
- **23505 unique violation**: Duplicate IDs → Data already exists
- **42501 insufficient privilege**: RLS issue → Check policies

## Storage Bucket Setup (Optional)

For storing face photos in Supabase Storage instead of Base64:

### 1. Create Storage Bucket

1. Supabase Dashboard → Storage
2. Create bucket: `face-photos`
3. Set as Public or configure policies

### 2. Update Code

```typescript
// In your time record or employee update functions
import { supabase } from '../lib/supabase';

async function uploadFacePhoto(base64: string, fileName: string) {
  // Convert base64 to blob
  const blob = await fetch(base64).then(r => r.blob());
  
  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('face-photos')
    .upload(fileName, blob);
  
  if (error) throw error;
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('face-photos')
    .getPublicUrl(fileName);
  
  return publicUrl;
}
```

## Security Considerations

### Development vs Production

**Current Setup** (Development):
- ✅ Easy to test
- ✅ No authentication required
- ⚠️ Anyone with URL can access
- ⚠️ No role-based access control

**Production Recommendations**:

1. **Enable Supabase Auth**:
   - Use proper login/signup
   - Store user tokens
   - Link employees to auth users

2. **Update RLS Policies**:
   ```sql
   -- Example: Employees can only see their own records
   CREATE POLICY "Users can view own records"
   ON time_records FOR SELECT
   USING (auth.uid() = employee_id);
   ```

3. **Restrict Admin Access**:
   - Create admin role in Supabase
   - Check user role in RLS policies

4. **API Key Security**:
   - Never expose service_role key
   - Use anon key on client
   - Restrict origins in Supabase settings

## Next Steps

### Immediate
- [x] Install Supabase client
- [x] Create service layer
- [x] Update AppContext
- [ ] Set up your Supabase project
- [ ] Run database migrations
- [ ] Test CRUD operations

### Future Enhancements
- [ ] Real-time subscriptions (live updates)
- [ ] Supabase Auth integration
- [ ] Image storage optimization
- [ ] Offline-first with sync queue
- [ ] Role-based access control
- [ ] Audit logs and history
- [ ] Automated backups
- [ ] Analytics dashboard

## Support

### Documentation
- Supabase: [https://supabase.com/docs](https://supabase.com/docs)
- Setup Guide: `SUPABASE_SETUP.md`
- This Guide: `MIGRATION_GUIDE.md`

### Common Commands

```bash
# Check if environment variables are loaded
echo $VITE_SUPABASE_URL

# View environment in runtime
# (In browser console)
console.log(import.meta.env.VITE_SUPABASE_URL)

# Test migration
window.migrateToSupabase()

# Backup data
const backup = window.backupLocalStorage()
```

## Conclusion

Your OJT DTR System is now ready for cloud deployment! The hybrid storage approach means:

- ✅ Works immediately with localStorage (no setup needed)
- ✅ Seamless upgrade to Supabase (when ready)
- ✅ No code changes needed to switch modes
- ✅ Production-ready architecture

Simply add your `.env` file when you're ready to go live!
