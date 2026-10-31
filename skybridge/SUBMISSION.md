# SKYBRIDGE — submission drafts

Use the live Builderbase form as the authority for required fields. These drafts are preparation material, not a submitted entry. Do not paste a full-integration claim until the corresponding services have actually powered a successful run.

## Project name

SKYBRIDGE

## Tagline

Critical deliveries. Coordinated.

## One-sentence pitch

SKYBRIDGE keeps urgent supply deliveries coordinated when aircraft, inventory or delivery conditions change.

## Short description — use after the full integration works

SKYBRIDGE is a shared dispatch prototype for urgent medical supplies. Supply and Fleet AI agents coordinate inventory and aircraft constraints through Agent Relay. Terse Durable Actors preserve the operational state and enforce version-checked human approval. Grounding a proposed aircraft invalidates the old plan and triggers a new planning run. Every facility, aircraft, package and flight input is fictional; no real dispatch occurs.

## Short description — truthful development-fixture version

SKYBRIDGE demonstrates urgent supply-delivery coordination in a shared simulated dispatch room. A person requests a package, reviews a feasible aircraft plan, grounds the proposed aircraft and approves a replacement. The working fixture demonstrates state-version checks, resource allocation and human approval. Real Agent Relay exchanges have been smoke-tested separately; live model and Terse connectivity remain pending. The demo labels these limits visibly and performs no real dispatch.

If some integrations become verified, revise that final paragraph to state exactly what powered the submitted run. A successful SDK inspection or send acknowledgement alone does not prove a completed integration.

## Problem

A dispatch plan can become invalid between planning and execution. Stock, aircraft availability, package constraints and receiving deadlines need to agree before a person authorizes delivery. We are exploring a shared workflow that makes those constraints and changes visible instead of leaving the dispatcher to reconcile disconnected updates.

## What it does

A requester submits a fictional supply need. The planning workflow checks package weight, inventory, round-trip range, aircraft status and the entered deadline. A dispatcher reviews the exact proposal. Grounding the proposed aircraft makes that proposal stale; replanning finds a feasible replacement or explicitly escalates when none exists. Approval checks the latest state and allocates stock and aircraft together. A separate, labeled simulation clock drives the delivery demonstration.

## What makes the demo distinctive

The central interaction is a plan becoming invalid before dispatch. The system must reconcile the changed constraints and obtain new approval. Drone delivery itself is not the claimed invention. The contribution is coordination, visible recovery and exact-plan human authorization.

## How it is built

The UI is React and TypeScript with an SVG schematic map. A long-running Node/Express server serves the dashboard, checks demo-role sessions and runs the planning workers. One Terse room actor is designed to own stock, aircraft, requests, proposals and approvals together. Agent Relay provides distinct worker identities and message delivery. OpenAI model calls interpret known records and explain constrained choices; ordinary TypeScript rules remain authoritative for feasibility and allocation.

In a fixture run, deterministic development adapters replace the unconnected services and are labeled in the UI. Only list a service under “technologies actually demonstrated” after it has been verified in the submitted run.

## Customer and impact hypothesis

Our first customer hypothesis is a dispatch team serving a regional healthcare delivery network. We want to learn whether a shared, auditable replanning workflow reduces coordination work when a delivery plan changes. We have not validated demand, willingness to pay, operational savings or clinical impact. Expansion to other time-sensitive packages and mixed transport fleets is a hypothesis, not demonstrated scale.

## Prototype evidence to record

Fill these from observation before submitting; leave out any item you have not verified.

- Three completed request → plan → ground → replan → approve → simulated-delivery runs: **___ / 3**.
- Actual planning latency, with mode and model identified: **___**.
- Old/stale approval rejected: **___**.
- Duplicate/conflicting allocation rejected: **___**.
- Requester direct approval rejected: **___**.
- No feasible aircraft correctly escalated: **___**.
- Browser refresh restored state: **___**.
- Real Terse runtime restart restored state, if verified: **___**.
- Real Relay request/reply receipt evidence: **___**.
- Hosted URL tested from a second laptop, if available: **___**.

Do not convert these prototype results into claims of lives saved, costs reduced or real-world aircraft performance.

## Links and people to enter

- Canonical source repository: **insert actual accessible URL**.
- Working hosted demo: **insert only if tested; otherwise provide local instructions**.
- Backup recording: **insert actual reviewer-accessible URL or file**.
- Team: **Samarth and teammate’s actual name**.
- Integration status: use the matching description above.

## Final submission check

1. Read the current form and organizer instructions; complete their actual required fields.
2. Verify the repo, demo and recording open for reviewers. Do not expose `.env`, role tokens, workspace keys or runtime credential files.
3. Keep the persistent simulated-operations label and integration-mode disclosure visible in the video.
4. Credit the tools actually used. Do not claim a fixture used live models or Terse persistence.
5. Submit before the on-site deadline and save the visible confirmation. Opening or saving a draft is not proof of submission.
