import 'dotenv/config';
import { openRelayTransport } from '../integrations/relay.js';
let transport: Awaited<ReturnType<typeof openRelayTransport>> | undefined;
try {
  transport = await openRelayTransport();
  const result = await transport.probe();
  console.log('Real Relay received request AND received reply:', JSON.stringify(result));
} catch (error) { console.error('Relay smoke test FAILED:', error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]') : 'Unknown error'); process.exitCode = 1; }
finally { await transport?.close(); }
