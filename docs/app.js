import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, deleteField, addDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DEFAULT_EMOJI = "🙂";
const AVATAR_CHOICES = [
  "🙂", "😎", "🐱", "🐺", "👾", "🎮",
  "🔥", "💀", "👻", "🤖", "🧠", "⚡",
];
const AVATAR_COLORS = ["#5865f2", "#57f287", "#eb459e", "#ed4245", "#faa61a", "#3ba55c", "#7289da", "#e67e22"];
const ONLINE_WINDOW_MS = 150000;
const HEARTBEAT_MS = 60000;
const GROUP_WINDOW_MS = 7 * 60 * 1000;
const MESSAGE_LIMIT = 100;
const MAX_IMAGE_BYTES = 700000;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const ICONS = {
  // CSS-mask based so it works inside the Shadow DOM (SVG url(#gradient) refs don't resolve there).
  logo: '<span class="dw-logo"><span class="dw-logo-inner"></span></span>',
  hash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.88 21l1.02-6H3l.34-2h3.9l.68-4H4.1l.34-2h3.9L9.36 3h2.03l-1.02 6h4l1.02-6h2.03l-1.02 6H20l-.34 2h-3.9l-.68 4h3.82l-.34 2h-3.9l-1.02 6h-2.03l1.02-6h-4l-1.02 6H5.88zm3.4-8h4l.68-4h-4l-.68 4z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z"/><path d="M4 3l17 17" stroke="#ed4245" stroke-width="2.5" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94a7.07 7.07 0 000-1.88l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.03 7.03 0 00-1.63-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 00-.6.22L2.74 8.84a.5.5 0 00.12.64l2.03 1.58a7.07 7.07 0 000 1.88l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1112 8.5a3.5 3.5 0 010 7z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 5v6c0 5.25 3.4 10.15 8 11.35C16.6 21.15 20 16.25 20 11V5l-8-3z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.71L12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.3 6.3 1.41-1.41-6.3-6.3 6.3-6.3z"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 11h14v2H5z"/></svg>',
  members: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>',
  disconnect: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15.46l-5.27-.61-2.52 2.52a15.05 15.05 0 01-6.59-6.59l2.53-2.53L8.54 3H3.03C2.45 13.18 10.82 21.55 21 20.97v-5.51z"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 2h14v2H5z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>',
};

