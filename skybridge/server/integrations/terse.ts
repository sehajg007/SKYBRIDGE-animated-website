import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createActorStub } from 'terse-sdk/actors';
import { seedRoom, transition, type RoomState, type Command } from '../../shared/domain.js';

export interface RoomStore {
  kind: 'terse' | 'fixture';
  getSnapshot(): Promise<RoomState>;
  execute(command: Command): Promise<RoomState>;
  close(): Promise<void>;
}

/** A single serialized owner persists each validated room transition. */
export async function openStore(): Promise<RoomStore> {
  const roomId = process.env.ROOM_ID || 'demo';
  if (process.env.STATE_BACKEND === 'fixture') {
    const directory = resolve(process.env.DATA_DIR || '.data');
    await mkdir(directory, { recursive: true });
    const file = resolve(directory, `room-${roomId.replace(/[^a-z0-9_-]/gi, '_')}.json`);
    let state: RoomState;
    try { state = JSON.parse(await readFile(file, 'utf8')); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; state = seedRoom(roomId); }
    let queue: Promise<unknown> = Promise.resolve();
    return {
      kind: 'fixture',
      async getSnapshot() { await queue; return structuredClone(state); },
      execute(command) {
        const operation = queue.then(async () => {
          const next = transition(state, command);
          await writeFile(`${file}.tmp`, JSON.stringify(next), { mode: 0o600 });
          await rename(`${file}.tmp`, file); state = next;
          return structuredClone(next);
        });
        queue = operation.catch(() => {}); return operation;
      },
      async close() { await queue; },
    };
  }
  if (process.env.STATE_BACKEND && process.env.STATE_BACKEND !== 'terse') throw new Error('STATE_BACKEND must be terse or fixture');
  const generatedFile = resolve(process.env.TERSE_GENERATED_CLIENT || 'server/generated/index.js');
  let room: { getSnapshot(): Promise<RoomState>; execute(command: Command): Promise<RoomState> };
  let generatedExists = false;
  try { await readFile(generatedFile); generatedExists = true; } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  if (generatedExists) {
    const { actors } = await import(pathToFileURL(generatedFile).href);
    if (!actors?.DispatchRoom?.get) throw new Error('Generated Terse contract lacks DispatchRoom. Regenerate against the SKYBRIDGE actor.');
    room = actors.DispatchRoom.get(roomId);
  } else {
    // This is the SDK's documented provider-aware RPC transport, not a guessed REST API.
    // Source client generation is preferred; this also supports hosted access on Windows.
    room = createActorStub('DispatchRoom', roomId, [{ name: 'getSnapshot', result: 'value' }, { name: 'execute', result: 'value' }]);
  }
  await room.getSnapshot();
  return { kind: 'terse', getSnapshot: () => room.getSnapshot(), execute: command => room.execute(command), async close() {} };
}
