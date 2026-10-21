# tdk-service-definitions

A community registry of TDK Landscape apps. Each app publishes its `service.json` files here, the way DefinitelyTyped publishes type definitions for npm packages. Every file is validated against the TDK service schema on each pull request.

## Current apps

These 21 apps were imported with `tdk-import` and then schema-validated. The first 11 come from public docker-compose repositories; the `docker/*` samples come from [docker/awesome-compose](https://github.com/docker/awesome-compose) (CC0). **None of them has been runtime-tested.** Nobody has run `tdk up` on them yet, so treat them as seed data, not verified examples.

The importer assigns each service a port in 4000–5999. A container that listens on its original port (80, 3000, 8080, ...) will not answer on the assigned port until it reads `$PORT`. Each service's manifest is valid, but a working setup may need that change first.

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
| [`@docker/nginx-flask-mysql`](apps/do/docker/nginx-flask-mysql) | 3 | Flask app behind nginx, with MySQL | [sample](https://github.com/docker/awesome-compose/tree/master/nginx-flask-mysql) |
| [`@docker/nginx-golang-postgres`](apps/do/docker/nginx-golang-postgres) | 3 | Go app behind nginx, with Postgres | [sample](https://github.com/docker/awesome-compose/tree/master/nginx-golang-postgres) |
| [`@docker/react-express-mysql`](apps/do/docker/react-express-mysql) | 3 | React frontend, Express API, MySQL | [sample](https://github.com/docker/awesome-compose/tree/master/react-express-mysql) |
| [`@docker/react-express-mongodb`](apps/do/docker/react-express-mongodb) | 3 | React frontend, Express API, MongoDB | [sample](https://github.com/docker/awesome-compose/tree/master/react-express-mongodb) |
| [`@docker/nextcloud-redis-mariadb`](apps/do/docker/nextcloud-redis-mariadb) | 3 | Nextcloud with Redis and MariaDB | [sample](https://github.com/docker/awesome-compose/tree/master/nextcloud-redis-mariadb) |
| [`@docker/spring-postgres`](apps/do/docker/spring-postgres) | 2 | Spring Boot app with Postgres | [sample](https://github.com/docker/awesome-compose/tree/master/spring-postgres) |
| [`@docker/nginx-nodejs-redis`](apps/do/docker/nginx-nodejs-redis) | 4 | Node.js app behind nginx, with Redis | [sample](https://github.com/docker/awesome-compose/tree/master/nginx-nodejs-redis) |
| [`@docker/gitea-postgres`](apps/do/docker/gitea-postgres) | 2 | Gitea Git server with Postgres | [sample](https://github.com/docker/awesome-compose/tree/master/gitea-postgres) |
| [`@docker/prometheus-grafana`](apps/do/docker/prometheus-grafana) | 2 | Prometheus and Grafana monitoring | [sample](https://github.com/docker/awesome-compose/tree/master/prometheus-grafana) |
| [`@docker/elasticsearch-logstash-kibana`](apps/do/docker/elasticsearch-logstash-kibana) | 3 | Elasticsearch, Logstash and Kibana logging | [sample](https://github.com/docker/awesome-compose/tree/master/elasticsearch-logstash-kibana) |

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

The validator loads the service schema from the published copy at https://flisk.sh/schema.service.json. You can override the URL with `TDK_SERVICE_SCHEMA_URL`.

The source of truth is `engine/schemas/service-schema.json` in [tdk-cli-core](https://github.com/flisk-sh/flisk). The published copy is synced from there. Do not edit the schema in this repo.

`app.json` is registry metadata (name, description, license, repository, and the commit the services were imported from). It is not part of the TDK runtime contract, and it has no schema. The validator only checks that its `name` matches the directory path.

## Use a definition

Add a `$schema` key to any `service.json`:

```json
{
  "$schema": "https://flisk.sh/schema.service.json",
  "schemaVersion": 1,
  "appName": "orders-api"
}
```

Or map the filename once in `.vscode/settings.json` so the editor validates every `service.json` in the workspace:

```json
{
  "json.schemas": [
    { "fileMatch": ["**/services/*/service.json"], "url": "https://flisk.sh/schema.service.json" }
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
