---
name: deploy-custom-image
description: Build a branch into a custom image through a workflow_dispatch GitHub Actions workflow, deploy it to an environment, then confirm the rollout on a Prometheus-compatible metrics endpoint. A template - fill in the placeholders for your repo, workflow and endpoint. Use when asked to deploy a custom image, build a custom branch to an environment, or "custom image".
argument-hint: "<branch> [environment] [expiry YYYY-MM-DD-HHMM UTC]"
---

# Deploy Custom Image

Trigger `<build-workflow>.yml` in `<owner>/<repo>` to build a branch into a custom image and deploy it to an environment, then verify on your metrics endpoint that the environment is actually running the new tag.

This is a template. Before first use, replace the placeholders - `<owner>/<repo>`, `<build-workflow>.yml`, its input names, `<default-env>`, `<image-name>`, `<pod-prefix>` and `<metrics-endpoint>` - with your own values.

GitHub goes through `npx gh-axi`; raw `gh` is the fallback only when a gh-axi call fails.

## Step 1 - Resolve the inputs

Parse `$ARGUMENTS`:

- **branch** (first token) - **required. If it is missing, ask the user which branch. Never guess or default it.**
- **environment** (second token) - default `<default-env>`. May be a comma-separated list.
- **expiry** (third token, `YYYY-MM-DD-HHMM`, UTC) - default now + 2 hours, for workflows that revert a custom image on a timer:
  ```bash
  date -u -v+2H +%Y-%m-%d-%H%M   # macOS; GNU: date -u -d '+2 hours' +%Y-%m-%d-%H%M
  ```

Echo one line - `Deploying <branch> -> <environment>, expires <expiry> UTC` - then **trigger immediately**. The only stop is a missing branch.

## Step 2 - Trigger the workflow

Dispatch the workflow on the branch, with the inputs that make it deploy a custom image; leave every other input at its default. Use the branch's **exact** ref - a PR head branch may be upper- or lower-case.

```bash
npx gh-axi workflow run <build-workflow>.yml --repo <owner>/<repo> --ref "<branch>" \
  --field <deploy-input>=true \
  --field <environment-input>="<environment>" \
  --field <expiry-input>="<expiry>"
```

(The flag is `--field`, not `-f`; workflow_dispatch inputs arrive as strings, so booleans are the literal `true`/`false`.) A good dispatch prints `triggered: ok`. If it errors, surface the error and stop - do not pretend it deployed.

## Step 3 - Find the run and watch it

The dispatch returns no run id, and the run appears a few seconds later. Poll for the newest run on the branch until one shows, then watch it to a conclusion:

```bash
npx gh-axi run list --repo <owner>/<repo> --workflow <build-workflow>.yml --branch <branch> --limit 3
npx gh-axi run watch <run-id> --repo <owner>/<repo>   # or poll `run view <run-id>`
```

A **failed** run is the end: report the failure with the run URL, and do not run the rollout check.

## Step 4 - Read the built tag from the run

The build logs the image tag it produced. Pull it from the run log:

```bash
npx gh-axi run view <run-id> --repo <owner>/<repo> --log 2>/dev/null \
  | grep -oE '<image-name>:[A-Za-z0-9._-]+' | sort -u
```

Take the custom tag this run built - that is the tag the environment must end up running.

## Step 5 - Verify the rollout on the metrics endpoint (poll up to 5 minutes)

The run going green means the image built and the update was triggered; the environment picks it up shortly after. Query kube-state-metrics on your metrics endpoint for the image the pods run. Filter on the pod name when the image name differs from the deployment name:

```bash
for env in <each environment>; do
  curl -s -m 15 -G '<metrics-endpoint>/api/v1/query' \
    --data-urlencode "query=kube_pod_container_info{<env-label>=\"${env}\",pod=~\"<pod-prefix>-.*\"}" \
    | python3 -c "import sys,json;print('\n'.join(sorted({r['metric']['pod']+' '+r['metric']['image'].split(':')[-1] for r in json.load(sys.stdin).get('data',{}).get('result',[])})))"
done
```

Each line is a pod and the tag it runs (the part of the `image` label after `:`). During a rollout the old pods stay listed with the old tag until they finish terminating. Poll every ~20-30s for up to **5 minutes**:

- The built tag from Step 4 appears -> **deployed**.
- 5 minutes pass without it -> **built, not yet visible**. Give the query above so it can be rechecked later; the rollout may just be slow.
- The `curl` cannot reach the endpoint (VPN/network) -> say so and hand over the query for a manual check, rather than reporting a failure that did not happen.

For a multi-environment run, check each and report per environment.

## Step 6 - Report

- The **run URL** and its result.
- The **built tag**.
- Per environment: **deployed** (running the built tag) / **not yet visible** / **check manually** - with the query when it is not a clean deployed.
