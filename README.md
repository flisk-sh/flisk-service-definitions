# tdk-service-definitions

A community registry of TDK Landscape apps. Each app publishes its `service.json` files here, the way DefinitelyTyped publishes type definitions for npm packages. Every file is validated against the [TDK service schema](schema/service.schema.json) on each pull request.

## Layout

```
apps/<shard>/<owner>/<app>/
  app.json                      app registration (name, description, license)
  services/<appName>/service.json   one TDK resource per directory
```

- `<shard>` is the first two characters of `<owner>`, so no directory holds more than a few thousand entries. This matters at a million apps.
- `<owner>` and `<app>` are lowercase slugs. The app's `name` is `@<owner>/<app>`.
- `appName` in each `service.json` must equal its directory name.
- Ports and `dependsOn` are checked inside one app, because each app is its own landscape.

## Use a definition

Add a `$schema` key to any `service.json`:

```json
{
  "$schema": "https://tdk-landscape.github.io/schema.service.json",
  "schemaVersion": 1,
  "appName": "orders-api"
}
```

Or map the filename once in `.vscode/settings.json` so the editor validates every `service.json` in the workspace:

```json
{
  "json.schemas": [
    { "fileMatch": ["**/services/*/service.json"], "url": "https://tdk-landscape.github.io/schema.service.json" }
  ]
}
```

## Validate locally

```sh
npm ci
npm test          # validator unit tests
npm run validate  # every app in the repo
npm run format    # rewrite files into canonical 2-space JSON
```

## Schema source

`schema/service.schema.json` is copied from [`engine/schemas/service-schema.json`](https://github.com/tdk-landscape/tdk-cli-core) in tdk-cli-core, the source of truth. Refresh it with:

```sh
npm run sync-schema -- ../tdk-cli-core/engine/schemas/service-schema.json
```

The hosted copy at `tdk-landscape.github.io/schema.service.json` lags behind the engine copy, so pin `schema/` here when you need an exact match.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or change an app.

## License

MIT. See [LICENSE](LICENSE).
