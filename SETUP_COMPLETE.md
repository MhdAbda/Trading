# 🚀 COMPLETE SETUP GUIDE - Gold Analytics Dashboard

## Overview

You now have a complete trading dashboard system:
- **Backend**: Express.js server with Twelve Data WebSocket integration (running on port 4000)
- **Frontend**: React.js dashboard (will run on port 3000)

## Current Status

✅ **Backend**: Running on http://localhost:4000
- WebSocket connected to Twelve Data
- Streaming gold prices every 5 seconds
- Technical indicators ready to serve
- API endpoints exposed for frontend

✅ **Frontend**: Ready to start on http://localhost:3000
- All components created
- API client configured
- Material UI theme setup
- 5 indicator charts implemented

---

## SETUP STEPS

### STEP 1: Keep Backend Running

Your backend is currently running. Keep this terminal open or start it again if needed:

```powershell
cd c:\Users\moham\Documents\GitHub\trading-bot\server
&"C:\Program Files\nodejs\npm.cmd" install
&"C:\Program Files\nodejs\node.exe" src\server.js
```

You should see:
```
[INFO] Server started on port 4000
[INFO] WebSocket connection opened
[INFO] Subscription response: ok
```

### STEP 2: Install Frontend Dependencies

Open a NEW terminal and navigate to frontend:

```powershell
cd c:\Users\moham\Documents\GitHub\trading-bot\frontend
&"C:\Program Files\nodejs\npm.cmd" install
```

This installs React, Material UI, Recharts, and all dependencies.

### STEP 3: Start Frontend Development Server

After npm install completes:

```powershell
npm start
```

Or with full path:

```powershell
&"C:\Program Files\nodejs\npm.cmd" start
```

This will:
- Start React development server on http://localhost:3000
- Automatically open your browser
- Watch for file changes and hot-reload

### STEP 4: View Dashboard

Once both servers are running:
1. Backend: http://localhost:4000 (server only, no UI)
2. Frontend: http://localhost:3000 (dashboard UI)

You should see:
- Gold price chart updating every 10 seconds
- 5 indicator charts (RSI, MACD, Stochastic, SMA, EMA)
- Real-time price and statistics cards
- Connection status indicator

---

## WHAT YOU'RE LOOKING AT

### Main Components

```
Dashboard (src/pages/Dashboard.js)
├── Header - Title and connection status
├── Statistics Cards
│   ├── Current Price ($)
│   ├── 24h Change (%)
│   ├── Data Buffer Size
│   └── Connection Status
├── Main Price Chart
└── Indicator Grids
    ├── RSI (Relative Strength Index)
    ├── MACD (Moving Average Convergence Divergence)
    ├── Stochastic
    ├── SMA (Simple Moving Average)
    └── EMA (Exponential Moving Average)
```

### API Flow

```
Frontend (React)
    ↓
API Client (src/api/client.js)
    ↓
Axios HTTP Requests
    ↓
Backend (Express) on :4000
    ↓
Twelve Data Service
    ↓
WebSocket ← Twelve Data API ← Gold prices & indicators
```

---

## KEY FILES STRUCTURE

### Frontend Root
```
frontend/
├── package.json           ← Dependencies (React, MUI, Recharts, etc)
├── .env.example           ← Environment config template
├── public/
│   └── index.html         ← HTML entry point
└── src/
    ├── index.js           ← React entry point with theme
    ├── App.js             ← Root component
    ├── api/
    │   └── client.js      ← All API calls (MOST IMPORTANT)
    ├── components/
    │   ├── Header.js
    │   ├── StatCard.js
    │   ├── PriceChart.js
    │   └── IndicatorChart.js
    └── pages/
        └── Dashboard.js   ← Main page (MOST IMPORTANT)
```

### Important Files to Review

1. **src/api/client.js** - All API helper functions
2. **src/pages/Dashboard.js** - Main dashboard logic
3. **src/components/IndicatorChart.js** - Reusable chart component
4. **src/index.js** - Theme configuration

---

## CUSTOMIZATION GUIDE

### Change Refresh Interval

Edit `src/pages/Dashboard.js` line ~95:

```javascript
// Current: 10 seconds
const interval = setInterval(fetchAllData, 10000);

// Change to 5 seconds:
const interval = setInterval(fetchAllData, 5000);

// Change to 30 seconds:
const interval = setInterval(fetchAllData, 30000);
```

### Change Backend URL

Create `.env` file in `frontend/` folder:

```
REACT_APP_API_URL=http://localhost:4000/api
```

Or if backend is on different machine:

```
REACT_APP_API_URL=http://192.168.1.100:4000/api
```

### Customize Indicator Periods

Edit `src/pages/Dashboard.js` indicator fetch calls:

```javascript
// RSI with period 14 (default)
const rsi = await apiClient.getRSI(14);

// Change to 21:
const rsi = await apiClient.getRSI(21);

// SMA with window 20 (default)
const sma = await apiClient.getSMA(20);

// Change to 50:
const sma = await apiClient.getSMA(50);
```

