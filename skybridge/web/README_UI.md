# Dashboard acceptance walkthrough

Use two browser sessions: Requester submits supply needs, Dispatcher approves and changes the scenario. The server enforces these roles. A role dropdown by itself never grants access.

1. Open the server-issued Requester link. Its fragment token is consumed once, removed from the address bar, and exchanged for an HTTP-only session cookie. No role token is saved in browser storage. Only the nonsecret selected role is stored per tab; API requests and live-event connections select that role, and the backend checks its verified grant. Requester and Dispatcher tabs can therefore share a browser without overwriting each other's selected role.
2. Submit one sealed supply kit to North Clinic with a 20 simulated minute deadline. Confirm the queue changes to planning and both screens receive the update.
3. On Dispatcher, inspect the active Kestrel proposal, its payload/range/deadline evidence, world version and real receipt IDs. Requester has no enabled approval control.
4. Ground Kestrel before approving. The proposal must become stale/replanning. Replan using current conditions. Swift should replace Kestrel; Finch cannot carry the 2 kg kit.
5. Review the exact new plan, tick the simulated-dispatch attestation and approve. Stock and aircraft allocation update together. Start the simulated delivery; its server clock advances separately from real event timestamps.
6. Refresh either screen. State must restore from the server. The browser must not mark a mission delivered itself.
7. Reset, then ground Kestrel and Swift. The sealed supply-kit request must need coordinator attention; no fabricated route or assignment should appear.
8. Repeat the core scenario three times from Reset. Confirm the development-fixture label remains visible whenever integrations are not live.

Other checks: typing a request or role token must survive unrelated server events; errors remain visible and readable; buttons disable while an action is pending; delivery animation respects reduced-motion preferences. Inspect at a typical laptop width and a narrow screen. Map routes and flight motion are schematic, not telemetry.
