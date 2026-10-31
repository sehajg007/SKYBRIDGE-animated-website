import 'dotenv/config';
import { smokeModel } from '../agents/model.js';
try { console.log('Live OpenAI response verified:', JSON.stringify(await smokeModel())); }
catch (error) { console.error('Model smoke test FAILED:', error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]') : 'Unknown error'); process.exitCode = 1; }
