import 'dotenv/config';
import { provisionRelay } from '../integrations/relay.js';

try {
  const { relay, agents } = await provisionRelay();
  console.log(`Relay identities ready: ${agents.supply.name}, ${agents.fleet.name}. Credentials saved in the ignored DATA_DIR; no secrets printed.`);
  await relay.events.disconnect();
} catch (error) { console.error('Relay setup failed:', error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]') : 'Unknown error'); process.exitCode = 1; }
