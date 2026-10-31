import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
export type Role = 'requester' | 'dispatcher';
export type Session = { role: Role; expires: number };
type Grants = Session & { roles: Role[] };
const sessions = new Map<string, Grants>();
function sessionId(req: Request) { return req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('skybridge_session='))?.slice('skybridge_session='.length); }
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authenticate(role: Role, token: string, req?: Request): string {
  const expected = role === 'dispatcher' ? process.env.DEMO_DISPATCHER_TOKEN : process.env.DEMO_REQUESTER_TOKEN;
  if (!expected || !token || !safeEqual(expected, token)) throw new Error('Invalid demo access code. Open the local access page or ask the room owner for the intended role code.');
  const id = randomBytes(32).toString('hex');
  const previousId = req ? sessionId(req) : undefined;
  const previous = previousId ? sessions.get(previousId) : undefined;
  const roles = new Set<Role>(previous && previous.expires > Date.now() ? previous.roles : []); roles.add(role);
  sessions.set(id, { role, roles: [...roles], expires: Date.now() + 8 * 60 * 60 * 1000 });
  if (previousId) sessions.delete(previousId);
  return id;
}
export function sessionFor(req: Request): Session | undefined {
  const id = sessionId(req);
  const session = id ? sessions.get(id) : undefined;
  if (session && session.expires > Date.now()) {
    const requested = req.get('X-Skybridge-Role') || req.query.role || session.role;
    if ((requested === 'requester' || requested === 'dispatcher') && session.roles.includes(requested)) return { role: requested, expires: session.expires };
    return undefined;
  }
  if (id) sessions.delete(id); return undefined;
}
export function requireRole(req: Request, dispatcher = false): Session {
  const session = sessionFor(req);
  if (!session) throw new Error('Join the room with a demo access code first.');
  if (dispatcher && session.role !== 'dispatcher') throw new Error('Dispatcher permission required. Requesters cannot approve or change fleet state.');
  return session;
}
