# Gold Trading Dashboard Frontend

A React-based dashboard for real-time gold price monitoring and technical indicator visualization.

## Features

- **Real-time Data Streaming**: Connects to the backend via SSE (Server-Sent Events) for live price and indicator updates
- **Smart X-Axis**: Automatically adjusts tick intervals based on visible data range and chart width
- **Dark/Light Theme**: Toggle between dark and light mode
- **Time Range Selection**: View data for 30m, 1h, 3h, 6h, or 24h windows
- **Technical Indicators**:
  - RSI (Relative Strength Index) with overbought/oversold reference lines
  - MACD (Moving Average Convergence Divergence) with signal line and histogram
  - Stochastic oscillator with %K and %D lines
- **Summary Cards**: At-a-glance view of latest price and indicator values
- **Auto-Reconnect**: Automatically reconnects to the server with exponential backoff on connection loss

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Material UI 5** - Component library
- **Recharts** - Chart library
- **Day.js** - Date formatting

## Prerequisites

- Node.js 16+
- Backend server running on port 4000 (see `/server` folder)

## Installation

```bash
cd frontend
npm install
```

## Running the App

### Development Mode

```bash
npm run dev
```

This starts the development server at `http://localhost:5173` with hot module replacement.

### Production Build

```bash
npm run build
```

The built files will be in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

## Configuration

The API URL is configured via environment variables:

- `.env` file contains `VITE_API_URL=http://localhost:4000/api`
- For production, set this to your production API URL

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── charts/
│   │   │   ├── PriceChart.jsx      # Gold price line chart
│   │   │   ├── RSIChart.jsx        # RSI indicator chart
│   │   │   ├── MACDChart.jsx       # MACD composed chart
│   │   │   └── StochasticChart.jsx # Stochastic oscillator chart
│   │   ├── ConnectionStatus.jsx    # Connection status indicator
│   │   ├── IndicatorToggles.jsx    # Indicator visibility controls
│   │   ├── SummaryCards.jsx        # Latest values summary
│   │   └── TimeRangeSelector.jsx   # Time range toggle
│   ├── hooks/
│   │   └── useDataFeed.js          # SSE connection hook
│   ├── utils/
│   │   └── time.js                 # Time utilities & tick step logic
│   ├── App.jsx                     # Main application component
│   ├── main.jsx                    # React entry point
│   └── theme.js                    # MUI theme configuration
├── index.html
├── package.json
├── vite.config.js
└── .env
```

## Usage

1. Start the backend server first (port 4000)
2. Run `npm run dev` in the frontend folder
3. Open `http://localhost:5173` in your browser
4. The dashboard will automatically connect and start displaying real-time data

## Data Update Frequency

The backend streams updates every 60 seconds (1 data point per minute). The frontend buffers up to 2000 data points (~33 hours of data).
