import { Actor, Persisted, Emittable } from 'terse-sdk/actor';
import { seedRoom, transition, type Command, type RoomState } from './domain.js';

/** Single serialized owner makes fleet allocation and inventory decrement one write. */
export class DispatchRoom extends Actor {
  @Persisted @Emittable state: RoomState = seedRoom(this.id);
  async getSnapshot(): Promise<RoomState> { return this.state; }
  async execute(command: Command): Promise<RoomState> {
    const next = transition(this.state, command);
    this.state = next;
    return this.state;
  }
}
