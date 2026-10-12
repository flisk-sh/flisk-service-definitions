# Contributing

## Add an app

1. Pick your owner slug (lowercase, `a-z0-9-`, 2–39 characters) and your app slug.
2. Create `apps/<first two chars of owner>/<owner>/<app>/`.
3. Add `app.json`:

   ```json
   {
     "name": "@your-owner/your-app",
     "description": "What the app does.",
     "license": "MIT"
   }
   ```

4. Add one `services/<appName>/service.json` per resource. The directory name must equal `appName`.
5. Run `npm run format && npm test && npm run validate`, then open a pull request.

## Rules

- **No secrets.** Keys such as `*_PASSWORD`, `*_TOKEN`, `*_SECRET`, `*_API_KEY`, or values that look like credentials are rejected. Secret names go in `secrets.required` or `secrets.optional`. Their values stay in the project `.env`.
- **Ports are unique within an app.** Backends use 4000–5999, frontends 3000–3999, as the schema requires.
- **`dependsOn` must name a service or stack in the same app.**
- **Canonical formatting.** Two-space indentation, a trailing newline, and key order as written. `npm run format` fixes this.
- **Schema changes come from tdk-cli-core first.** Propose them there, then run `npm run sync-schema` here.

## Pull request review

CI validates only the apps a pull request touches. A change to `schema/` validates every app. Maintainers review each change. Ownership enforcement (CODEOWNERS per owner directory) is not set up yet.

## Unknown fields

A key that is not in the schema produces a warning, not an error. Warnings are fine for a new field that tdk-cli-core is about to add. Please raise a schema change upstream if you need one for real.
