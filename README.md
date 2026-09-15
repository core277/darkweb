# Dark Web

A live chat + voice-call server, launched from an iPad Safari **bookmark** instead of typing a URL —
inspired by the "bookmarklet loads a script from GitHub Pages" trick. Multiple text/voice channels,
real-time messaging, WebRTC group voice calls, and an admin panel to manage channels and users.

## How it works

- The **bookmarklet** is a tiny `javascript:` snippet. Tapping it injects one `<script type="module">`
  tag pointing at [`docs/app.js`](docs/app.js), hosted on GitHub Pages.
- `app.js` builds the entire app as a full-screen overlay inside a **Shadow DOM**, so its styles never
  clash with whatever page it was launched from.
- **Firebase** (Firestore + Email/Password Auth) is the live backend: real accounts (email + password),
  chat messages, channel list, user profiles/roles, and voice-call signaling all sync in real time.
  GitHub hosts 100% of the app's code — Firebase only holds live data that a static site can't push on
  its own.
- **Voice calls** use WebRTC directly between participants (mesh, up to 6 per voice channel), with
  Firestore documents used to exchange the offer/answer/ICE handshake instead of a dedicated signaling
  server.

## Project structure

```
docs/                     <- published via GitHub Pages
  index.html               install page (generates the bookmarklet link for you)
  app.js                   the injected app (UI, Firebase, chat, admin panel)
  firebase-config.js        your Firebase project's web config (fill in, see below)
  styles.css                app styling (loaded into the Shadow DOM)
  lib/webrtc.js             WebRTC mesh voice calling + Firestore signaling
  bookmarklet.txt           raw bookmarklet source, for reference
firestore.rules            Firestore security rules (paste into the Firebase console)
```

## Setup

### 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and create a new project (free
   Spark plan is enough).
2. **Build → Authentication → Get started → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database → Create database** → start in production mode (any region).
4. In the Firestore **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and
   publish.
5. **Project settings → General → Your apps** → add a **Web app** → copy the `firebaseConfig` object.

### 2. Add your Firebase config

Paste the values you copied into [`docs/firebase-config.js`](docs/firebase-config.js), replacing the
placeholders. This config is safe to commit — it's a public client identifier, not a secret. Real
access control is enforced by `firestore.rules`.

### 3. Publish with GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages** → Source: Deploy from a branch → Branch: `main`, folder: `/docs` → Save.
3. Wait for the Pages build, then visit `https://YOUR_USERNAME.github.io/YOUR_REPO/` — that's the
   install page.

### 4. Install the bookmarklet on iPad

Open the install page above **on the iPad in Safari** and follow its on-page instructions (bookmark
any page, then edit that bookmark's address field to paste the copied launcher code — iOS Safari
won't let you type a `javascript:` bookmarklet directly into a brand-new bookmark, so you always
create a normal bookmark first, then overwrite its URL).

### 5. Make yourself the first admin

1. Launch Dark Web once and sign up with your own email/password (this creates your `users/{uid}`
   document).
2. In the Firebase console, go to **Firestore → users**, find the document with your display name,
   and change its `role` field from `"member"` to `"admin"`.
3. Reopen Dark Web — the **Admin** button now appears in the title bar.

### 6. Create your first channels

Use the Admin panel (**Admin → Channels → Add**) to create at least one `text` channel before
chatting — the app has no default channels out of the box.

## Local testing (no iPad needed)

```bash
npx serve docs
```

Open the printed `localhost` URL in a regular browser and use the install page's "desktop" bookmarklet
link (drag it to your bookmarks bar, then click it on any `http://localhost` or `https://` tab).

## Limitations

- **No TURN server** — voice calls rely on a public STUN server only, so they work reliably between
  peers on the same network (e.g. a school Wi-Fi) but may fail across strict/symmetric NATs. Adding a
  TURN server (e.g. a free tier from a provider like Twilio or Metered) would fix this if needed.
- **Microphone access requires HTTPS.** Launch the bookmarklet from a secure page for voice calls to
  work — browsers block `getUserMedia` on plain HTTP pages.
- **Page Content-Security-Policy.** Some sites block injected `<script>` tags entirely; if the
  bookmarklet does nothing, launch it from the Dark Web install page itself instead.
- **Role changes need a moment.** An admin's promote/ban actions apply as soon as Firestore syncs
  (typically well under a second) — banned users are kicked out live via a real-time listener on their
  own user document.
