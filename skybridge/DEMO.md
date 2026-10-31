# SKYBRIDGE — the 90-second demo

**The story:** a delivery plan is ready; the proposed aircraft is grounded; the agents reconcile the change; a human approves the replacement.

## Before judges arrive

- Samarth opens the **Dispatcher** screen. Teammate opens **Requester**. Use the server-issued role links; the two tabs can share one browser while retaining their selected roles.
- For two laptops, both must reach the same working hosted URL. Two localhost tabs demonstrate two clients on one laptop, not a verified hosted deployment.
- In Dispatcher, click **Reset demo** and confirm. Keep the Requester form at **Sealed supply kit · 2 kg**, **Quantity 1**, **North Clinic · 8 km**, **20 simulated minutes**.
- Verify the three integration indicators. Only present the full-integration narration when **Terse state**, **Agent Relay**, and **AI models** are verified connected. The development-fixture banner must remain visible in fixture mode.
- Prepare a recording of one successful run. If you use it, identify it as a recording. Do not disguise service latency or present a fixture recording as a live model run.

## Spoken script and actions

| Time | Person / action | Say |
| --- | --- | --- |
| 0–12 sec | Samarth introduces the shared room. | “Urgent supply deliveries depend on stock, aircraft availability and receiving deadlines. SKYBRIDGE coordinates those decisions in one shared dispatch room.” |
| 12–27 sec | Teammate clicks **＋ Create supply request**. Watch the actual coordination timeline. | “We need one two-kilogram supply kit at North Clinic within twenty simulated minutes. Supply and Fleet reconcile the constraints and propose Kestrel.” |
| 27–42 sec | Samarth clicks **Ground before dispatch** on the **Kestrel** card. Show **Replan required** and the stale-plan explanation. | “This plan still needs human approval. Now Kestrel fails its simulated preflight check. The previous proposal becomes invalid; its old approval cannot allocate resources.” |
| 42–63 sec | Samarth clicks **Replan with current conditions →**. Show the new **Swift** proposal and its explanation. | “Finch is closer, but its one-kilogram payload limit rules it out. Swift can carry the package and meet the deadline. The replacement is a new plan requiring new approval.” |
| 63–76 sec | Samarth checks the exact-plan attestation, clicks **Approve simulated dispatch →**, then **Run simulated delivery →**. | “The dispatcher approves this exact version. The server checks current stock and aircraft availability together, then starts the separate simulation clock.” |
| 76–90 sec | Show the other screen updating and one expandable message receipt. | “Terse owns the operational state. Agent Relay carries the agents’ messages. Models propose and explain; people approve. All facilities, aircraft and flight data are fictional. Next, we want to validate the workflow with a delivery operator.” |

Live model and Relay latency may extend the run. Narrate the visible state accurately; do not promise a ninety-second network completion. Keep the setup and credentials outside the presentation.

## If integrations are pending

Use this opening instead:

> “This is SKYBRIDGE’s development-fixture demonstration. The dispatch workflow, version checks and human approval are running; this run does not use live Terse or model reasoning. We separately verified Relay message exchanges, and the remaining service connections are disclosed.”

During the closing, say **“the architecture is designed for Terse and two model-backed workers”**, rather than claiming those services powered the fixture run. If only some services work, name those services precisely.

## Backup proof, if a judge asks

- **No solution:** Reset, ground Kestrel and Swift, then submit the two-kilogram North Clinic request. Show **Needs coordinator attention**. Finch cannot carry the kit.
- **Two clients:** Keep Requester and Dispatcher visible. A change in either screen appears in the other without a manual refresh.
- **Persistence:** Refresh restores the room from the server. Only call it a Terse restart demonstration after a real actor-runtime restart has been tested.
- **Concurrency:** Two proposals may mention the same aircraft. Approval is where the actor checks and allocates resources, so only one can commit that aircraft at a time. Use the tested contention case rather than inventing a success claim.
- **Timing:** Real event timestamps and planning latency are separate from simulated delivery minutes. The map is a schematic, not telemetry.

## Team handoff

**Samarth:** Dispatcher screen, grounding, replacement review, approval and spoken explanation of the changed plan.

**Teammate:** Requester screen, submit the prepared request, verify live updates, and own the problem/customer hypothesis in judge questions.

**Before submission:** complete three successful runs from Reset, capture a short backup recording, open every submitted link from another browser, and verify the submission confirmation.
