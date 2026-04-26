# OJT Daily Time Record System

A comprehensive On-the-Job Training (OJT) Daily Time Record System built with React, TypeScript, and Supabase. This mobile-first web application features facial recognition simulation, geofencing, and complete attendance management for trainees and OJT instructors.

## 🌟 Features

### For Trainees/Employees
- ✅ **Employee Registration** - Self-service registration with location capture
- 📸 **Facial Recognition** - Simulated face capture for time-in/out verification
- 📍 **Geofencing** - Location-based attendance with GPS verification
- ⏰ **Time Tracking** - Clock in/out with automatic hour calculation
- 📊 **Personal Dashboard** - View attendance stats and progress
- 📝 **DTR Records** - Complete history of all time entries
- 📢 **Announcements** - Receive important updates from admin
- 👤 **Profile Management** - View personal and training information
- ⭐ **Evaluations** - View end-of-OJT performance evaluations

### For OJT Instructors
- 👥 **Employee Management** - Add, edit, view all trainees
- 📊 **Reports & Analytics** - Attendance trends and statistics
- 🗺️ **Geofence Configuration** - Define allowed training zones
- ⚙️ **System Settings** - Configure work hours, late thresholds
- 📢 **Announcements** - Post updates with targeting and expiry
- ⭐ **Evaluations** - Score trainees on 5 criteria with detailed feedback
- 📈 **DTR Hours Tracking** - Monitor total hours and premises status
- 🔍 **Advanced Filtering** - Filter records by date, employee, status

## 🎯 Key Highlights

### Geofencing System
- Real-time location verification using Browser Geolocation API
- Multiple geofence zones support
- Visual feedback for inside/outside premises
- Blocking system prevents clock-in outside designated zones
- Distance calculation from zone centers

### Facial Recognition (Simulation)
- Camera access via browser MediaDevices API
- Face capture during registration and time recording
- Photo storage with time records
- Verification indicator on DTR entries

### DTR Hour Calculation
- Automatic calculation of work hours
- Tracks time spent inside vs outside premises
- Late detection based on configurable threshold
- Status tracking: present, late, absent, half-day, overtime

### Evaluation System
- 5 criteria scoring: Attendance, Performance, Attitude, Punctuality, Communication
- Automatic overall score calculation
- Grade assignment: Excellent, Very Good, Good, Satisfactory, Needs Improvement
- Detailed strengths, areas for improvement, and recommendations
- Draft and final status for evaluations

### Announcement Management
- Target specific roles: All, Employees, or Admins
- Pin important announcements
- Set expiration dates
- Type indicators: Info, Warning, Success, Urgent

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS 4.0
- **Routing**: React Router 7
- **State Management**: React Context API
- **Database**: Supabase (PostgreSQL) + localStorage fallback
- **UI Components**: Radix UI, Lucide Icons
- **Forms**: React Hook Form
- **Animations**: Motion (Framer Motion)
- **Charts**: Recharts
- **Notifications**: Sonner
- **Date Handling**: date-fns

## 📦 Installation

```bash
# Clone or download the project
cd ojt-dtr-system

# Install dependencies
npm install
# or
yarn install
# or
pnpm install

# Start development server
npm run dev
# or
yarn dev
```

The app will be available at `http://localhost:5173`

## 🔐 Default Credentials

### OJT Instructor Account
- **Email**: `admin@ojt.com`
- **Password**: `admin123`

### Host Supervisor Account
- **Email**: `host.supervisor@ojt.com`
- **Password**: `host123`

### Employee Accounts
- **Email**: `juan.delacruz@email.com` / `maria.santos@email.com`
- **Password**: `ojt2024`

Or register a new employee account from the registration page.

## 🗄️ Database Setup

### Option 1: Local Storage (Default)
The app works out-of-the-box with browser localStorage. No additional setup required.

**Pros**: Instant setup, no configuration needed  
**Cons**: Data only available on one device, clears with browser cache

### Option 2: Supabase Cloud Database (Recommended for Production)

