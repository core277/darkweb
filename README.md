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
  chat messages, channel list, user profiles/roles, presence, and voice-call signaling all sync in real
  time. GitHub hosts 100% of the app's code — Firebase only holds live data that a static site can't
  push on its own.
- **Images** (chat attachments and profile pictures) are resized in the browser and stored inline in
  Firestore as compressed JPEG data URLs — no Firebase Storage bucket needed, which keeps the project
  on the free plan. Chat images are capped at ~700 KB after compression; profile pictures are cropped
  to a 128px square.
- **Accounts**: sign up with a username + password; email is optional but recommended (it's the only
  way to reset a forgotten password). Username-only accounts get an internal
  `username@users.darkweb.local` login behind the scenes and can add a real email later from User
  Settings → Account. Change display name, status, avatar (uploaded picture or emoji fallback), email,
  and password from User Settings.
- **Reactions**: hover a message and click the smiley icon to react with any emoji; click an existing
  reaction pill to add or remove yours. Stored the same way as poll votes - a `reactions: { uid:
  [emoji, ...] }` map on the message, with rules allowing anyone to touch only their own key.
- **Polls**: the bar-chart icon in the message bar creates a poll (question + 2-10 options, optional
  "pick more than one"). Votes live in a `votes: { uid: [optionId, ...] }` map on the poll message
  itself; the rules let anyone touch only their own key in that map, so votes update live for everyone
  without opening up the rest of the message to editing. Works in channels, forum posts, and DMs.
- **Direct messages**: the chat-bubble button in the rail opens your conversations. Click any member
  (or a message author's name) to DM them. Stored under `dms/{uidA_uidB}` and readable only by the
  two participants - site admins included. Unread counts show on the rail button.
- **Servers**: every user can create servers and invite people with a code. Data lives under
  `servers/{code}` with `channels`, `messages`, and `voiceChannels` nested beneath it; `memberIds`
  on the server document drives access in `firestore.rules`. Site admins can read and manage all of
  them.
- **Voice calls** use WebRTC directly between participants (mesh, up to 6 per voice channel), with
  Firestore documents used to exchange the offer/answer/ICE handshake instead of a dedicated signaling
  server. **Direct messages** get 1:1 voice/video calling too — the phone icon in a DM's header starts
  a call at `dms/{dmId}/call/current`, and camera/screen share work the same as in a server call.

## Project structure

```
docs/                     <- published via GitHub Pages
  index.html               install page (generates the bookmarklet link for you)
  app.js                   the injected app (UI, Firebase, chat, admin panel)
  firebase-config.js        your Firebase project's web config (fill in, see below)
  styles.css                app styling (loaded into the Shadow DOM)
  lib/webrtc.js             WebRTC mesh voice calling + Firestore signaling
  logo.svg                  the lightning-bolt logo (also inlined in app.js)
  bookmarklet.txt           raw bookmarklet source, for reference
firestore.rules            Firestore security rules (paste into the Firebase console)
```

## Install page unlock

The install page (`docs/index.html`) opens as a real, fully-working calculator themed "Dark Web
Launch Console — Locked". Enter an expression that evaluates to **1337** and press **=** to reveal
the install instructions, bookmarklet links, and a copy-paste box with the raw bookmarklet code (for
when the "Copy Link" long-press doesn't work well on iOS). It's a hacker-themed puzzle gate, not a
disguise — the page's `<title>`, this README, and the repo are all upfront about what the site is.
Change `UNLOCK_VALUE` in `docs/index.html` if you want a different code.

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
3. Reopen Dark Web — a shield icon now appears in the bottom-left user panel.

### 6. Create a server

Anyone can create their own server: hit the green **+** in the left rail → **Create**, give it a
name, and you get a `#general` text channel and a `voice` channel automatically. The server's
8-character **invite code** (Server name ▾ → **Invite People**) is what friends enter under
**+ → Join** to get in.

- **Home server**: the lightning-bolt button at the top of the rail is a server *everyone* is in
  automatically and can't leave. It's created the first time a site admin logs in (document id
  `HOME`), comes with `#general` and `voice`, and only site admins can manage it.
- **Server owners** manage their own server: Server name ▾ → **Server Settings** — upload a server
  icon, rename, manage channels (text, voice, or **forum**), create **roles** with colours and
  permissions (manage channels, delete anyone's messages, mention @everyone) and hand them out on
  the Members tab, kick members, delete the server. Role permissions are stored on the server
  document as `memberPerms` so the Firestore rules can enforce them.
- **Forum channels** hold posts: each post is a thread with a title and its own replies.
- **Site admins** (users with `role: "admin"`) see *every* server in the rail — servers they're not
  a member of get a yellow ring — and get a shield button in the bottom-left user panel that opens
  the **Site Admin** panel (all servers, all users, promote/ban/delete). Deleting an account wipes
  the profile, locks it out, removes it from every server, and shows its old messages as
  "Deleted User" — the Firebase Auth login itself can only be removed from the Firebase console
  (Authentication → Users), since browsers can't call the Admin SDK.

### 7. (Optional) Turn on GIF search

The **GIF** button in the message bar searches [Tenor](https://tenor.com). It needs a free API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), pick your Firebase project
   (it's a Google Cloud project too).
2. **APIs & Services → Library** → search **Tenor API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key** → copy it.
4. Paste it into `tenorApiKey` in [`docs/firebase-config.js`](docs/firebase-config.js), commit, push.

Prefer GIPHY? Get a free key at [developers.giphy.com](https://developers.giphy.com) (**Create an
App → API**) and put it in `giphyApiKey` instead — the app uses Tenor if that key is set, otherwise
GIPHY. Until one is set the GIF tab just explains that it's not set up. Emoji work with no setup — the smiley
button opens a picker with recently-used, and emoji-only messages render large.

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
