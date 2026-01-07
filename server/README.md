# Trading Info Backend

A Node.js/Express backend server that connects to Twelve Data WebSocket API, maintains an in-memory buffer of market data, and exposes HTTP endpoints for accessing real-time and historical intraday data.

## Features

- WebSocket connection to Twelve Data API
- Real-time price streaming via Server-Sent Events (SSE)
- In-memory buffer of recent intraday data
- RESTful API endpoints for market data
- Automatic reconnection with exponential backoff
- Graceful shutdown handling
- CORS enabled for frontend integration
- Extensible architecture for future features (e.g., Telegram alerts)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Twelve Data API key:
   ```
   TWELVE_DATA_API_KEY=your_actual_api_key_here
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `4000` |
| `TWELVE_DATA_API_KEY` | Your Twelve Data API key (required) | - |
| `TWELVE_DATA_WS_URL` | Twelve Data WebSocket URL | `wss://ws.twelvedata.com/v1/quotes/price` |
| `SYMBOL` | Trading symbol to subscribe to | `XAU/USD` |
| `INTERVAL` | Data interval (e.g., `5s`, `1min`) | `5s` |
| `MAX_POINTS` | Maximum number of data points to keep in memory | `2000` |
| `DEBUG` | Enable debug logging | `false` |

## API Endpoints

### Health Check
```bash
GET /api/market/health
```
Returns server and WebSocket connection status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "websocket": {
    "connected": true,
    "connecting": false,
    "reconnectAttempts": 0
  },
  "data": {
    "seriesLength": 150,
    "lastQuoteTime": "2024-01-01T12:00:00.000Z"
  }
}
```

### Latest Quote
```bash
GET /api/market/gold/last-quote
```
Returns the most recent price quote.

**Response:**
```json
{
  "price": 2000.50,
  "time": "2024-01-01T12:00:00.000Z",
  "symbol": "XAU/USD",
  "interval": "5s"
}
```

### Intraday Data
```bash
GET /api/market/gold/intraday
```
Returns the full buffer of recent intraday data.

**Response:**
```json
{
  "symbol": "XAU/USD",
  "interval": "5s",
  "count": 150,
  "maxPoints": 2000,
  "lastUpdate": "2024-01-01T12:00:00.000Z",
  "data": [
    { "time": "2024-01-01T11:00:00.000Z", "price": 2000.00 },
    { "time": "2024-01-01T11:00:05.000Z", "price": 2000.10 },
    ...
  ]
}
```

### Real-time Stream (SSE)
```bash
GET /api/market/gold/stream
```
Server-Sent Events endpoint for streaming real-time price updates.

**Example with curl:**
```bash
curl -N http://localhost:4000/api/market/gold/stream
```

**Example in JavaScript:**
```javascript
const eventSource = new EventSource('http://localhost:4000/api/market/gold/stream');
eventSource.onmessage = (event) => {
  const quote = JSON.parse(event.data);
  console.log('New price:', quote.price);
};
```

## Project Structure

```
src/
├── server.js                 # Main entry point
├── config/
│   └── env.js               # Environment configuration
├── services/
│   └── twelveDataStream.js  # WebSocket connection & data management
├── routes/
│   └── marketDataRoutes.js  # Express API routes
└── utils/
    └── logger.js            # Logging utility
```

## Architecture Notes

### WebSocket Connection
- The `twelveDataStream` service manages the WebSocket connection to Twelve Data
- Automatically subscribes to the configured symbol and interval on connection
- Implements reconnection logic with exponential backoff
- Maintains in-memory buffer of recent price data

### Data Storage
- All data is stored in memory (no database)
- Recent data points are kept up to `MAX_POINTS` limit
- Oldest points are automatically removed when limit is reached

### Extensibility
- The `onTick()` method allows registering callbacks for new price updates
- This enables future features like Telegram alerts or other integrations
- Example:
  ```javascript
  twelveDataStream.onTick((quote) => {
    // Send Telegram alert when price crosses threshold
    if (quote.price > 2100) {
      sendTelegramAlert(quote);
    }
  });
  ```

## Error Handling

- WebSocket connection errors trigger automatic reconnection
- Invalid messages are logged but don't crash the server
- Graceful shutdown on SIGINT/SIGTERM signals
- Uncaught exceptions are logged and trigger shutdown

## Development

The server uses `nodemon` for development, which automatically restarts the server when files change:

```bash
npm run dev
```

## License

ISC