const TEMPLATE = `
<div id="root">
  <div id="login-screen" class="screen">
    <div class="auth-card">
      <button class="icon-btn corner-close" id="login-close-btn" title="Close">${ICONS.close}</button>
      <div class="auth-logo">${ICONS.logo}</div>
      <div class="auth-brand">DARK WEB</div>
      <h1 id="auth-title">Welcome back!</h1>
      <p id="auth-subtitle" class="auth-sub">We're so excited to see you again!</p>
      <div id="signup-fields" hidden>
        <label class="field-label">Display name</label>
        <input id="signup-name" maxlength="24" autocomplete="nickname" />
      </div>
      <label class="field-label">Email</label>
      <input id="auth-email" type="email" autocomplete="email" />
      <label class="field-label">Password</label>
      <input id="auth-password" type="password" autocomplete="current-password" />
      <div class="link-row" id="forgot-password-row"><a href="#" id="forgot-password-link">Forgot your password?</a></div>
      <button id="auth-submit-btn" class="btn btn-primary btn-block">Log In</button>
      <div id="login-error" class="form-msg"></div>
      <div class="auth-switch">
        <span id="auth-switch-text">Need an account?</span>
        <a href="#" id="auth-switch-link">Register</a>
      </div>
    </div>
  </div>

  <div id="banned-screen" class="screen" hidden>
    <div class="auth-card">
      <button class="icon-btn corner-close" id="banned-close-btn" title="Close">${ICONS.close}</button>
      <h1>Access denied</h1>
      <p class="auth-sub">You have been banned from Dark Web.</p>
    </div>
  </div>

  <div id="app-screen" hidden>
    <nav id="server-rail">
      <div class="rail-home" title="Dark Web">${ICONS.logo}</div>
      <div class="rail-sep"></div>
      <div id="server-list"></div>
      <button id="add-server-btn" class="rail-icon rail-add" title="Add a server">${ICONS.plus}</button>
    </nav>

    <aside id="channel-sidebar">
      <button id="server-header"><span id="server-name">Dark Web</span><span class="chev">${ICONS.chevron}</span></button>
      <div id="server-menu" class="dropdown" hidden>
        <button id="menu-invite">Invite People</button>
        <button id="menu-settings" hidden>Server Settings</button>
        <button id="menu-leave" class="danger" hidden>Leave Server</button>
      </div>
      <div id="channel-scroll">
        <div class="category">
          <span class="category-name">Text Channels</span>
          <button class="category-add" data-type="text" title="Create channel" hidden>${ICONS.plus}</button>
        </div>
        <div id="text-channel-list"></div>
        <div class="category">
          <span class="category-name">Voice Channels</span>
          <button class="category-add" data-type="voice" title="Create channel" hidden>${ICONS.plus}</button>
        </div>
        <div id="voice-channel-list"></div>
      </div>
      <div id="voice-panel" hidden>
        <div class="voice-panel-info">
          <div class="voice-connected">Voice Connected</div>
          <div id="voice-panel-channel" class="voice-panel-channel"></div>
        </div>
        <button id="leave-voice-btn" class="icon-btn" title="Disconnect">${ICONS.disconnect}</button>
      </div>
      <div id="user-panel">
        <div id="user-panel-avatar"></div>
        <div class="user-panel-text">
          <div id="user-panel-name" class="user-panel-name"></div>
          <div id="user-panel-status" class="user-panel-status">Online</div>
        </div>
        <div class="user-panel-actions">
          <button id="mute-btn" class="icon-btn" title="Mute">${ICONS.mic}</button>
          <button id="admin-btn" class="icon-btn" title="Site admin" hidden>${ICONS.shield}</button>
          <button id="settings-btn" class="icon-btn" title="User Settings">${ICONS.gear}</button>
        </div>
      </div>
    </aside>

    <main id="main-pane">
      <header id="channel-header">
        <button id="sidebar-toggle-btn" class="icon-btn sidebar-toggle" title="Channels">${ICONS.menu}</button>
        <span class="hash-icon" id="channel-header-icon">${ICONS.hash}</span>
        <span id="channel-header-name">Welcome</span>
        <div class="header-actions">
          <button id="toggle-members-btn" class="icon-btn" title="Toggle member list">${ICONS.members}</button>
          <button id="minimize-btn" class="icon-btn" title="Minimize">${ICONS.minimize}</button>
          <button id="close-btn" class="icon-btn" title="Close">${ICONS.close}</button>
        </div>
      </header>
      <div id="message-list"></div>
      <div id="composer" hidden>
        <div id="image-preview" hidden>
          <img id="image-preview-img" alt="" />
          <button id="image-preview-remove" class="icon-btn" title="Remove">${ICONS.close}</button>
        </div>
        <div class="composer-bar">
          <button id="attach-btn" class="icon-btn attach" title="Upload image">${ICONS.plus}</button>
          <input type="file" id="image-input" accept="image/*" hidden />
          <input id="message-input" placeholder="Message" autocomplete="off" />
          <button id="send-btn" class="icon-btn" title="Send">${ICONS.send}</button>
        </div>
      </div>
    </main>

    <aside id="member-sidebar"><div id="member-list"></div></aside>
  </div>

  <div id="settings-modal" class="modal" hidden>
    <div class="modal-card settings-card">
      <nav class="settings-nav">
        <div class="settings-nav-label">User Settings</div>
        <button class="settings-tab active" data-tab="profile">Profile</button>
        <button class="settings-tab" data-tab="account">Account</button>
        <div class="settings-nav-spacer"></div>
        <button id="logout-btn" class="settings-tab danger">Log Out</button>
      </nav>
      <div class="settings-body">
        <button class="icon-btn corner-close" id="settings-close-btn" title="Close">${ICONS.close}</button>
        <section id="settings-tab-profile" class="settings-section">
          <h2>Profile</h2>
          <div class="pfp-row">
            <div id="pfp-preview"></div>
            <div class="pfp-actions">
              <button id="pfp-upload-btn" class="btn btn-primary">Change picture</button>
              <button id="pfp-remove-btn" class="btn btn-secondary">Remove picture</button>
              <input type="file" id="pfp-input" accept="image/*" hidden />
              <div class="hint">JPG or PNG. Cropped to a square.</div>
            </div>
          </div>
          <label class="field-label">Fallback avatar</label>
          <div class="avatar-grid" id="avatar-grid"></div>
          <label class="field-label">Display name</label>
          <input id="profile-name" maxlength="24" autocomplete="off" />
          <label class="field-label">Custom status</label>
          <input id="profile-status" maxlength="60" autocomplete="off" placeholder="What's on your mind?" />
          <div class="row-end"><button id="profile-save-btn" class="btn btn-primary">Save changes</button></div>
          <div id="profile-msg" class="form-msg"></div>
        </section>
        <section id="settings-tab-account" class="settings-section" hidden>
          <h2>Account</h2>
          <label class="field-label">Email</label>
          <input id="account-email" readonly />
          <h3>Change password</h3>
          <label class="field-label">Current password</label>
          <input id="pw-current" type="password" autocomplete="current-password" />
          <label class="field-label">New password</label>
          <input id="pw-new" type="password" autocomplete="new-password" />
          <label class="field-label">Confirm new password</label>
          <input id="pw-confirm" type="password" autocomplete="new-password" />
          <div class="row-end"><button id="pw-save-btn" class="btn btn-primary">Update password</button></div>
          <div id="pw-msg" class="form-msg"></div>
        </section>
      </div>
    </div>
  </div>

  <div id="add-server-modal" class="modal" hidden>
    <div class="modal-card small-card">
      <div class="modal-header"><span>Add a server</span><button id="add-server-close" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="modal-tabs">
        <button class="tab-btn active" data-atab="create">Create</button>
        <button class="tab-btn" data-atab="join">Join</button>
      </div>
      <div id="atab-create" class="admin-tab">
        <label class="field-label">Server name</label>
        <input id="create-server-name" maxlength="40" placeholder="My cool server" />
        <div class="row-end"><button id="create-server-btn" class="btn btn-primary">Create Server</button></div>
      </div>
      <div id="atab-join" class="admin-tab" hidden>
        <label class="field-label">Invite code</label>
        <input id="join-server-code" maxlength="12" placeholder="e.g. 7KQ2M9XZ" autocomplete="off" />
        <div class="row-end"><button id="join-server-btn" class="btn btn-primary">Join Server</button></div>
      </div>
      <div id="add-server-msg" class="form-msg modal-foot-msg"></div>
    </div>
  </div>

  <div id="invite-modal" class="modal" hidden>
    <div class="modal-card small-card">
      <div class="modal-header"><span>Invite people</span><button id="invite-close" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="admin-tab">
        <div class="hint">Share this code. Friends enter it under <b>+ &rarr; Join</b> in the left rail.</div>
        <div class="invite-row"><code id="invite-code"></code><button id="invite-copy" class="btn btn-primary btn-sm">Copy</button></div>
        <div id="invite-msg" class="form-msg"></div>
      </div>
    </div>
  </div>

  <div id="server-settings-modal" class="modal" hidden>
    <div class="modal-card admin-card">
      <div class="modal-header"><span id="server-settings-title">Server Settings</span><button id="server-settings-close" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="modal-tabs">
        <button class="tab-btn active" data-stab="overview">Overview</button>
        <button class="tab-btn" data-stab="channels">Channels</button>
        <button class="tab-btn" data-stab="members">Members</button>
      </div>
      <div id="stab-overview" class="admin-tab">
        <label class="field-label">Server name</label>
        <input id="server-rename-input" maxlength="40" />
        <div class="row-end"><button id="server-rename-btn" class="btn btn-primary">Save</button></div>
        <label class="field-label">Invite code</label>
        <div class="invite-row"><code id="settings-invite-code"></code></div>
        <h3>Danger zone</h3>
        <div class="hint">Deleting a server removes it for everyone. This can't be undone.</div>
        <div class="row-end"><button id="server-delete-btn" class="btn btn-danger">Delete Server</button></div>
        <div id="server-settings-msg" class="form-msg"></div>
      </div>
      <div id="stab-channels" class="admin-tab" hidden>
        <form id="new-channel-form">
          <input id="new-channel-name" placeholder="new-channel" autocomplete="off" maxlength="32" />
          <select id="new-channel-type">
            <option value="text">Text</option>
            <option value="voice">Voice</option>
          </select>
          <button type="submit" class="btn btn-primary">Create</button>
        </form>
        <div id="admin-channel-list"></div>
      </div>
      <div id="stab-members" class="admin-tab" hidden><div id="server-member-list"></div></div>
    </div>
  </div>

  <div id="admin-modal" class="modal" hidden>
    <div class="modal-card admin-card">
      <div class="modal-header"><span>Site Admin</span><button id="admin-close-btn" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="modal-tabs">
        <button class="tab-btn active" data-tab="servers">All Servers</button>
        <button class="tab-btn" data-tab="users">All Users</button>
      </div>
      <div id="admin-tab-servers" class="admin-tab"><div id="admin-server-list"></div></div>
      <div id="admin-tab-users" class="admin-tab" hidden><div id="admin-user-list"></div></div>
    </div>
  </div>

  <div id="lightbox" class="modal" hidden><img id="lightbox-img" alt="" /></div>
</div>
`;

