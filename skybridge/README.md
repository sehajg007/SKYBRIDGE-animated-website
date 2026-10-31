# SKYBRIDGE

Critical deliveries. Coordinated.

A new Haunted Hacks prototype for urgent **fictional medical-supply delivery coordination**. Supply and Fleet workers propose a constrained aircraft plan; a dispatcher approves the exact version. Grounding an aircraft invalidates old approvals and triggers a human-requested replan.

Start with [START-HERE.md](START-HERE.md). The presentation is in [DEMO.md](DEMO.md); submission drafts are in [SUBMISSION.md](SUBMISSION.md).

## Run

Windows: double-click `START-DEMO.cmd`, or run these from this folder:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run build
npm.cmd run launch
```

Node 22.12+ is required for the build tools. The exact Bun 1.4.4 runtime is installed locally as a project dependency, so a global Bun install is unnecessary. This avoids an observed `tsx`/Node26 Windows account-lookup failure. The server is a long-running Express application using Node-compatible APIs, executed by Bun.

Setup creates private `.env` and `.data/access.html`, generating random demo role credentials. The launcher opens a dispatcher link; the local access page opens the requester. Role credentials are exchanged for HttpOnly, SameSite cookies and immediately removed from the URL fragment. Only a nonsecret per-tab role preference is saved in sessionStorage. Selecting a role does not grant permission: the server verifies the matching credential. Two role tabs can share the same browser cookie while retaining separately selected roles. Sessions expire after eight hours and are lost on server restart.

The default `.env.example` explicitly selects **fixture state and fixture planning** so the UI can be rehearsed immediately. This is labeled on screen and is not a live sponsor/model integration. No failure silently switches to fixtures.

## Connect live services

1. Read [TERSE-DEPLOY.md](TERSE-DEPLOY.md). Publish the self-contained `actor/` project through Terse, or start its native runtime on Mac/Linux. Windows can call a hosted actor but cannot run the pinned native runtime.
2. Set `STATE_BACKEND=terse`, the actual full `TERSE_ACTOR_URL`, and the issued `TERSE_API_KEY`.
3. Set `OPENAI_API_KEY` and `OPENAI_MODEL` to a model available to your event key.
4. Run `npm run setup:relay` for a new Relay workspace, or set `RELAY_WORKSPACE_KEY`. This project's independent live smoke checks have already created a private workspace locally; existing identities/tokens are reconnected rather than re-registered.
5. Run `npm run smoke:terse`, `npm run smoke:model`, and `npm run smoke:relay`.
6. Set `INTEGRATION_MODE=live` and restart. Actual model and Relay round trips must succeed before their health indicators say connected. Missing credentials or errors leave planning unavailable; resources are never dispatched automatically.

Supported modes: `STATE_BACKEND=fixture|terse`, `INTEGRATION_MODE=fixture|live`. They are independent; a hybrid mode is allowed but remains clearly disclosed. Keep all keys in server environment variables. No `VITE_` secret variables are used. `DATA_DIR` defaults to `.data`, `ROOM_ID` to `demo`, `HOST` to `127.0.0.1`, and `PORT` to `3001`.

## Architecture

```text
Two browser roles — React + Vite
  HTTP commands + live server-sent events
             │
Express API — verified role sessions and command schemas
  ├── Terse DispatchRoom: single persisted room and serialized transitions
  ├── Supply worker → actual Relay DM → Fleet worker
  │                                   → live OpenAI constrained response
  └── Supply worker ← actual Relay reply
                      → live OpenAI reconciliation → version-checked proposal
```

The two workers are distinct model-backed application workers co-hosted in one long-running process, with different Relay identities and instructions. Fleet evaluates code-validated candidates; Supply reconciles its returned findings with inventory and the receiving window. They act on **received authenticated Relay messages**, not dashboard text pretending to be a message. Each envelope carries room, epoch, request, run and world version. The timeline stores actual service message IDs. A bounded recovery loop reads actual Relay DM history if WebSocket notifications are missed. No infinite agent conversation is permitted.

The model supplies selection/explanation from known feasible candidates. Plain TypeScript independently enforces stock, payload, full round-trip distance budget, deadlines and resource conflicts. A model response never authorizes a dispatch. Malformed, out-of-set, refusal/empty and stale outputs fail safely.

Terse `DispatchRoom` owns all room state in one `@Persisted` field. `execute(command)` computes and validates the entire next state before one persisted reassignment. This keeps inventory and aircraft allocation together without cross-actor coordination. Model and Relay waits occur outside actor mutations. The app prefers the generated Terse client, with the official `terse-sdk/actors` provider-aware RPC stub as an exact SDK fallback. Browser updates are SSE from the backend after authoritative writes; this delivery does not claim direct Terse-to-browser WebSocket subscriptions.

`worldVersion` changes with operational facts, proposal versions identify exact decisions, audit sequence identifies logs, and reset changes the epoch. A new operational version invalidates existing proposals. Approval rechecks current resources and the exact proposal/world versions. Successful command IDs are deduplicated. Two proposals may mention one aircraft, but only one approval can allocate it. Reset and superseded runs reject late replies.

Simulation is authoritative on the server: **Run simulated delivery** advances one simulated minute per 700 real milliseconds. The map uses that explicit simulation clock, not real telemetry. Delivery completion consumes the fictional round-trip distance budget and returns the aircraft to the hub. Planning latency is measured separately in real milliseconds.

## Checks and demos

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run demo
```