### Change Theme Colors

Edit `src/index.js` createTheme section:

```javascript
const theme = createTheme({
  palette: {
    primary: {
      main: '#FFD700', // Gold - change this
    },
    secondary: {
      main: '#1E90FF', // Blue - change this
    },
    background: {
      default: '#0A0E27', // Dark background
      paper: '#1A1F3A',   // Card background
    },
  },
});
```

### Add New Indicator Chart

Example: Add Bollinger Bands

1. First, check if backend has the indicator:
   ```javascript
   // In src/pages/Dashboard.js, add API call:
   const bollinger = await apiClient.getBollingerBands();
   ```

2. Create state for it:
   ```javascript
   const [bollingerData, setBollingerData] = useState({ values: [], current: null });
   ```

3. Add chart to Dashboard:
   ```jsx
   <Grid item xs={12} md={6} lg={4}>
     <IndicatorChart
       title="Bollinger Bands"
       dataKey="bb_upper"
       data={bollingerData.values}
       isLoading={isLoading}
       color="#9D4EDD"
     />
   </Grid>
   ```

---

## TROUBLESHOOTING

### "Cannot GET /" when visiting localhost:3000

**Cause**: Frontend dev server not running

**Solution**:
```powershell
cd frontend
npm start
```

### Charts show "No data available"

**Cause**: Backend has no data yet

**Solutions**:
1. Wait 2-3 minutes for backend to collect data
2. Click the "Refresh" button on dashboard
3. Check backend is actually running and receiving data

### "Failed to fetch" errors in console

**Cause**: Frontend can't reach backend

**Solutions**:
1. Verify backend is running: `npm start` in server folder
2. Check backend is on port 4000: `http://localhost:4000/api/market/health`
3. Verify REACT_APP_API_URL is correct in `.env`
4. Check CORS is enabled in backend (it is)

### Port 3000 already in use

**Cause**: Another process using port 3000

**Solution**:
```powershell
# Use different port
$env:PORT=3001; npm start
```

### Node/npm command not found

**Cause**: Node.js not in PATH

**Solution**: Use full paths:
```powershell
&"C:\Program Files\nodejs\npm.cmd" start
&"C:\Program Files\nodejs\node.exe" src\server.js
```

---

## RUNNING BOTH SERVERS (Recommended Setup)

**Terminal 1 - Backend:**
```powershell
cd c:\Users\moham\Documents\GitHub\trading-bot\server
&"C:\Program Files\nodejs\node.exe" src\server.js
```

**Terminal 2 - Frontend:**
```powershell
cd c:\Users\moham\Documents\GitHub\trading-bot\frontend
npm start
```

Both should run simultaneously:
- Backend: http://localhost:4000
- Frontend: http://localhost:3000

---

## WHAT'S NEXT

1. **Test the Dashboard**
   - View real-time gold prices
   - Watch indicator changes
   - Check responsive design on mobile/tablet

2. **Customize (Optional)**
   - Change colors in theme
   - Add more indicators
   - Adjust refresh intervals
   - Modify chart styling

3. **Production Deployment (Optional)**
   - `npm run build` in frontend
   - Deploy to hosting service (Netlify, Vercel, AWS, etc)

4. **Future Features**
   - Add alerts/notifications
   - Add trading signals
   - Add historical backtesting
   - Add portfolio tracking

---

## FILE SUMMARY

| File | Purpose | Language |
|------|---------|----------|
| `package.json` | Dependencies | JSON |
| `src/index.js` | App entry point with theme | JavaScript |
| `src/App.js` | Root component | JavaScript |
| `src/api/client.js` | All API calls | JavaScript |
| `src/pages/Dashboard.js` | Main dashboard page | JavaScript |
| `src/components/*.js` | Reusable components | JavaScript |
| `public/index.html` | HTML template | HTML |

---

## QUICK START COMMANDS

**One-time setup:**
```powershell
# Terminal 1 - Backend
cd server; npm install
&"C:\Program Files\nodejs\node.exe" src\server.js

# Terminal 2 - Frontend
cd frontend; npm install
npm start
```

**Daily usage (after setup):**
```powershell
# Terminal 1
npm start  # In server folder

# Terminal 2
npm start  # In frontend folder
```

---

## SUCCESS INDICATORS

✅ Backend server displays:
```
[INFO] Server started on port 4000
[INFO] WebSocket connection opened
[INFO] Subscription response: ok
```

✅ Frontend opens in browser with:
- Gold Analytics Dashboard title
- 5 stat cards with data
- Gold price chart with line
- 5 indicator charts below
- "Connected" status indicator
- "Refresh" button works

✅ Charts update every 10 seconds automatically

---

**You're all set!** 🎉 Enjoy your gold trading analytics dashboard!

For issues, check the browser DevTools (F12) → Console tab for JavaScript errors.