(async function main() {
  if (window.__DARKWEB_LOADED__) {
    window.__DARKWEB_TOGGLE__ && window.__DARKWEB_TOGGLE__();
    return;
  }
  window.__DARKWEB_LOADED__ = true;

  const host = document.createElement("div");
  host.id = "darkweb-host";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.zIndex = "2147483647";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  // Cache-bust sibling files so relaunching the bookmarklet always picks up the latest deploy.
  const bust = "?v=" + Date.now();
  let css = "";
  try {
    css = await fetch(new URL("./styles.css" + bust, import.meta.url)).then((r) => r.text());
  } catch (e) {
    console.error("Dark Web: failed to load styles.css", e);
  }
  const [{ firebaseConfig }, { VoiceManager }] = await Promise.all([
    import(new URL("./firebase-config.js" + bust, import.meta.url).href),
    import(new URL("./lib/webrtc.js" + bust, import.meta.url).href),
  ]);
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  shadow.appendChild(styleEl);

  const container = document.createElement("div");
  container.innerHTML = TEMPLATE;
  shadow.appendChild(container);

  const $ = (sel) => shadow.querySelector(sel);
  const $$ = (sel) => Array.from(shadow.querySelectorAll(sel));

  let visible = true;
  window.__DARKWEB_TOGGLE__ = () => {
    visible = !visible;
    host.style.display = visible ? "block" : "none";
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // ---------- state ----------
  let me = null;
  let lastRole = null;
  let usersCache = new Map();
  let servers = [];
  let currentServer = null;
  let pendingSelectServer = null;
  let channelsCache = [];
  let currentTextChannel = null;
  let currentVoiceChannel = null;
  let currentVoiceServer = null;
  let currentVoice = null;
  let muted = false;
  let pendingImage = null;
  let lastMessages = [];
  let messagesFirstRender = true;
  let selectedAvatarEmoji = DEFAULT_EMOJI;
  let pendingPfp = undefined;
  const voiceParticipants = new Map();
  const voiceListeners = new Map();
  const remoteAudioEls = new Map();
  let unsubServers = null;
  let unsubMessages = null;
  let unsubChannels = null;
  let unsubUsers = null;
  let unsubMe = null;
  let heartbeatTimer = null;
  let membersRefreshTimer = null;

  // ---------- helpers ----------
  const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const ts = (t) => (t && t.toDate ? t.toDate().getTime() : Date.now());

  function avatarColor(uid) {
    let h = 0;
    for (const c of uid || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function makeAvatar(profile, uid, sizeClass, withStatus) {
    const el = document.createElement("div");
    el.className = "avatar " + sizeClass;
    if (profile && profile.avatarUrl) {
      const img = document.createElement("img");
      img.src = profile.avatarUrl;
      img.alt = "";
      el.appendChild(img);
    } else {
      el.textContent = (profile && profile.avatarEmoji) || DEFAULT_EMOJI;
      el.style.background = avatarColor(uid);
    }
    if (withStatus) {
      const dot = document.createElement("span");
      dot.className = "status-dot " + (profile && isOnline(profile) ? "online" : "offline");
      el.appendChild(dot);
    }
    return el;
  }

  function serverInitials(name) {
    return (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  function genCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes).map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  }

  const profileFor = (uid, fallback) => usersCache.get(uid) || fallback || {};
  const isGlobalAdmin = () => me && me.role === "admin";
  const canManage = (s) => !!(me && s && (isGlobalAdmin() || s.ownerUid === me.uid));
  const isMemberOf = (s) => !!(me && s && (s.memberIds || []).includes(me.uid));

  function isOnline(u) {
    const t = u && u.lastActive && u.lastActive.toDate ? u.lastActive.toDate().getTime() : 0;
    return Date.now() - t < ONLINE_WINDOW_MS;
  }

  function formatTime(date) {
    const now = new Date();
    const t = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(date, now)) return "Today at " + t;
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (sameDay(date, y)) return "Yesterday at " + t;
    return date.toLocaleDateString() + " " + t;
  }

  function readImageFile(file, { maxDim, square, quality }) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
        if (square) {
          const s = Math.min(sw, sh);
          sx = (sw - s) / 2;
          sy = (sh - s) / 2;
          sw = sh = s;
        }
        const scale = Math.min(1, maxDim / Math.max(sw, sh));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(sw * scale));
        canvas.height = Math.max(1, Math.round(sh * scale));
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image."));
      };
      img.src = url;
    });
  }

  async function compressChatImage(file) {
    let data = await readImageFile(file, { maxDim: 900, quality: 0.75 });
    if (data.length > MAX_IMAGE_BYTES) data = await readImageFile(file, { maxDim: 640, quality: 0.55 });
    if (data.length > MAX_IMAGE_BYTES) throw new Error("That image is too large even after compression.");
    return data;
  }

  function setMsg(sel, text, kind) {
    const el = $(sel);
    el.textContent = text || "";
    el.className = el.className.replace(/\b(error|ok)\b/g, "").trim() + (kind ? " " + kind : "");
  }

  function friendlyAuthError(e) {
    const map = {
      "auth/email-already-in-use": "An account with that email already exists.",
      "auth/invalid-email": "That doesn't look like a valid email address.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "No account found with that email.",
      "auth/too-many-requests": "Too many attempts. Try again in a bit.",
      "auth/requires-recent-login": "Please log out and back in, then try again.",
    };
    return map[e.code] || e.message;
  }

  function showScreen(id) {
    ["login-screen", "banned-screen", "app-screen"].forEach((s) => {
      $("#" + s).hidden = s !== id;
    });
  }
  const openModal = (id) => { $("#" + id).hidden = false; };
  const closeModal = (id) => { $("#" + id).hidden = true; };
  function closeAllModals() {
    $$(".modal").forEach((m) => (m.hidden = true));
    $("#server-menu").hidden = true;
  }
  function bindTabs(attr, prefix) {
    $$(".tab-btn[" + attr + "]").forEach((btn) => {
      btn.addEventListener("click", () => showTabs(attr, prefix, btn.getAttribute(attr)));
    });
  }
  function showTabs(attr, prefix, tab) {
    $$(".tab-btn[" + attr + "]").forEach((b) => b.classList.toggle("active", b.getAttribute(attr) === tab));
    $$("[id^='" + prefix + "']").forEach((panel) => (panel.hidden = panel.id !== prefix + tab));
  }

  // ---------- teardown ----------
  function teardownServerListeners() {
    if (unsubMessages) unsubMessages();
    if (unsubChannels) unsubChannels();
    unsubMessages = unsubChannels = null;
    voiceListeners.forEach((fn) => fn());
    voiceListeners.clear();
    voiceParticipants.clear();
  }

  function stopSessionListeners() {
    teardownServerListeners();
    if (unsubServers) unsubServers();
    if (unsubUsers) unsubUsers();
    if (unsubMe) unsubMe();
    unsubServers = unsubUsers = unsubMe = null;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (membersRefreshTimer) clearInterval(membersRefreshTimer);
    heartbeatTimer = membersRefreshTimer = null;
  }

  async function leaveVoice() {
    if (currentVoice) await currentVoice.leave();
    currentVoice = null;
    currentVoiceChannel = null;
    currentVoiceServer = null;
    remoteAudioEls.forEach((el) => el.remove());
    remoteAudioEls.clear();
    $("#voice-panel").hidden = true;
    renderChannels();
    renderUserPanel();
  }

  async function closeApp() {
    await leaveVoice();
    stopSessionListeners();
    window.removeEventListener("resize", syncLayoutForWidth);
    host.remove();
    window.__DARKWEB_LOADED__ = false;
    delete window.__DARKWEB_TOGGLE__;
  }

  $("#close-btn").addEventListener("click", closeApp);
  $("#login-close-btn").addEventListener("click", closeApp);
  $("#banned-close-btn").addEventListener("click", closeApp);
  $("#minimize-btn").addEventListener("click", () => window.__DARKWEB_TOGGLE__());
  shadow.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
  $$(".modal").forEach((m) => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.hidden = true;
    });
  });
  shadow.addEventListener("click", (e) => {
    const path = e.composedPath();
    if (!path.includes($("#server-header")) && !path.includes($("#server-menu"))) $("#server-menu").hidden = true;
  });

  // ---------- auth ----------
  let authMode = "login";
  function setAuthMode(mode) {
    authMode = mode;
    const signup = mode === "signup";
    $("#signup-fields").hidden = !signup;
    $("#forgot-password-row").hidden = signup;
    $("#auth-title").textContent = signup ? "Create an account" : "Welcome back!";
    $("#auth-subtitle").textContent = signup ? "Pick a name and you're in." : "We're so excited to see you again!";
    $("#auth-submit-btn").textContent = signup ? "Continue" : "Log In";
    $("#auth-switch-text").textContent = signup ? "Already have an account?" : "Need an account?";
    $("#auth-switch-link").textContent = signup ? "Log In" : "Register";
    setMsg("#login-error", "");
  }
  $("#auth-switch-link").addEventListener("click", (e) => {
    e.preventDefault();
    setAuthMode(authMode === "signup" ? "login" : "signup");
  });
  $("#auth-submit-btn").addEventListener("click", handleAuthSubmit);
  $("#auth-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) handleAuthSubmit();
  });

  async function handleAuthSubmit() {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    setMsg("#login-error", "");
    if (!email || !password) {
      setMsg("#login-error", "Enter an email and password.", "error");
      return;
    }
    if (authMode === "signup") {
      const name = $("#signup-name").value.trim();
      if (!name) {
        setMsg("#login-error", "Enter a display name.", "error");
        return;
      }
      window.__darkwebPendingName = name;
    }
    $("#auth-submit-btn").disabled = true;
    try {
      if (authMode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setMsg("#login-error", friendlyAuthError(e), "error");
    } finally {
      $("#auth-submit-btn").disabled = false;
    }
  }

  $("#forgot-password-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    if (!email) {
      setMsg("#login-error", "Enter your email above first, then click this again.", "error");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg("#login-error", "Password reset email sent to " + email + ".", "ok");
    } catch (err) {
      setMsg("#login-error", friendlyAuthError(err), "error");
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      stopSessionListeners();
      me = null;
      lastRole = null;
      currentServer = null;
      servers = [];
      channelsCache = [];
      currentTextChannel = null;
      usersCache = new Map();
      showScreen("login-screen");
      return;
    }
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: window.__darkwebPendingName || "Member" + user.uid.slice(0, 4),
        role: "member",
        banned: false,
        avatarEmoji: DEFAULT_EMOJI,
        status: "",
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      });
    }

    if (unsubMe) unsubMe();
    unsubMe = onSnapshot(userRef, (s) => {
      const data = s.data();
      if (!data) return;
      if (data.banned) {
        stopSessionListeners();
        showScreen("banned-screen");
        auth.signOut();
        return;
      }
      const firstLoad = !me;
      me = {
        uid: user.uid,
        email: user.email,
        displayName: data.displayName,
        role: data.role,
        avatarEmoji: data.avatarEmoji || DEFAULT_EMOJI,
        avatarUrl: data.avatarUrl || null,
        status: data.status || "",
      };
      $("#admin-btn").hidden = !isGlobalAdmin();
      renderUserPanel();
      if (firstLoad) {
        showScreen("app-screen");
        syncLayoutForWidth();
        startHeartbeat(userRef);
        subscribeUsers();
      }
      if (firstLoad || me.role !== lastRole) subscribeServers();
      lastRole = me.role;
      if (!firstLoad) {
        renderServerHeader();
        renderChannels();
        renderMessages();
      }
    });
  });

  function startHeartbeat(userRef) {
    const beat = () => updateDoc(userRef, { lastActive: serverTimestamp() }).catch(() => {});
    beat();
    heartbeatTimer = setInterval(beat, HEARTBEAT_MS);
    membersRefreshTimer = setInterval(() => {
      renderMembers();
      renderUserPanel();
    }, HEARTBEAT_MS);
  }

  // ---------- users ----------
  function subscribeUsers() {
    if (unsubUsers) unsubUsers();
    unsubUsers = onSnapshot(collection(db, "users"), (qs) => {
      usersCache = new Map();
      qs.forEach((d) => usersCache.set(d.id, d.data()));
      renderMembers();
      renderMessages();
      renderChannels();
      renderAdminUserList();
      renderAdminServerList();
      renderServerMemberList();
    });
  }

  function renderUserPanel() {
    if (!me) return;
    const av = $("#user-panel-avatar");
    av.innerHTML = "";
    av.appendChild(makeAvatar({ ...me, lastActive: { toDate: () => new Date() } }, me.uid, "avatar-32", true));
    $("#user-panel-name").textContent = me.displayName;
    $("#user-panel-status").textContent = me.status || (currentVoiceChannel ? "In voice" : "Online");
  }

  function renderMembers() {
    const list = $("#member-list");
    list.innerHTML = "";
    if (!currentServer) return;
    const members = (currentServer.memberIds || [])
      .map((uid) => ({ uid, ...(usersCache.get(uid) || {}) }))
      .filter((u) => u.displayName && !u.banned);
    const rank = (u) => (u.uid === currentServer.ownerUid ? 0 : u.role === "admin" ? 1 : 2);
    const sortFn = (a, b) => rank(a) - rank(b) || (a.displayName || "").localeCompare(b.displayName || "");
    const online = members.filter(isOnline).sort(sortFn);
    const offline = members.filter((u) => !isOnline(u)).sort(sortFn);

    const section = (title, arr, dim) => {
      if (!arr.length) return;
      const h = document.createElement("div");
      h.className = "member-section";
      h.textContent = title + " — " + arr.length;
      list.appendChild(h);
      arr.forEach((u) => {
        const row = document.createElement("div");
        row.className = "member-row" + (dim ? " offline" : "");
        row.appendChild(makeAvatar(u, u.uid, "avatar-32", true));
        const text = document.createElement("div");
        text.className = "member-text";
        const name = document.createElement("div");
        name.className = "member-name";
        name.textContent = u.displayName;
        if (u.uid === currentServer.ownerUid) name.appendChild(badgeIcon(ICONS.crown, "crown", "Server owner"));
        else if (u.role === "admin") name.appendChild(badgeIcon(ICONS.shield, "badge-admin", "Site admin"));
        text.appendChild(name);
        if (u.status) {
          const st = document.createElement("div");
          st.className = "member-status";
          st.textContent = u.status;
          text.appendChild(st);
        }
        row.appendChild(text);
        list.appendChild(row);
      });
    };
    section("Online", online, false);
    section("Offline", offline, true);
    if (!members.length) list.innerHTML = '<div class="empty-hint small">No members yet</div>';
  }

  function badgeIcon(svg, cls, title) {
    const s = document.createElement("span");
    s.className = cls;
    s.title = title;
    s.innerHTML = svg;
    return s;
  }

  let lastWide = null;
  function syncLayoutForWidth() {
    const wide = host.getBoundingClientRect().width >= 900;
    if (wide === lastWide) return;
    lastWide = wide;
    $("#app-screen").classList.toggle("members-open", wide);
    if (wide) $("#app-screen").classList.remove("sidebar-open");
  }
  window.addEventListener("resize", syncLayoutForWidth);

  $("#toggle-members-btn").addEventListener("click", () => $("#app-screen").classList.toggle("members-open"));
  $("#sidebar-toggle-btn").addEventListener("click", () => $("#app-screen").classList.toggle("sidebar-open"));

  // ---------- servers ----------
  function subscribeServers() {
    if (unsubServers) unsubServers();
    const base = collection(db, "servers");
    const q = isGlobalAdmin() ? base : query(base, where("memberIds", "array-contains", me.uid));
    unsubServers = onSnapshot(
      q,
      (qs) => {
        servers = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
        servers.sort((a, b) => ts(a.createdAt) - ts(b.createdAt) || (a.name || "").localeCompare(b.name || ""));
        renderRail();
        renderAdminServerList();
        let target = null;
        if (pendingSelectServer) {
          target = servers.find((s) => s.id === pendingSelectServer);
          if (target) pendingSelectServer = null;
        }
        if (!target && currentServer) target = servers.find((s) => s.id === currentServer.id);
        if (!target) {
          const last = safeGet("darkweb:lastServer");
          target = servers.find((s) => s.id === last) || servers[0] || null;
        }
        if (target) selectServer(target);
        else showNoServer();
      },
      (err) => {
        console.error("Dark Web: servers listener", err);
        showLoadError(err);
      }
    );
  }

  function showLoadError(err) {
    showNoServer();
    const denied = err && err.code === "permission-denied";
    $("#message-list").innerHTML =
      '<div class="empty-hint"><div class="empty-title">Can\'t load servers</div>' +
      (denied
        ? "Firestore denied access. If you run this Dark Web instance, publish the latest <strong>firestore.rules</strong> from the repo in the Firebase console, then relaunch."
        : "Something went wrong talking to Firebase: " + (err && err.message ? err.message : "unknown error")) +
      "</div>";
  }

  function renderRail() {
    const list = $("#server-list");
    list.innerHTML = "";
    servers.forEach((s) => {
      const el = document.createElement("div");
      el.className =
        "rail-icon" +
        (currentServer && currentServer.id === s.id ? " active" : "") +
        (isMemberOf(s) ? "" : " guest");
      el.title = s.name + (isMemberOf(s) ? "" : " (viewing as admin)");
      el.textContent = serverInitials(s.name);
      el.style.setProperty("--accent", avatarColor(s.id));
      el.addEventListener("click", () => selectServer(s));
      list.appendChild(el);
    });
  }

  function selectServer(s) {
    const same = currentServer && currentServer.id === s.id;
    currentServer = s;
    safeSet("darkweb:lastServer", s.id);
    renderRail();
    renderServerHeader();
    renderMembers();
    renderServerMemberList();
    if (same) {
      renderChannels();
      renderMessages();
      return;
    }
    teardownServerListeners();
    currentTextChannel = null;
    channelsCache = [];
    lastMessages = [];
    $("#app-screen").classList.remove("sidebar-open");
    subscribeChannels();
  }

  function showNoServer() {
    currentServer = null;
    teardownServerListeners();
    currentTextChannel = null;
    channelsCache = [];
    lastMessages = [];
    renderRail();
    renderServerHeader();
    renderChannels();
    renderMembers();
    $("#channel-header-name").textContent = "Welcome";
    $("#composer").hidden = true;
    const list = $("#message-list");
    list.innerHTML =
      '<div class="empty-hint"><div class="empty-logo">' + ICONS.logo + "</div>" +
      '<div class="empty-title">Welcome to Dark Web</div>' +
      "You're not in any servers yet. Create your own or join a friend's with an invite code." +
      '<div class="empty-actions"><button class="btn btn-primary" id="noserver-create">Create a server</button>' +
      '<button class="btn btn-secondary" id="noserver-join">Join with a code</button></div></div>';
    list.querySelector("#noserver-create").addEventListener("click", () => openAddServer("create"));
    list.querySelector("#noserver-join").addEventListener("click", () => openAddServer("join"));
  }

  function renderServerHeader() {
    const s = currentServer;
    $("#server-name").textContent = s ? s.name : "Dark Web";
    $("#server-header").disabled = !s;
    $("#menu-settings").hidden = !canManage(s);
    $("#menu-leave").hidden = !(s && isMemberOf(s) && s.ownerUid !== (me && me.uid));
    $$(".category-add").forEach((b) => (b.hidden = !canManage(s)));
  }

  $("#server-header").addEventListener("click", () => {
    if (!currentServer) return;
    $("#server-menu").hidden = !$("#server-menu").hidden;
  });
  $("#menu-invite").addEventListener("click", () => {
    $("#server-menu").hidden = true;
    $("#invite-code").textContent = currentServer.id;
    setMsg("#invite-msg", "");
    openModal("invite-modal");
  });
  $("#invite-close").addEventListener("click", () => closeModal("invite-modal"));
  $("#invite-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentServer.id);
      setMsg("#invite-msg", "Copied!", "ok");
    } catch (e) {
      setMsg("#invite-msg", "Couldn't copy automatically - select the code and copy it.", "error");
    }
  });
  $("#menu-leave").addEventListener("click", async () => {
    $("#server-menu").hidden = true;
    if (!currentServer || !confirm("Leave " + currentServer.name + "?")) return;
    if (currentVoiceServer === currentServer.id) await leaveVoice();
    try {
      await updateDoc(doc(db, "servers", currentServer.id), { memberIds: arrayRemove(me.uid) });
    } catch (e) {
      alert("Couldn't leave: " + e.message);
    }
  });
  $("#menu-settings").addEventListener("click", () => {
    $("#server-menu").hidden = true;
    openServerSettings("overview");
  });

  // add / join
  bindTabs("data-atab", "atab-");
  function openAddServer(tab) {
    $("#create-server-name").value = "";
    $("#join-server-code").value = "";
    setMsg("#add-server-msg", "");
    showTabs("data-atab", "atab-", tab);
    openModal("add-server-modal");
    $(tab === "create" ? "#create-server-name" : "#join-server-code").focus();
  }
  $("#add-server-btn").addEventListener("click", () => openAddServer("create"));
  $("#add-server-close").addEventListener("click", () => closeModal("add-server-modal"));

  $("#create-server-btn").addEventListener("click", async () => {
    const name = $("#create-server-name").value.trim();
    if (!name) {
      setMsg("#add-server-msg", "Give your server a name.", "error");
      return;
    }
    $("#create-server-btn").disabled = true;
    try {
      const id = genCode();
      pendingSelectServer = id;
      await setDoc(doc(db, "servers", id), {
        name,
        ownerUid: me.uid,
        memberIds: [me.uid],
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, "servers", id, "channels"), { name: "general", type: "text", createdAt: serverTimestamp() });
      await addDoc(collection(db, "servers", id, "channels"), { name: "voice", type: "voice", createdAt: serverTimestamp() });
      closeModal("add-server-modal");
    } catch (e) {
      pendingSelectServer = null;
      setMsg("#add-server-msg", "Couldn't create server: " + e.message, "error");
    } finally {
      $("#create-server-btn").disabled = false;
    }
  });

  $("#join-server-btn").addEventListener("click", async () => {
    const code = $("#join-server-code").value.trim().toUpperCase();
    if (!code) {
      setMsg("#add-server-msg", "Enter an invite code.", "error");
      return;
    }
    $("#join-server-btn").disabled = true;
    try {
      const snap = await getDoc(doc(db, "servers", code));
      if (!snap.exists()) {
        setMsg("#add-server-msg", "No server found with that code.", "error");
        return;
      }
      if ((snap.data().memberIds || []).includes(me.uid)) {
        pendingSelectServer = code;
        closeModal("add-server-modal");
        selectServer({ id: snap.id, ...snap.data() });
        return;
      }
      pendingSelectServer = code;
      await updateDoc(doc(db, "servers", code), { memberIds: arrayUnion(me.uid) });
      closeModal("add-server-modal");
    } catch (e) {
      pendingSelectServer = null;
      setMsg("#add-server-msg", "Couldn't join: " + e.message, "error");
    } finally {
      $("#join-server-btn").disabled = false;
    }
  });
  $("#join-server-code").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) $("#join-server-btn").click();
  });
  $("#create-server-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) $("#create-server-btn").click();
  });

  // server settings (owner / site admin)
  bindTabs("data-stab", "stab-");
  function openServerSettings(tab) {
    if (!currentServer) return;
    $("#server-settings-title").textContent = currentServer.name + " — Settings";
    $("#server-rename-input").value = currentServer.name;
    $("#settings-invite-code").textContent = currentServer.id;
    setMsg("#server-settings-msg", "");
    renderAdminChannelList();
    renderServerMemberList();
    showTabs("data-stab", "stab-", tab);
    openModal("server-settings-modal");
  }
  $("#server-settings-close").addEventListener("click", () => closeModal("server-settings-modal"));
  $("#server-rename-btn").addEventListener("click", async () => {
    const name = $("#server-rename-input").value.trim();
    if (!name) return;
    try {
      await updateDoc(doc(db, "servers", currentServer.id), { name });
      setMsg("#server-settings-msg", "Saved.", "ok");
    } catch (e) {
      setMsg("#server-settings-msg", e.message, "error");
    }
  });
  $("#server-delete-btn").addEventListener("click", async () => {
    if (!currentServer) return;
    if (!confirm('Delete "' + currentServer.name + '" for everyone? This cannot be undone.')) return;
    if (currentVoiceServer === currentServer.id) await leaveVoice();
    try {
      await deleteDoc(doc(db, "servers", currentServer.id));
      closeModal("server-settings-modal");
    } catch (e) {
      setMsg("#server-settings-msg", e.message, "error");
    }
  });

  function renderServerMemberList() {
    const list = $("#server-member-list");
    if (!list || !currentServer) return;
    list.innerHTML = "";
    (currentServer.memberIds || []).forEach((uid) => {
      const u = usersCache.get(uid);
      if (!u) return;
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      label.appendChild(makeAvatar(u, uid, "avatar-24", false));
      const name = document.createElement("span");
      name.textContent = u.displayName;
      label.appendChild(name);
      if (uid === currentServer.ownerUid) label.appendChild(badgeIcon(ICONS.crown, "crown", "Owner"));
      const actions = document.createElement("span");
      if (uid !== currentServer.ownerUid && uid !== me.uid) {
        const kick = document.createElement("button");
        kick.className = "btn btn-danger btn-sm";
        kick.textContent = "Kick";
        kick.addEventListener("click", async () => {
          if (confirm("Kick " + u.displayName + "?")) {
            await updateDoc(doc(db, "servers", currentServer.id), { memberIds: arrayRemove(uid) });
          }
        });
        actions.appendChild(kick);
      }
      row.appendChild(label);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  // ---------- channels ----------
  const channelsCol = () => collection(db, "servers", currentServer.id, "channels");

  function subscribeChannels() {
    if (unsubChannels) unsubChannels();
    if (!currentServer) return;
    const sid = currentServer.id;
    unsubChannels = onSnapshot(
      query(channelsCol(), orderBy("createdAt")),
      (qs) => {
        if (!currentServer || currentServer.id !== sid) return;
        channelsCache = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
        syncVoiceListeners();
        renderChannels();
        renderAdminChannelList();
        const stillExists = currentTextChannel && channelsCache.some((c) => c.id === currentTextChannel.id);
        if (!stillExists) {
          currentTextChannel = null;
          const firstText = channelsCache.find((c) => c.type === "text");
          if (firstText) selectTextChannel(firstText);
          else showNoChannels();
        } else {
          const fresh = channelsCache.find((c) => c.id === currentTextChannel.id);
          if (fresh.name !== currentTextChannel.name) selectTextChannel(fresh);
        }
        if (currentVoiceServer === sid && currentVoiceChannel && !channelsCache.some((c) => c.id === currentVoiceChannel)) {
          leaveVoice();
        }
      },
      (err) => console.error("Dark Web: channels listener", err)
    );
  }

  function syncVoiceListeners() {
    const sid = currentServer.id;
    const voiceIds = channelsCache.filter((c) => c.type === "voice").map((c) => c.id);
    voiceIds.forEach((id) => {
      if (voiceListeners.has(id)) return;
      const unsub = onSnapshot(collection(db, "servers", sid, "voiceChannels", id, "participants"), (qs) => {
        voiceParticipants.set(id, qs.docs.map((d) => ({ uid: d.id, ...d.data() })));
        renderChannels();
      });
      voiceListeners.set(id, unsub);
    });
    Array.from(voiceListeners.keys()).forEach((id) => {
      if (!voiceIds.includes(id)) {
        voiceListeners.get(id)();
        voiceListeners.delete(id);
        voiceParticipants.delete(id);
      }
    });
  }

  function renderChannels() {
    const textList = $("#text-channel-list");
    const voiceList = $("#voice-channel-list");
    textList.innerHTML = "";
    voiceList.innerHTML = "";
    $$(".category").forEach((c) => (c.hidden = !currentServer));
    if (!currentServer) return;
    const text = channelsCache.filter((c) => c.type === "text");
    const voice = channelsCache.filter((c) => c.type === "voice");
    if (!text.length) textList.innerHTML = '<div class="empty-hint small">No text channels</div>';
    if (!voice.length) voiceList.innerHTML = '<div class="empty-hint small">No voice channels</div>';

    text.forEach((c) => {
      const el = document.createElement("div");
      el.className = "channel-item" + (currentTextChannel && currentTextChannel.id === c.id ? " active" : "");
      el.innerHTML = '<span class="ch-icon">' + ICONS.hash + '</span><span class="ch-name"></span>';
      el.querySelector(".ch-name").textContent = c.name;
      el.addEventListener("click", () => selectTextChannel(c));
      textList.appendChild(el);
    });

    voice.forEach((c) => {
      const wrap = document.createElement("div");
      const el = document.createElement("div");
      const active = currentVoiceServer === currentServer.id && currentVoiceChannel === c.id;
      el.className = "channel-item" + (active ? " active" : "");
      el.innerHTML = '<span class="ch-icon">' + ICONS.speaker + '</span><span class="ch-name"></span>';
      el.querySelector(".ch-name").textContent = c.name;
      el.addEventListener("click", () => joinVoiceChannel(c));
      wrap.appendChild(el);
      const parts = voiceParticipants.get(c.id) || [];
      if (parts.length) {
        const ul = document.createElement("div");
        ul.className = "voice-members";
        parts.forEach((p) => {
          const row = document.createElement("div");
          row.className = "voice-member";
          const prof = profileFor(p.uid, p);
          row.appendChild(makeAvatar(prof, p.uid, "avatar-24", false));
          const n = document.createElement("span");
          n.textContent = prof.displayName || p.displayName || "Unknown";
          row.appendChild(n);
          ul.appendChild(row);
        });
        wrap.appendChild(ul);
      }
      voiceList.appendChild(wrap);
    });
  }

  $$(".category-add").forEach((btn) => {
    btn.addEventListener("click", () => {
      $("#new-channel-type").value = btn.dataset.type;
      openServerSettings("channels");
      $("#new-channel-name").focus();
    });
  });

  function showNoChannels() {
    currentTextChannel = null;
    lastMessages = [];
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    $("#channel-header-name").textContent = currentServer ? currentServer.name : "Welcome";
    $("#composer").hidden = true;
    $("#message-list").innerHTML =
      '<div class="empty-hint"><div class="empty-title">No channels yet</div>' +
      (canManage(currentServer)
        ? "Hit the <strong>+</strong> next to a category in the sidebar to create the first one."
        : "Ask the server owner to create one.") +
      "</div>";
    renderChannels();
  }

  // ---------- messages ----------
  const messagesCol = () => collection(db, "servers", currentServer.id, "channels", currentTextChannel.id, "messages");

  function selectTextChannel(ch) {
    const switching = !currentTextChannel || currentTextChannel.id !== ch.id;
    currentTextChannel = ch;
    $("#channel-header-name").textContent = ch.name;
    $("#composer").hidden = false;
    $("#message-input").placeholder = "Message #" + ch.name;
    $("#app-screen").classList.remove("sidebar-open");
    renderChannels();
    if (!switching) return;
    messagesFirstRender = true;
    if (unsubMessages) unsubMessages();
    const sid = currentServer.id;
    unsubMessages = onSnapshot(
      query(messagesCol(), orderBy("createdAt"), limit(MESSAGE_LIMIT)),
      (qs) => {
        if (!currentServer || currentServer.id !== sid || !currentTextChannel || currentTextChannel.id !== ch.id) return;
        lastMessages = qs.docs.map((d) => ({ id: d.id, data: d.data() }));
        renderMessages();
      },
      (err) => console.error("Dark Web: messages listener", err)
    );
  }

  function welcomeBlock(name) {
    const w = document.createElement("div");
    w.className = "welcome";
    w.innerHTML =
      '<div class="welcome-icon">' + ICONS.hash + "</div>" +
      '<h2>Welcome to #<span></span>!</h2>' +
      '<p>This is the start of the #<b></b> channel.</p>';
    w.querySelector("span").textContent = name;
    w.querySelector("b").textContent = name;
    return w;
  }

  function renderMessages() {
    const list = $("#message-list");
    if (!currentServer || !currentTextChannel) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    list.innerHTML = "";
    if (lastMessages.length < MESSAGE_LIMIT) list.appendChild(welcomeBlock(currentTextChannel.name));

    let prev = null;
    lastMessages.forEach(({ id, data: m }) => {
      const date = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : new Date();
      const cont = prev && prev.uid === m.uid && date - prev.date < GROUP_WINDOW_MS;
      const prof = profileFor(m.uid, { displayName: m.displayName, avatarEmoji: m.avatarEmoji });

      const row = document.createElement("div");
      row.className = "msg" + (cont ? " cont" : "");
      const gutter = document.createElement("div");
      gutter.className = "msg-gutter";
      if (cont) {
        const t = document.createElement("span");
        t.className = "msg-time-inline";
        t.textContent = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        gutter.appendChild(t);
      } else {
        gutter.appendChild(makeAvatar(prof, m.uid, "avatar-40", false));
      }
      row.appendChild(gutter);

      const body = document.createElement("div");
      body.className = "msg-body";
      if (!cont) {
        const header = document.createElement("div");
        header.className = "msg-header";
        const author = document.createElement("span");
        author.className = "msg-author";
        author.textContent = prof.displayName || m.displayName || "Unknown";
        const badgeText = m.uid === currentServer.ownerUid ? "OWNER" : prof.role === "admin" ? "ADMIN" : null;
        if (badgeText) {
          const badge = document.createElement("span");
          badge.className = "role-badge";
          badge.textContent = badgeText;
          author.appendChild(badge);
        }
        const time = document.createElement("span");
        time.className = "msg-time";
        time.textContent = formatTime(date);
        header.appendChild(author);
        header.appendChild(time);
        body.appendChild(header);
      }
      if (m.text) {
        const text = document.createElement("div");
        text.className = "msg-text";
        text.textContent = m.text;
        body.appendChild(text);
      }
      if (m.imageData) {
        const img = document.createElement("img");
        img.className = "msg-image";
        img.src = m.imageData;
        img.alt = "attachment";
        img.addEventListener("click", () => {
          $("#lightbox-img").src = m.imageData;
          openModal("lightbox");
        });
        body.appendChild(img);
      }
      row.appendChild(body);

      if (me && (canManage(currentServer) || me.uid === m.uid)) {
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const del = document.createElement("button");
        del.className = "icon-btn danger";
        del.title = "Delete message";
        del.innerHTML = ICONS.trash;
        del.addEventListener("click", () => deleteDoc(doc(messagesCol(), id)));
        actions.appendChild(del);
        row.appendChild(actions);
      }
      list.appendChild(row);
      prev = { uid: m.uid, date };
    });

    if (nearBottom || messagesFirstRender) list.scrollTop = list.scrollHeight;
    messagesFirstRender = false;
  }

  $("#send-btn").addEventListener("click", sendMessage);
  $("#message-input").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    const input = $("#message-input");
    const text = input.value.trim();
    if ((!text && !pendingImage) || !currentServer || !currentTextChannel || !me) return;
    const payload = {
      text,
      uid: me.uid,
      displayName: me.displayName,
      avatarEmoji: me.avatarEmoji,
      createdAt: serverTimestamp(),
    };
    if (pendingImage) payload.imageData = pendingImage;
    input.value = "";
    clearPendingImage();
    try {
      await addDoc(messagesCol(), payload);
    } catch (e) {
      alert("Couldn't send: " + e.message);
    }
  }

  $("#attach-btn").addEventListener("click", () => $("#image-input").click());
  $("#image-input").addEventListener("change", async () => {
    const file = $("#image-input").files[0];
    $("#image-input").value = "";
    if (!file) return;
    try {
      pendingImage = await compressChatImage(file);
      $("#image-preview-img").src = pendingImage;
      $("#image-preview").hidden = false;
      $("#message-input").focus();
    } catch (e) {
      alert(e.message);
    }
  });
  $("#image-preview-remove").addEventListener("click", clearPendingImage);
  function clearPendingImage() {
    pendingImage = null;
    $("#image-preview").hidden = true;
    $("#image-preview-img").src = "";
  }

  // ---------- voice ----------
  async function joinVoiceChannel(ch) {
    if (!me || !currentServer) return;
    const sid = currentServer.id;
    if (currentVoiceServer === sid && currentVoiceChannel === ch.id) return;
    if (currentVoice) await currentVoice.leave();
    remoteAudioEls.forEach((el) => el.remove());
    remoteAudioEls.clear();
    currentVoice = new VoiceManager(db, me.uid, { displayName: me.displayName, avatarEmoji: me.avatarEmoji }, {
      onRemoteStream: attachRemoteAudio,
      onError: (msg) => alert(msg),
    });
    const ok = await currentVoice.join(["servers", sid, "voiceChannels", ch.id]);
    if (!ok) {
      currentVoice = null;
      return;
    }
    currentVoice.setMuted(muted);
    currentVoiceChannel = ch.id;
    currentVoiceServer = sid;
    $("#voice-panel").hidden = false;
    $("#voice-panel-channel").textContent = ch.name + " / " + currentServer.name;
    renderChannels();
    renderUserPanel();
  }

  $("#leave-voice-btn").addEventListener("click", leaveVoice);

  function updateMuteButton() {
    const btn = $("#mute-btn");
    btn.innerHTML = muted ? ICONS.micOff : ICONS.mic;
    btn.title = muted ? "Unmute" : "Mute";
    btn.classList.toggle("muted", muted);
  }
  $("#mute-btn").addEventListener("click", () => {
    muted = !muted;
    if (currentVoice) currentVoice.setMuted(muted);
    updateMuteButton();
  });

  function attachRemoteAudio(uid, stream) {
    if (!stream) {
      const el = remoteAudioEls.get(uid);
      if (el) {
        el.remove();
        remoteAudioEls.delete(uid);
      }
      return;
    }
    let el = remoteAudioEls.get(uid);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      shadow.appendChild(el);
      remoteAudioEls.set(uid, el);
    }
    el.srcObject = stream;
  }

  // ---------- user settings ----------
  const avatarGrid = $("#avatar-grid");
  AVATAR_CHOICES.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-choice";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      selectedAvatarEmoji = emoji;
      avatarGrid.querySelectorAll(".avatar-choice").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      renderPfpPreview();
    });
    avatarGrid.appendChild(btn);
  });

  function showSettingsTab(tab) {
    $$(".settings-tab[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("#settings-tab-profile").hidden = tab !== "profile";
    $("#settings-tab-account").hidden = tab !== "account";
  }
  $$(".settings-tab[data-tab]").forEach((btn) => btn.addEventListener("click", () => showSettingsTab(btn.dataset.tab)));

  function renderPfpPreview() {
    const box = $("#pfp-preview");
    box.innerHTML = "";
    const url = pendingPfp === undefined ? me.avatarUrl : pendingPfp;
    box.appendChild(makeAvatar({ avatarUrl: url, avatarEmoji: selectedAvatarEmoji }, me.uid, "avatar-80", false));
  }

  $("#settings-btn").addEventListener("click", () => {
    if (!me) return;
    pendingPfp = undefined;
    selectedAvatarEmoji = me.avatarEmoji;
    avatarGrid.querySelectorAll(".avatar-choice").forEach((b) => b.classList.toggle("selected", b.textContent === selectedAvatarEmoji));
    $("#profile-name").value = me.displayName;
    $("#profile-status").value = me.status;
    $("#account-email").value = me.email || "";
    ["#pw-current", "#pw-new", "#pw-confirm"].forEach((s) => ($(s).value = ""));
    setMsg("#profile-msg", "");
    setMsg("#pw-msg", "");
    renderPfpPreview();
    showSettingsTab("profile");
    openModal("settings-modal");
  });
  $("#settings-close-btn").addEventListener("click", () => closeModal("settings-modal"));

  $("#pfp-upload-btn").addEventListener("click", () => $("#pfp-input").click());
  $("#pfp-input").addEventListener("change", async () => {
    const file = $("#pfp-input").files[0];
    $("#pfp-input").value = "";
    if (!file) return;
    try {
      pendingPfp = await readImageFile(file, { maxDim: 128, square: true, quality: 0.85 });
      renderPfpPreview();
      setMsg("#profile-msg", "Picture ready. Click Save changes to apply.", "ok");
    } catch (e) {
      setMsg("#profile-msg", e.message, "error");
    }
  });
  $("#pfp-remove-btn").addEventListener("click", () => {
    pendingPfp = null;
    renderPfpPreview();
  });

  $("#profile-save-btn").addEventListener("click", async () => {
    if (!me) return;
    const displayName = $("#profile-name").value.trim();
    const status = $("#profile-status").value.trim();
    if (!displayName) {
      setMsg("#profile-msg", "Display name can't be empty.", "error");
      return;
    }
    const update = { displayName, status, avatarEmoji: selectedAvatarEmoji };
    if (pendingPfp === null) update.avatarUrl = deleteField();
    else if (typeof pendingPfp === "string") update.avatarUrl = pendingPfp;
    try {
      await updateDoc(doc(db, "users", me.uid), update);
      pendingPfp = undefined;
      setMsg("#profile-msg", "Saved.", "ok");
    } catch (e) {
      setMsg("#profile-msg", "Couldn't save: " + e.message, "error");
    }
  });

  $("#pw-save-btn").addEventListener("click", async () => {
    const current = $("#pw-current").value;
    const next = $("#pw-new").value;
    const confirmPw = $("#pw-confirm").value;
    setMsg("#pw-msg", "");
    if (!current || !next) {
      setMsg("#pw-msg", "Fill in your current and new password.", "error");
      return;
    }
    if (next.length < 6) {
      setMsg("#pw-msg", "New password must be at least 6 characters.", "error");
      return;
    }
    if (next !== confirmPw) {
      setMsg("#pw-msg", "New passwords don't match.", "error");
      return;
    }
    const user = auth.currentUser;
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);
      ["#pw-current", "#pw-new", "#pw-confirm"].forEach((s) => ($(s).value = ""));
      setMsg("#pw-msg", "Password updated.", "ok");
    } catch (e) {
      setMsg("#pw-msg", friendlyAuthError(e), "error");
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await leaveVoice();
    closeModal("settings-modal");
    await auth.signOut();
  });

  // ---------- channel admin (server settings) ----------
  function renderAdminChannelList() {
    const list = $("#admin-channel-list");
    list.innerHTML = "";
    if (!currentServer) return;
    if (!channelsCache.length) {
      list.innerHTML = '<div class="empty-hint small">No channels yet. Create one above.</div>';
      return;
    }
    channelsCache.forEach((c) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      label.innerHTML = '<span class="ch-icon">' + (c.type === "text" ? ICONS.hash : ICONS.speaker) + "</span><span></span>";
      label.querySelector("span:last-child").textContent = c.name;
      const actions = document.createElement("span");
      const renameBtn = document.createElement("button");
      renameBtn.className = "btn btn-secondary btn-sm";
      renameBtn.textContent = "Rename";
      renameBtn.addEventListener("click", async () => {
        const name = prompt("New name", c.name);
        if (name && name.trim()) await updateDoc(doc(channelsCol(), c.id), { name: name.trim() });
      });
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (confirm("Delete #" + c.name + "? Messages in it will no longer be visible.")) {
          await deleteDoc(doc(channelsCol(), c.id));
        }
      });
      actions.appendChild(renameBtn);
      actions.appendChild(delBtn);
      row.appendChild(label);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  $("#new-channel-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentServer) return;
    const name = $("#new-channel-name").value.trim().toLowerCase().replace(/\s+/g, "-");
    const type = $("#new-channel-type").value;
    if (!name) return;
    try {
      await addDoc(channelsCol(), { name, type, createdAt: serverTimestamp() });
      $("#new-channel-name").value = "";
    } catch (err) {
      alert("Couldn't create channel: " + err.message);
    }
  });

  // ---------- site admin ----------
  bindTabs("data-tab", "admin-tab-");
  $("#admin-btn").addEventListener("click", () => {
    renderAdminServerList();
    renderAdminUserList();
    showTabs("data-tab", "admin-tab-", "servers");
    openModal("admin-modal");
  });
  $("#admin-close-btn").addEventListener("click", () => closeModal("admin-modal"));

  function renderAdminServerList() {
    const list = $("#admin-server-list");
    if (!list || !isGlobalAdmin()) return;
    list.innerHTML = "";
    if (!servers.length) {
      list.innerHTML = '<div class="empty-hint small">No servers exist yet.</div>';
      return;
    }
    servers.forEach((s) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      const icon = document.createElement("span");
      icon.className = "mini-server";
      icon.textContent = serverInitials(s.name);
      icon.style.background = avatarColor(s.id);
      label.appendChild(icon);
      const text = document.createElement("span");
      const owner = usersCache.get(s.ownerUid);
      text.innerHTML = "<b></b><br><small></small>";
      text.querySelector("b").textContent = s.name;
      text.querySelector("small").textContent =
        (s.memberIds || []).length + " member" + ((s.memberIds || []).length === 1 ? "" : "s") +
        " · owner: " + (owner ? owner.displayName : "unknown") + " · code " + s.id;
      label.appendChild(text);
      const actions = document.createElement("span");
      const open = document.createElement("button");
      open.className = "btn btn-secondary btn-sm";
      open.textContent = "Open";
      open.addEventListener("click", () => {
        closeModal("admin-modal");
        selectServer(s);
      });
      const del = document.createElement("button");
      del.className = "btn btn-danger btn-sm";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        if (confirm('Delete "' + s.name + '" for everyone?')) {
          if (currentVoiceServer === s.id) await leaveVoice();
          await deleteDoc(doc(db, "servers", s.id));
        }
      });
      actions.appendChild(open);
      actions.appendChild(del);
      row.appendChild(label);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function renderAdminUserList() {
    const list = $("#admin-user-list");
    if (!list || !isGlobalAdmin()) return;
    list.innerHTML = "";
    const users = Array.from(usersCache.entries()).map(([uid, u]) => ({ uid, ...u }));
    users.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
    users.forEach((u) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      label.appendChild(makeAvatar(u, u.uid, "avatar-24", false));
      const name = document.createElement("span");
      name.textContent = u.displayName || "Unknown";
      label.appendChild(name);
      if (u.role === "admin") {
        const b = document.createElement("span");
        b.className = "role-badge";
        b.textContent = "ADMIN";
        label.appendChild(b);
      }
      if (u.banned) {
        const b = document.createElement("span");
        b.className = "role-badge banned";
        b.textContent = "BANNED";
        label.appendChild(b);
      }
      const actions = document.createElement("span");
      const isSelf = u.uid === me.uid;
      const roleBtn = document.createElement("button");
      roleBtn.className = "btn btn-secondary btn-sm";
      roleBtn.textContent = u.role === "admin" ? "Demote" : "Promote";
      roleBtn.disabled = isSelf;
      roleBtn.addEventListener("click", () => updateDoc(doc(db, "users", u.uid), { role: u.role === "admin" ? "member" : "admin" }));
      const banBtn = document.createElement("button");
      banBtn.className = "btn btn-danger btn-sm";
      banBtn.textContent = u.banned ? "Unban" : "Ban";
      banBtn.disabled = isSelf;
      banBtn.addEventListener("click", () => updateDoc(doc(db, "users", u.uid), { banned: !u.banned }));
      actions.appendChild(roleBtn);
      actions.appendChild(banBtn);
      row.appendChild(label);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  updateMuteButton();
  setAuthMode("login");
})();
