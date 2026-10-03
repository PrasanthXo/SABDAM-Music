# SABDHAM Android update policy

## Optional updates

Use optional delivery for visual refinements, small fixes, and non-critical improvements.

Release manifest rules:

- `latestVersionCode`: new version code
- `minimumVersionCode`: keep the currently supported minimum
- `forceUpdate`: `false`

App behavior:

- No blocking update screen.
- The update appears inside the Home notification bell.
- The notification can show an **Update** button.
- The raw APK URL is never rendered in the app UI.

## Major / required updates

Use required delivery for breaking changes, security fixes, incompatible backend changes, or releases that must replace older builds.

Release manifest rules:

- `latestVersionCode`: new version code
- `minimumVersionCode`: new required minimum
- `forceUpdate`: `true`

App behavior:

- A blocking **Update required** screen is shown.
- Android back cannot dismiss it.
- There is no Later button.
- The user must update to continue.
- The raw APK URL is never rendered in the app UI.

## Release safety

Do not raise `latestVersionCode` in `app-update-release.json` until the matching signed APK has already been published to `public/downloads/SABDHAM-signed.apk`.
