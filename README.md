# line-check

**Know before you go.**

A lightweight, commute-first app that monitors your favourite TfL lines and
alerts you about disruptions before you leave home or work. It answers one
question: "I'm about to leave. Is my usual commute actually running?"

This is not another Citymapper or TfL Go. It is a dashboard for the lines
you actually use, with your commute times and favourite lines saved on your
device.

## What the MVP does

- Live TfL line status for 19 lines: Elizabeth, Central, Jubilee, Northern,
  Piccadilly, Victoria, District, Circle, Metropolitan, Hammersmith & City,
  Waterloo & City, Bakerloo, DLR, and the six named London Overground lines
  (Lioness, Mildmay, Suffragette, Weaver, Windrush, Liberty).
- Favourite lines, saved on-device, shown first with a disruption banner
  when one of them is disrupted.
- Disruption descriptions and reasons straight from TfL.
- Commute preferences: morning and evening departure times, commute days,
  home and work stations.
- Loading, offline and API failure states, pull to refresh, and a refresh
  once a minute while the app is open.
- Tests for TfL response parsing (`npm test`).

## What the MVP does not do

- No backend, no user accounts, no analytics.
- No push notifications yet. iOS does not guarantee background refresh at a
  precise time, so reliable alerts need a server that polls TfL and sends
  pushes through Expo's push service. That is the next milestone.
- No route-specific disruption detection yet. A line can be disrupted on a
  section you never travel, for example west of Paddington while
  Abbey Wood to Liverpool Street runs normally. Section-aware alerts are a
  later step, as are home-screen widgets and alternative routes.

## Data source

Live status comes directly from the Transport for London Unified API, with
no API key in the client:

```
GET https://api.tfl.gov.uk/Line/elizabeth/Status
```

All tracked lines are fetched in a single request. TfL lists an anonymous
limit of 50 requests/minute, so the app refreshes at most once a minute and
only while it is open.

Data is provided by Transport for London. Check TfL's third-party branding
guidelines before publishing anything that uses TfL roundels or branding.

## Run it

Requires Node.js 20 or later.

```sh
npm install
npm start
```

Then open the app:

- **iPhone (recommended):** install Expo Go from the App Store, make sure
  your iPhone and computer are on the same network, and scan the QR code
  shown by `npm start`. Free on-device development works without an Apple
  Developer Program membership.
- **iOS simulator:** on macOS, press `i` in the Expo terminal.
- **Android:** press `a` in the Expo terminal, or run `npm run android`.
- **Web:** press `w`, or run `npm run web`.

Public App Store distribution requires Apple Developer Program membership
($99/year at the time of writing). That is not needed to run the app on
your own iPhone through Expo Go or a development build.

## Checks

```sh
npm test        # Jest tests for TfL response parsing
npm run typecheck
```

## Project layout

```
App.tsx                 Dashboard, favourites, commute settings, states
src/tfl.ts              TfL API client, line list, response parsing
src/storage.ts          Favourites and commute preferences (AsyncStorage)
src/__tests__/tfl.test.ts
```

## Licence

MIT. See [LICENSE](LICENSE).
