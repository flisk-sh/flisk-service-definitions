# tdk-service-definitions

A community registry of TDK Landscape apps. Each app publishes its `service.json` files here, the way DefinitelyTyped publishes type definitions for npm packages. Every file is validated against the TDK service schema on each pull request.

## Current apps

These 11 apps were imported from public docker-compose repositories with `tdk-import` and then schema-validated. **They have not been runtime-tested.** Nobody has run `tdk up` on them yet, so treat them as seed data, not verified examples.

| App | Services | What it is | Source |
| --- | --- | --- | --- |
| [`@afteracademy/nodejs-backend-architecture-typescript`](apps/af/afteracademy/nodejs-backend-architecture-typescript) | 4 | Node.js + TypeScript backend reference with Mongo and Redis | [repo](https://github.com/afteracademy/nodejs-backend-architecture-typescript) |
| [`@deviantony/docker-elk`](apps/de/deviantony/docker-elk) | 9 | Elastic stack (ELK) with Docker Compose | [repo](https://github.com/deviantony/docker-elk) |
| [`@getarcaneapp/arcane`](apps/ge/getarcaneapp/arcane) | 12 | Docker management UI with agents and observability | [repo](https://github.com/getarcaneapp/arcane) |
| [`@instantbox/instantbox`](apps/in/instantbox/instantbox) | 4 | Disposable Linux boxes in the browser | [repo](https://github.com/instantbox/instantbox) |
| [`@leandromoreira/cdn-up-and-running`](apps/le/leandromoreira/cdn-up-and-running) | 3 | Teaching CDN stack with Nginx, Prometheus and Grafana | [repo](https://github.com/leandromoreira/cdn-up-and-running) |
| [`@louislam/dockge`](apps/lo/louislam/dockge) | 5 | Self-hosted Docker Compose stack manager | [repo](https://github.com/louislam/dockge) |
| [`@orders-co/orders-platform`](apps/or/orders-co/orders-platform) | 3 | Example shop app: API, storefront and worker (written for this registry) | none |
| [`@p3terx/aria2-pro-docker`](apps/p3/p3terx/aria2-pro-docker) | 3 | Aria2 download manager with a web UI | [repo](https://github.com/P3TERX/Aria2-Pro-Docker) |
| [`@schenkd/nginx-ui`](apps/sc/schenkd/nginx-ui) | 2 | Web UI for editing nginx configuration | [repo](https://github.com/schenkd/nginx-ui) |
| [`@speaches-ai/speaches`](apps/sp/speaches-ai/speaches) | 6 | Speaches stack with Prometheus, Loki, Tempo and an OpenTelemetry collector | [repo](https://github.com/speaches-ai/speaches) |
| [`@vegasbrianc/prometheus`](apps/ve/vegasbrianc/prometheus) | 5 | Prometheus monitoring stack | [repo](https://github.com/vegasbrianc/prometheus) |

Single-container tools, PaaS installers and full development environments were left out of the first batch on purpose.

## Layout

```
apps/<shard>/<owner>/<app>/
  app.json                          app registration (name, description, license)
  services/<appName>/service.json   one TDK resource per directory
```

- `<shard>` is the first two characters of `<owner>`, so no directory holds too many entries.
- `<owner>` and `<app>` are lowercase slugs. The app's `name` is `@<owner>/<app>`.
- `appName` in each `service.json` must equal its directory name.
- Ports and `dependsOn` are checked inside one app, because each app is its own landscape.

## Schema

The validator loads the service schema from the published copy at https://tdk-landscape.github.io/schema.service.json. You can override the URL with `TDK_SERVICE_SCHEMA_URL`.

The source of truth is `engine/schemas/service-schema.json` in [tdk-cli-core](https://github.com/tdk-landscape/tdk-cli-core). The published copy is synced from there. Do not edit the schema in this repo.

The app schema (`schema/app.schema.json`) is specific to this registry and lives here.

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
npm test          # validator unit tests (needs network for the published schema)
npm run validate  # every app in the repo
npm run format    # rewrite files into canonical 2-space JSON
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or change an app.

## License

MIT. See [LICENSE](LICENSE).
