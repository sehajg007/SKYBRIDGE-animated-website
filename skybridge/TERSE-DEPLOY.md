# Connect the real Terse actor from Windows

The installed `terse-sdk` and CLI are both pinned to **0.14.9**. They use `durable-actors` **0.14.6**, whose native local runtime does not support Windows. Windows can still call a hosted Terse actor. These are the inspected CLI commands; authenticated deployment has not yet been performed for this project.

## Fastest route: ask Terse staff to deploy this actor

Give the Terse sponsor team the `actor/` directory after running `npm.cmd run prepare:actor`. It contains self-contained source, including generated `actor/src/domain.ts`. Ask for the actual actor endpoint and an API key for your project. Enter those locally in `.env` and run the verification steps below. Do not send keys in chat or screenshots.

## Self-service hosted setup in PowerShell

Run these from the SKYBRIDGE root, with dependencies already installed. You complete account sign-in yourself.

```powershell
npm.cmd run prepare:actor
New-Item -ItemType Directory -Force .data | Out-Null
Set-Location .data
..\node_modules\bun\bin\bun.exe ..\node_modules\terse-cli\dist\index.js init skybridge-cloud --no-browser
```

The CLI prints a login URL and creates a genuine Terse project. Complete the browser sign-in. It scaffolds a temporary example under `.data/skybridge-cloud`; this does not overwrite the application. If it reports a login or project-creation failure, stop and show that error to Terse staff.

After successful creation, while still in `.data`:

```powershell
Copy-Item .\skybridge-cloud\terse.config.json ..\actor\terse.config.json
Set-Location ..
npm.cmd run actor:deploy
```

This publishes SKYBRIDGE's actual actor source, using the genuine project ID from Terse. It does not publish the temporary tutorial actor. The root wrapper runs the CLI from `actor/`; do not use an unsupported `--project actor` flag.

Copy the **actual full actor endpoint** printed by the deploy into root `.env` as `TERSE_ACTOR_URL`. Obtain the server API token from Terse and set `TERSE_API_KEY`. Set `STATE_BACKEND=terse`.

```powershell
npm.cmd run generate:terse
npm.cmd run smoke:terse
```

Generation fetches the published contract into `server/generated/`. The app prefers that generated client. If generation is unavailable, it can use `createActorStub` from the official `terse-sdk/actors` package for the actor's two checked methods. This uses the SDK's actual provider-aware transport; it is not a hand-written HTTP substitute.

The smoke test proves a real write followed by reconnect/read, then prints `writeReadReconnect: passed`. **That is not a runtime restart test.** Refresh the dashboard and later restart the application to demonstrate that the same hosted actor retains the room. The actor uses one persisted field for validated incidents, resource allocation, proposals and audit state.

To connect the other services, also set `INTEGRATION_MODE=live`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and your real Relay configuration in `.env`, then restart the app. The dashboard reports live model/Relay health only after actual checks succeed. A successful Terse connection alone does not prove a model request or Relay delivery.

## Mac/Linux local development alternative

With Bun installed, root `npm run actor:dev` prepares the actor and starts the native local runtime. Keep it running. Set the calling backend's full endpoint:

```dotenv
STATE_BACKEND=terse
TERSE_ACTOR_URL=http://127.0.0.1:7100/v1/projects/local/actors
TERSE_API_KEY=
```

Then use `npm run generate:terse` and `npm run smoke:terse` in another terminal. Preserve `actor/.durable-actors/` when restarting the native runtime. If local authentication is enabled with `TERSE_ACTOR_SECRET`, set matching backend `TERSE_API_KEY`.

## Keep the code and keys separate

`shared/domain.ts` is canonical. `npm run prepare:actor` regenerates `actor/src/domain.ts` before actor development and deployment so the uploaded project has no imports outside `actor/`. Commit/include that generated source in the submission, but exclude `.data`, `.env`, native runtime state and credentials. `terse.config.json` contains a real project ID and name, not the server API key.
