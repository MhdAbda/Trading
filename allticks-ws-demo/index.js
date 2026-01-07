import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

const TOKEN = process.env.ALLTICK_TOKEN;
if (!TOKEN) {
  console.error('Missing ALLTICK_TOKEN env var. Set it to your Alltick token before running.');
  process.exit(1);
}

const SYMBOLS = (process.env.ALLTICK_SYMBOLS || 'GOLD')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const WS_URL = `wss://quote.alltick.co/quote-b-ws-api?token=${encodeURIComponent(TOKEN)}`;
let heartbeatTimer;

console.log(`\n=== Alltick WebSocket Configuration ===`);
console.log(`URL: ${WS_URL}`);
console.log(`Symbols: ${SYMBOLS.join(', ')}`);
console.log(`Token: ${TOKEN.slice(0, 10)}...${TOKEN.slice(-5)}`);
console.log(`=====================================\n`);

function buildSubscription(seqId) {
  return {
    cmd_id: 22004,
    seq_id: seqId,
    trace: `sub-${seqId}`,
    data: {
      symbol_list: SYMBOLS.map((code) => ({ code })),
    },
  };
}

function buildHeartbeat(seqId) {
  return {
    cmd_id: 22000,
    seq_id: seqId,
    trace: `hb-${seqId}`,
    data: {},
  };
}

function logTick(tick) {
  const { code, price, volume, tick_time: tickTime, trade_direction: direction } = tick;
  const ts = tickTime ? new Date(Number(tickTime)).toISOString() : 'n/a';
  const side = direction === 1 ? 'BUY' : direction === 2 ? 'SELL' : 'N/A';
  console.log(`[tick] ${code} price=${price} volume=${volume} time=${ts} side=${side}`);
}

console.log(`Connecting to ${WS_URL}`);
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✓ WebSocket connected successfully!');
  console.log('Sending subscription request...');
  const subMsg = buildSubscription(Date.now());
  console.log('Subscription payload:', JSON.stringify(subMsg, null, 2));
  ws.send(JSON.stringify(subMsg));

  // Heartbeat per docs: send every 10s to stay connected.
  heartbeatTimer = setInterval(() => {
    const hb = buildHeartbeat(Date.now());
    ws.send(JSON.stringify(hb));
  }, 10_000);
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('← Received:', JSON.stringify(msg, null, 2));
    
    if (msg.cmd_id === 22998 && msg.data) {
      logTick(msg.data);
      return;
    }
    if (msg.cmd_id === 22001) {
      console.log('✓ Heartbeat acknowledged');
      return;
    }
    if (msg.cmd_id === 22005 && msg.ret === 200) {
      console.log('✓ Subscription successful! Waiting for gold price ticks...');
      return;
    }
    if (msg.ret && msg.ret !== 200) {
      console.error('✗ Error response:', msg);
      return;
    }
  } catch (err) {
    console.error('Failed to parse message', err, data.toString());
  }
});

ws.on('close', (code, reason) => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  console.log(`WebSocket closed code=${code} reason=${reason.toString()}`);
});

ws.on('error', (err) => {
  console.error('WebSocket error', err);
});