`demo` requires a running server and explicitly role-plays a demo dispatcher. By default it completes three reset → Kestrel → grounded → rejected stale approval → Swift → approved exactly once → delivered runs. It prints actual integration status and labels fixture measurements. `DEMO_RUNS=1` shortens it; `DEMO_URL` targets a different running server. Do not run it while rehearsing manually because it deliberately resets the shared room.

Tests cover constraints, stock/range/deadlines, malformed inputs, exact and stale approvals, duplicate commands, contention, resets and delayed replies, user-role authorization, actual HTTP/SSE and fixture persistence across full process restart. See [INTEGRATIONS.md](INTEGRATIONS.md) for observed evidence and gaps.

After a backend crash/restart, interrupted requests remain visible. A dispatcher chooses **Replan from latest state**; old asynchronous runs are not replayed blindly. Refresh/reconnect fetches the current authoritative room. Native Terse restart persistence still needs a supported host and real credentials to verify.

## Hosting

`render.yaml` supplies a Node Web Service blueprint. Select this SKYBRIDGE folder as the repository root, build with `npm ci && npm run build`, and start with `npm start`. The service binds the host-provided `PORT`; set `HOST=0.0.0.0`. Set the actual Terse, Relay, model and demo-role variables in the host dashboard. A static-only deployment cannot run these workers. Hosting/account setup is not automatically verified by the blueprint.

For hosted Relay, preserve identities through `SUPPLY_AGENT_TOKEN` and `FLEET_AGENT_TOKEN` (or persistent private `.data` storage). Ephemeral host storage cannot be relied on for keys. Keep worker processes alive and verify reconnect after any host suspension. The actor is separately deployed on Terse.

`Dockerfile` offers an alternative long-running app container. No Docker build or remote-host deployment has been executed on this Windows machine. Test the returned URL on the teammate's laptop before calling it shared hosting. The local default is loopback only; two local tabs prove two clients, not two computers.

## Source layout

```text
shared/domain.ts          Canonical constraints, fixtures and state transitions
actor/src/actor.ts        Real Terse DispatchRoom actor
actor/src/domain.ts       Generated self-contained actor copy (prepare:actor)
server/index.ts           Express API, roles, SSE, bounded planning and simulation
server/auth.ts            Demo role grants, HttpOnly sessions
server/agents/            Fleet and Supply model-backed workers
server/integrations/      Real Terse, Relay and explicit fixture adapters
server/scripts/           Setup, smoke checks, actor preparation, demo driver
web/                      Responsive React dashboard and schematic map
test/                     Domain, model contract and actual API tests
```

## Verified API sources

Pinned packages: `terse-cli`/`terse-sdk` 0.14.9, `@agent-relay/sdk` 15.0.1, `openai` 7.47.0, Bun 1.4.4. Installed declarations and implementation were inspected, rather than mixing older cached SDK examples.

- [Terse documentation](https://docs.useterse.ai/reference/typescript-sdk)
- [Agent Relay official source](https://github.com/AgentWorkforce/relay)
- [Agent Relay SDK](https://www.npmjs.com/package/@agent-relay/sdk/v/15.0.1)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

No real flights, weather, inventory feeds, airspace verification, hospitals or patient data are connected. No clinical prioritization or production security/compliance claim is made. Customer demand and business impact remain hypotheses.

## Verified hybrid demonstration

`INTEGRATION_MODE=model-local` uses real OpenAI Fleet and Supply coordinator calls, with an explicitly simulated in-process message handoff. It does **not** use Agent Relay for those messages. `STATE_BACKEND=terse` independently uses the real hosted DispatchRoom actor. The dashboard and audit evidence disclose the simulated transport. Use `INTEGRATION_MODE=live` only after `npm run smoke:relay` passes.

Current rehearsal: open the running dashboard on port 3003. Open `.data/access.html` for the two role links. Reset the simulated room as Dispatcher, create one 2 kg North request as Requester, wait for Kestrel, ground Kestrel before approval, replan to Swift, approve the exact proposal, and run simulated delivery. Inspect OpenAI response IDs in the decision log. Restart the app without resetting to show that the hosted actor retains the mission.

Pitch: “Terse persists the mission and validates each state change. Real OpenAI coordinators propose the replacement. Agent Relay delivery is simulated in this run because the live service did not pass connectivity checks. A human approves the updated plan.”
