import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.ALLTICK_TOKEN;
if (!TOKEN) {
  console.error('Missing ALLTICK_TOKEN env var');
  process.exit(1);
}

const API_URL = 'https://quote.alltick.co/quote-b-api/latest';
const PROD_CODE = 'GOLD';

console.log(`Testing Alltick HTTP API with token: ${TOKEN.slice(0, 10)}...`);
console.log(`GET ${API_URL}?prod_code=${PROD_CODE}\n`);

try {
  const response = await fetch(`${API_URL}?prod_code=${PROD_CODE}`, {
    headers: {
      'token': TOKEN,
      'Content-Type': 'application/json',
    },
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  
  const data = await response.json();
  console.log('\nResponse:');
  console.log(JSON.stringify(data, null, 2));

  if (response.ok && data.ret === 200) {
    console.log('\n✓ Token is valid and service is reachable!');
    if (data.data?.price) {
      console.log(`Current GOLD price: ${data.data.price}`);
    }
  } else {
    console.log('\n✗ Got a response but may have an issue. Check the response above.');
  }
} catch (err) {
  console.error('\n✗ Connection failed:', err.message);
  console.error('This could be firewall, DNS, or network issues.');
}
