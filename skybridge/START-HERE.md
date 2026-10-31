# Samarth — do these next

The app is built. Work from this **SKYBRIDGE** folder, not the earlier STATNEX practice project.

## 1. Open the demo

Double-click **START-DEMO.cmd**. Keep its window open. It installs missing dependencies, builds the dashboard and opens the dispatcher screen automatically.

For the requester screen, open **.data/access.html** and click **Open Requester**. Two tabs on this laptop can use different roles. Your teammate needs the hosted URL to use a separate laptop; localhost is not shared over the internet.

If the app is already running at http://127.0.0.1:3001, use that instance first. Avoid starting a second server on the same port.

## 2. Connect the live services

Your teammate gets the Terse endpoint/token and OpenAI event API key. Enter them in **.env**, never in chat. For Terse sponsor help, give them the **actor/** folder and **TERSE-DEPLOY.md**.

Fill these four values:

```dotenv
OPENAI_API_KEY=your key, locally only
OPENAI_MODEL=a model available to your event key
TERSE_ACTOR_URL=the actual full actor endpoint
TERSE_API_KEY=the actual actor token
```

Then run these from the SKYBRIDGE folder, one at a time:

```powershell
npm.cmd run smoke:model
npm.cmd run smoke:terse
```

For the Terse test, first set **STATE_BACKEND=terse** in .env. If either fails, send the error with secrets removed or show it to sponsor staff. **Real Relay request/reply already passed twice** for this new project; its keys are stored privately under .data. Do not share .data.

After both pass, set **INTEGRATION_MODE=live**, stop the running app with Ctrl+C, and double-click START-DEMO.cmd again. All three service badges should say connected. If they don't, the screen must keep its truthful warning.

## 3. Rehearse this exact story

1. **Requester:** submit one 2 kg supply kit to North Clinic, deadline 20 simulated minutes.
2. **Dispatcher:** show Kestrel proposed. Finch is too small despite its faster ETA.
3. **Dispatcher:** ground Kestrel before dispatch. The old proposal becomes invalid.
4. Click **Replan from latest state**. Swift is the new feasible proposal.
5. Check the approval box and click **Approve simulated dispatch**.
6. Click **Run simulated delivery**. Both screens update; stock is allocated only once.
7. **Reset demo**, then repeat. Use DEMO.md for the spoken pitch.

## 4. Submit with time to spare

Use SUBMISSION.md for the project description. Add your actual source URL, working demo URL if hosted, and a recording. Keep the final 15 minutes for submission and opening every link from another browser. A localhost address is not a judge-accessible hosted URL.

Current honest status: real Relay verified; fixture workflow, browser behavior and tests verified; live Terse and model calls await your credentials. No real aircraft, hospitals or medical data are connected.
