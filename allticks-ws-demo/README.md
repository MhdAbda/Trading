# Alltick WebSocket Gold Price Demo

A minimal Node script that connects to Alltick's WebSocket endpoint, subscribes to gold prices, and prints live ticks.

## Prerequisites
- Node.js 18+
- An Alltick token (see their token application guide).

## Setup
1) In this folder, install deps:

```
npm install
```

2) Provide your token (and optionally symbols):
- Create a `.env` file or export env vars:

```
ALLTICK_TOKEN=your_token_here
ALLTICK_SYMBOLS=GOLD
```

`ALLTICK_SYMBOLS` accepts a comma-separated list. The default is `GOLD`.

## Run
```
npm start
```
The script connects to `wss://quote.alltick.co/quote-b-ws-api?token=...`, subscribes with `cmd_id` 22004, and keeps the connection alive by sending heartbeat `cmd_id` 22000 every 10 seconds.

Incoming trade ticks (push `cmd_id` 22998) are logged in plain text with price, volume, timestamp, and side.

## Notes
- Each connection supports one active subscription; sending a new subscription overwrites the previous one (per Alltick docs).
- If you stop seeing ticks, check that heartbeats are still acknowledged and re-run to reconnect if needed.
