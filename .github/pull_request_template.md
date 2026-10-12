## Add or change an app

- [ ] App lives at `apps/<first two chars of owner>/<owner>/<app>/`
- [ ] `app.json` name matches the path (`@owner/app`) and has a `repository` and `license`
- [ ] Every `services/<appName>/service.json` has `appName` equal to its directory name
- [ ] No secret values in `params` (names go under `secrets`)
- [ ] `npm run format && npm test && npm run validate` pass locally

🤖 CI runs the same checks on the apps this PR touches.