1. **Create Supabase Project**
   - Visit [https://supabase.com](https://supabase.com)
   - Create a new project
   - Copy your Project URL and anon key

2. **Configure Environment Variables**
   ```bash
   # Create .env file in project root
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

3. **Set Up Database Schema**
   - Follow instructions in `SUPABASE_SETUP.md`
   - Run SQL commands in Supabase SQL Editor
   - Tables will be created automatically

4. **Restart Application**
   ```bash
   # Stop and restart your dev server
   npm run dev
   ```

5. **Verify Connection**
   - Login as admin
   - Go to Settings page
   - Check "Database Connection" section
   - Should show "Connected to Supabase" ✅

**Pros**: Multi-device access, permanent storage, cloud backup  
**Cons**: Requires Supabase account and configuration

See `MIGRATION_GUIDE.md` for detailed migration instructions.

## 📱 Mobile Responsive

The application is fully responsive and optimized for mobile devices:
- Touch-friendly interface
- Mobile-first design
- Optimized layouts for phones and tablets
- Camera access on mobile browsers
- GPS/location services on mobile

## 🌐 Browser Support

- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Requires camera and geolocation permissions

## 📂 Project Structure

```
/src
  /app
    /components          # Reusable components
      /ui               # UI component library (Radix)
      AdminLayout.tsx   # Admin navigation layout
      EmployeeLayout.tsx # Employee navigation layout
      FaceCapture.tsx   # Facial recognition component
      GeofenceChecker.tsx # Location verification
    /pages              # Page components
      /admin            # Admin pages
        AdminDashboard.tsx
        AdminEmployees.tsx
        AdminReports.tsx
        AdminGeofence.tsx
        AdminSettings.tsx
        AdminEvaluations.tsx
        AdminAnnouncements.tsx
      Dashboard.tsx     # Employee dashboard
      Login.tsx
      Register.tsx
      TimeRecord.tsx    # Time in/out page
      Records.tsx       # DTR history
      Profile.tsx
    /store
      AppContext.tsx    # Global state management
    /services
      supabaseService.ts # Database operations
    /lib
      supabase.ts       # Supabase client
    /types
      index.ts          # TypeScript interfaces
    /utils
      geo.ts            # Geolocation utilities
      migrateToSupabase.ts # Migration helpers
    routes.ts           # React Router configuration
    App.tsx             # Main app component
  /styles
    tailwind.css        # Tailwind imports
    theme.css           # Custom theme
```

## 🔧 Configuration

### Work Schedule Settings
Configure in Instructor Settings page:
- Work start time (default: 08:00)
- Work end time (default: 17:00)
- Late threshold in minutes (default: 15)

### Geofencing
Configure in Instructor Geofence page:
- Add/edit/delete geofence zones
- Set zone name, address, coordinates
- Define radius in meters
- Enable/disable zones

### Mapbox Map (Live Geofence Map)
To enable the live Mapbox map in Instructor Geofence:
1. Create a Mapbox account and get an access token
2. Add to `.env`:
   `VITE_MAPBOX_TOKEN=your_mapbox_token`
3. Restart the dev server

### Django Media (Face + Attendance Photos)
When the Django backend is running with `VITE_DJANGO_API_URL`, face registration and attendance photos
are stored on the server under `backend/media/`. The API returns image URLs that are saved in the app.

### Verification Options
Toggle in Admin Settings:
- ✅ Geofencing enabled/disabled
- ✅ Facial recognition enabled/disabled

## 📊 Data Models

### Employee
```typescript
{
  id, name, employeeId, email, department, position,
  companyName, supervisorName, schoolName, course,
  startDate, endDate, requiredHours, faceRegistered,
  registrationLocation, registrationAddress, active
}
```

### Time Record
```typescript
{
  id, employeeId, date, timeIn, timeOut,
  timeInLocation, timeOutLocation,
  timeInGeofenced, timeOutGeofenced,
  timeInFaceVerified, timeOutFaceVerified,
  timeInPhoto, timeOutPhoto,
  totalHours, status, notes
}
```

### Evaluation
```typescript
{
  id, employeeId, evaluatedBy,
  attendanceScore, performanceScore, attitudeScore,
  punctualityScore, communicationScore,
  overallScore, grade, strengths,
  areasForImprovement, recommendations,
  evaluatedAt, status
}
```

See `src/app/types/index.ts` for complete type definitions.

## 🚀 Deployment

### Build for Production

```bash
npm run build
# or
yarn build
```

Output will be in the `dist/` directory.

### Deploy Options

1. **Vercel** (Recommended)
   ```bash
   vercel deploy
   ```

2. **Netlify**
   ```bash
   netlify deploy --prod
   ```

3. **Static Hosting**
   - Upload `dist/` folder to any static host
   - Configure environment variables on host

**Important**: Set environment variables on your hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 🔒 Security Notes

### Current Setup (Development)
- Simple password authentication
- Public RLS policies in Supabase
- No rate limiting

### Production Recommendations
1. Implement Supabase Auth
2. Use proper user authentication
3. Restrict RLS policies by user role
4. Add rate limiting
5. Use Supabase Storage for images
6. Enable HTTPS only
7. Set up CORS properly
8. Add input validation

See `MIGRATION_GUIDE.md` → Security Considerations

## 📖 Documentation

- `README.md` - This file (overview and quick start)
- `SUPABASE_SETUP.md` - Complete database schema and setup
- `MIGRATION_GUIDE.md` - Detailed migration from localStorage to Supabase
- `/.env.example` - Environment variable template

## 🐛 Troubleshooting

### Camera not working
- Check browser permissions
- Use HTTPS (required for camera on some browsers)
- Try different browser

### Location not accurate
- Ensure location permissions granted
- Works best outdoors or near windows
- May be less accurate indoors

### Supabase connection issues
- Verify `.env` file exists and has correct values
- Check Supabase project is active
- Restart dev server after changing `.env`
- Check browser console for errors

### Data not persisting
- localStorage: Check browser isn't in private mode
- Supabase: Verify connection status in Settings page

## 🎨 Customization

### Change Theme Colors
Edit `src/styles/theme.css`:
```css
:root {
  --color-primary: your-color;
  --color-secondary: your-color;
}
```

### Modify Geofence Settings
Default zone defined in `src/app/store/AppContext.tsx`:
```typescript
const DEFAULT_GEOFENCE = [
  {
    name: 'Main Training Center',
    lat: 14.5547, // Change coordinates
    lng: 121.0244,
    radius: 300, // Change radius in meters
  }
]
```

### Adjust Required Hours
Edit in Admin > Employees > Edit Employee or during registration.

## 🤝 Contributing

This is a demo/template project. Feel free to:
- Fork and modify for your needs
- Add new features
- Improve existing functionality
- Fix bugs

## 📄 License

This project is provided as-is for educational and demonstration purposes.

## 🙏 Acknowledgments

- Built with [React](https://react.dev)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- Database by [Supabase](https://supabase.com)
- Icons from [Lucide](https://lucide.dev)
- UI components from [Radix UI](https://www.radix-ui.com)

## 📞 Support

For questions or issues:
1. Check documentation files in this project
2. Review browser console for errors
3. Verify Supabase setup if using cloud mode
4. Check that all required permissions are granted

---

**Built for managing OJT trainee attendance with modern web technologies.** 🚀
