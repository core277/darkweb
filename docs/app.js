import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, query, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { VoiceManager } from "./lib/webrtc.js";

const TEMPLATE = `
<div id="root">
  <div id="login-screen" class="screen">
    <div class="login-card">
      <button id="login-close-btn" class="corner-close" title="Close">x</button>
      <h1>Dark Web</h1>
      <div class="auth-tabs">
        <button class="auth-tab-btn active" data-mode="login">Log In</button>
        <button class="auth-tab-btn" data-mode="signup">Sign Up</button>
      </div>
      <div id="signup-fields" hidden>
        <input id="signup-name" maxlength="24" placeholder="Display name" autocomplete="nickname" />
      </div>
      <input id="auth-email" type="email" placeholder="Email" autocomplete="email" />
      <input id="auth-password" type="password" placeholder="Password" autocomplete="current-password" />
      <button id="auth-submit-btn">Log In</button>
      <div class="link-row" id="forgot-password-row"><a href="#" id="forgot-password-link">Forgot password?</a></div>
      <div id="login-error" class="error"></div>
    </div>
  </div>

  <div id="banned-screen" class="screen" hidden>
    <div class="login-card">
      <button id="banned-close-btn" class="corner-close" title="Close">x</button>
      <h1>Access denied</h1>
      <p>You have been banned from this server.</p>
    </div>
  </div>

  <div id="app-screen" class="screen" hidden>
    <div id="titlebar">
      <span class="brand">DARK WEB</span>
      <div class="titlebar-actions">
        <button id="profile-btn">Profile</button>
        <button id="admin-btn" hidden>Admin</button>
        <button id="minimize-btn">_</button>
        <button id="close-btn">x</button>
      </div>
    </div>
    <div id="layout">
      <div id="channel-sidebar">
        <div class="section-label">Text Channels</div>
        <div id="text-channel-list"></div>
        <div class="section-label">Voice Channels</div>
        <div id="voice-channel-list"></div>
        <button id="add-channel-btn" hidden>+ New Channel</button>
        <div id="voice-controls" hidden>
          <span id="voice-status"></span>
          <button id="mute-btn">Mute</button>
          <button id="leave-voice-btn">Leave voice</button>
        </div>
      </div>
      <div id="main-pane">
        <div id="channel-header"></div>
        <div id="message-list"></div>
        <div id="composer" hidden>
          <input id="message-input" placeholder="Message..." autocomplete="off" />
          <button id="send-btn">Send</button>
        </div>
      </div>
      <div id="member-sidebar">
        <div class="section-label">In Voice</div>
        <div id="member-list"><div class="empty-hint small">Not in a voice channel</div></div>
      </div>
    </div>
  </div>

  <div id="admin-modal" class="modal" hidden>
    <div class="modal-card">
      <div class="modal-header"><span>Admin Panel</span><button id="admin-close-btn">x</button></div>
      <div class="modal-tabs">
        <button class="tab-btn active" data-tab="channels">Channels</button>
        <button class="tab-btn" data-tab="users">Users</button>
      </div>
      <div id="admin-tab-channels" class="admin-tab">
        <div id="admin-channel-list"></div>
        <form id="new-channel-form">
          <input id="new-channel-name" placeholder="channel-name" autocomplete="off" />
          <select id="new-channel-type">
            <option value="text">Text</option>
            <option value="voice">Voice</option>
          </select>
          <button type="submit">Add</button>
        </form>
      </div>
      <div id="admin-tab-users" class="admin-tab" hidden>
        <div id="admin-user-list"></div>
      </div>
    </div>
  </div>

  <div id="profile-modal" class="modal" hidden>
    <div class="modal-card">
      <div class="modal-header"><span>My Profile</span><button id="profile-close-btn">x</button></div>
      <div class="admin-tab">
        <div class="section-label">Avatar</div>
        <div class="avatar-grid" id="avatar-grid"></div>
        <div class="section-label">Display name</div>
        <input id="profile-name" maxlength="24" placeholder="Display name" autocomplete="off" />
        <div class="section-label">Status</div>
        <input id="profile-status" maxlength="60" placeholder="Status (optional)" autocomplete="off" />
        <button id="profile-save-btn">Save</button>
        <div id="profile-saved" class="saved-msg"></div>
        <hr class="divider" />
        <button id="logout-btn" class="danger-btn">Log Out</button>
      </div>
    </div>
  </div>
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

  let css = "";
  try {
    css = await fetch(new URL("./styles.css", import.meta.url)).then((r) => r.text());
  } catch (e) {
    console.error("Dark Web: failed to load styles.css", e);
  }
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  shadow.appendChild(styleEl);

  const container = document.createElement("div");
  container.innerHTML = TEMPLATE;
  shadow.appendChild(container);

  const $ = (sel) => shadow.querySelector(sel);

  let visible = true;
  window.__DARKWEB_TOGGLE__ = () => {
    visible = !visible;
    host.style.display = visible ? "block" : "none";
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let me = null;
  let currentTextChannel = null;
  let currentVoiceChannel = null;
  let currentVoice = null;
  let muted = false;
  let channelsCache = [];
  let channelsStarted = false;
  let unsubMessages = null;
  let unsubChannels = null;
  let unsubUsers = null;
  let unsubMe = null;

  async function closeApp() {
    if (currentVoice) await currentVoice.leave();
    if (unsubMessages) unsubMessages();
    if (unsubChannels) unsubChannels();
    if (unsubUsers) unsubUsers();
    if (unsubMe) unsubMe();
    host.remove();
    window.__DARKWEB_LOADED__ = false;
    delete window.__DARKWEB_TOGGLE__;
  }

  $("#close-btn").addEventListener("click", closeApp);
  $("#login-close-btn").addEventListener("click", closeApp);
  $("#banned-close-btn").addEventListener("click", closeApp);
  $("#minimize-btn").addEventListener("click", () => window.__DARKWEB_TOGGLE__());
  shadow.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeApp();
  });

  let authMode = "login";
  shadow.querySelectorAll(".auth-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      authMode = btn.dataset.mode;
      shadow.querySelectorAll(".auth-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      $("#signup-fields").hidden = authMode !== "signup";
      $("#forgot-password-row").hidden = authMode !== "login";
      $("#auth-submit-btn").textContent = authMode === "signup" ? "Create Account" : "Log In";
      $("#login-error").textContent = "";
    });
  });

  $("#auth-submit-btn").addEventListener("click", handleAuthSubmit);
  $("#auth-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAuthSubmit();
  });

  async function handleAuthSubmit() {
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    $("#login-error").textContent = "";
    if (!email || !password) {
      $("#login-error").textContent = "Enter an email and password.";
      return;
    }
    if (authMode === "signup") {
      const name = $("#signup-name").value.trim();
      if (!name) {
        $("#login-error").textContent = "Enter a display name.";
        return;
      }
      window.__darkwebPendingName = name;
    }
    $("#auth-submit-btn").disabled = true;
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      $("#login-error").textContent = friendlyAuthError(e);
    } finally {
      $("#auth-submit-btn").disabled = false;
    }
  }

  $("#forgot-password-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    if (!email) {
      $("#login-error").textContent = "Enter your email above first, then click this again.";
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      $("#login-error").textContent = "Password reset email sent to " + email + ".";
    } catch (e) {
      $("#login-error").textContent = friendlyAuthError(e);
    }
  });

  function friendlyAuthError(e) {
    const map = {
      "auth/email-already-in-use": "An account with that email already exists — try logging in instead.",
      "auth/invalid-email": "That doesn't look like a valid email address.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "No account found with that email.",
      "auth/too-many-requests": "Too many attempts — try again later.",
    };
    return map[e.code] || e.message;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (unsubMe) {
        unsubMe();
        unsubMe = null;
      }
      showScreen("login-screen");
      return;
    }
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const displayName = window.__darkwebPendingName || "Member" + user.uid.slice(0, 4);
      await setDoc(userRef, {
        displayName,
        role: "member",
        banned: false,
        avatarEmoji: "🙂",
        status: "",
        createdAt: serverTimestamp(),
      });
    }

    if (unsubMe) unsubMe();
    unsubMe = onSnapshot(userRef, (s) => {
      const data = s.data();
      if (!data) return;
      if (data.banned) {
        showScreen("banned-screen");
        auth.signOut();
        return;
      }
      me = {
        uid: user.uid,
        displayName: data.displayName,
        role: data.role,
        avatarEmoji: data.avatarEmoji || "🙂",
        status: data.status || "",
      };
      $("#admin-btn").hidden = me.role !== "admin";
      showScreen("app-screen");
      renderChannelList();
      renderAdminChannelList();
      if (!channelsStarted) {
        channelsStarted = true;
        subscribeChannels();
      }
    });
  });

  function showScreen(id) {
    ["login-screen", "banned-screen", "app-screen"].forEach((s) => {
      $("#" + s).hidden = s !== id;
    });
  }

  function subscribeChannels() {
    if (unsubChannels) unsubChannels();
    unsubChannels = onSnapshot(query(collection(db, "channels"), orderBy("createdAt")), (qs) => {
      channelsCache = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderChannelList();
      renderAdminChannelList();
      if (!currentTextChannel) {
        const firstText = channelsCache.find((c) => c.type === "text");
        if (firstText) selectTextChannel(firstText.id, firstText.name);
        else showMainPaneEmptyState();
      }
    });
  }

  function showMainPaneEmptyState() {
    $("#channel-header").textContent = "Welcome to Dark Web";
    $("#composer").hidden = true;
    const isAdmin = me && me.role === "admin";
    $("#message-list").innerHTML =
      '<div class="empty-hint">No channels yet.<br>' +
      (isAdmin
        ? 'Use <strong>+ New Channel</strong> in the sidebar to create the first one.'
        : "Ask a server admin to create one.") +
      "</div>";
  }

  function renderChannelList() {
    const textList = $("#text-channel-list");
    const voiceList = $("#voice-channel-list");
    if (!textList || !voiceList) return;
    textList.innerHTML = "";
    voiceList.innerHTML = "";
    const textChannels = channelsCache.filter((c) => c.type === "text");
    const voiceChannels = channelsCache.filter((c) => c.type === "voice");
    if (!textChannels.length) textList.innerHTML = '<div class="empty-hint small">No text channels</div>';
    if (!voiceChannels.length) voiceList.innerHTML = '<div class="empty-hint small">No voice channels</div>';
    channelsCache.forEach((c) => {
      const el = document.createElement("div");
      const isActiveText = c.type === "text" && currentTextChannel === c.id;
      const isActiveVoice = c.type === "voice" && currentVoiceChannel === c.id;
      el.className = "channel-item" + (isActiveText || isActiveVoice ? " active" : "");
      el.textContent = (c.type === "text" ? "# " : "🔊 ") + c.name;
      el.addEventListener("click", () => {
        if (c.type === "text") selectTextChannel(c.id, c.name);
        else joinVoiceChannel(c.id, c.name);
      });
      (c.type === "text" ? textList : voiceList).appendChild(el);
    });
    $("#add-channel-btn").hidden = !(me && me.role === "admin");
  }

  function selectTextChannel(id, name) {
    currentTextChannel = id;
    $("#channel-header").textContent = "# " + name;
    $("#composer").hidden = false;
    renderChannelList();
    if (unsubMessages) unsubMessages();
    const msgsRef = collection(db, "channels", id, "messages");
    unsubMessages = onSnapshot(query(msgsRef, orderBy("createdAt"), limit(100)), (qs) => {
      const list = $("#message-list");
      list.innerHTML = "";
      qs.forEach((d) => {
        const m = d.data();
        const row = document.createElement("div");
        row.className = "message";
        const time =
          m.createdAt && m.createdAt.toDate
            ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";
        const canDelete = me && (me.role === "admin" || me.uid === m.uid);
        const authorEl = document.createElement("span");
        authorEl.className = "author";
        authorEl.textContent = (m.avatarEmoji ? m.avatarEmoji + " " : "") + (m.displayName || "Unknown");
        const timeEl = document.createElement("span");
        timeEl.className = "time";
        timeEl.textContent = time;
        row.appendChild(authorEl);
        row.appendChild(timeEl);
        if (canDelete) {
          const delEl = document.createElement("span");
          delEl.className = "del-btn";
          delEl.textContent = "delete";
          delEl.addEventListener("click", () => deleteDoc(doc(db, "channels", id, "messages", d.id)));
          row.appendChild(delEl);
        }
        const textEl = document.createElement("div");
        textEl.className = "text";
        textEl.textContent = m.text || "";
        row.appendChild(textEl);
        list.appendChild(row);
      });
      list.scrollTop = list.scrollHeight;
    });
  }

  $("#send-btn").addEventListener("click", sendMessage);
  $("#message-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  async function sendMessage() {
    const input = $("#message-input");
    const text = input.value.trim();
    if (!text || !currentTextChannel || !me) return;
    input.value = "";
    await addDoc(collection(db, "channels", currentTextChannel, "messages"), {
      text,
      uid: me.uid,
      displayName: me.displayName,
      avatarEmoji: me.avatarEmoji,
      createdAt: serverTimestamp(),
    });
  }

  async function joinVoiceChannel(id, name) {
    if (!me) return;
    if (currentVoice) await currentVoice.leave();
    currentVoice = new VoiceManager(db, me.uid, { displayName: me.displayName, avatarEmoji: me.avatarEmoji }, {
      onParticipantsChange: renderVoiceMembers,
      onRemoteStream: attachRemoteAudio,
      onError: (msg) => alert(msg),
    });
    const ok = await currentVoice.join(id);
    if (!ok) {
      currentVoice = null;
      return;
    }
    currentVoiceChannel = id;
    muted = false;
    $("#mute-btn").textContent = "Mute";
    $("#voice-controls").hidden = false;
    $("#voice-status").textContent = "In: " + name;
    renderChannelList();
  }

  $("#mute-btn").addEventListener("click", () => {
    if (!currentVoice) return;
    muted = !muted;
    currentVoice.setMuted(muted);
    $("#mute-btn").textContent = muted ? "Unmute" : "Mute";
  });

  $("#leave-voice-btn").addEventListener("click", async () => {
    if (currentVoice) await currentVoice.leave();
    currentVoice = null;
    currentVoiceChannel = null;
    $("#voice-controls").hidden = true;
    $("#member-list").innerHTML = '<div class="empty-hint small">Not in a voice channel</div>';
    renderChannelList();
  });

  const remoteAudioEls = new Map();
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

  function renderVoiceMembers(participants) {
    const list = $("#member-list");
    list.innerHTML = "";
    participants.forEach((p) => {
      const el = document.createElement("div");
      el.className = "member-item";
      el.textContent = (p.avatarEmoji ? p.avatarEmoji + " " : "🔊 ") + p.displayName;
      list.appendChild(el);
    });
  }

  // ---- Admin panel ----
  $("#admin-btn").addEventListener("click", () => {
    $("#admin-modal").hidden = false;
    subscribeUsers();
  });
  $("#admin-close-btn").addEventListener("click", () => {
    $("#admin-modal").hidden = true;
  });
  $("#add-channel-btn").addEventListener("click", () => {
    $("#admin-modal").hidden = false;
  });
  shadow.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      shadow.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $("#admin-tab-channels").hidden = tab !== "channels";
      $("#admin-tab-users").hidden = tab !== "users";
    });
  });

  function renderAdminChannelList() {
    const list = $("#admin-channel-list");
    if (!list) return;
    list.innerHTML = "";
    channelsCache.forEach((c) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.textContent = (c.type === "text" ? "# " : "🔊 ") + c.name;
      const actions = document.createElement("span");
      const renameBtn = document.createElement("button");
      renameBtn.textContent = "Rename";
      renameBtn.addEventListener("click", async () => {
        const name = prompt("New name", c.name);
        if (name) await updateDoc(doc(db, "channels", c.id), { name });
      });
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", async () => {
        if (confirm('Delete channel "' + c.name + '"?')) await deleteDoc(doc(db, "channels", c.id));
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
    const name = $("#new-channel-name").value.trim();
    const type = $("#new-channel-type").value;
    if (!name) return;
    await addDoc(collection(db, "channels"), { name, type, createdAt: serverTimestamp() });
    $("#new-channel-name").value = "";
  });

  function subscribeUsers() {
    if (unsubUsers) return;
    unsubUsers = onSnapshot(collection(db, "users"), (qs) => {
      const list = $("#admin-user-list");
      list.innerHTML = "";
      qs.forEach((d) => {
        const u = d.data();
        const row = document.createElement("div");
        row.className = "admin-row";
        const label = document.createElement("span");
        label.textContent =
          (u.avatarEmoji ? u.avatarEmoji + " " : "") +
          u.displayName +
          (u.role === "admin" ? " (admin)" : "") +
          (u.banned ? " [banned]" : "");
        const actions = document.createElement("span");
        const roleBtn = document.createElement("button");
        roleBtn.textContent = u.role === "admin" ? "Demote" : "Promote";
        roleBtn.addEventListener("click", () =>
          updateDoc(doc(db, "users", d.id), { role: u.role === "admin" ? "member" : "admin" })
        );
        const banBtn = document.createElement("button");
        banBtn.textContent = u.banned ? "Unban" : "Ban";
        banBtn.addEventListener("click", () => updateDoc(doc(db, "users", d.id), { banned: !u.banned }));
        actions.appendChild(roleBtn);
        actions.appendChild(banBtn);
        row.appendChild(label);
        row.appendChild(actions);
        list.appendChild(row);
      });
    });
  }

  // ---- Profile panel ----
  const AVATAR_CHOICES = [
    "🙂", "😎", "🐱", "🐺", "👾", "🎮",
    "🔥", "💀", "👻", "🤖", "🧠", "⚡",
  ];
  let selectedAvatar = AVATAR_CHOICES[0];

  const avatarGrid = $("#avatar-grid");
  AVATAR_CHOICES.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-choice";
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      selectedAvatar = emoji;
      avatarGrid.querySelectorAll(".avatar-choice").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    avatarGrid.appendChild(btn);
  });

  $("#profile-btn").addEventListener("click", () => {
    if (!me) return;
    $("#profile-name").value = me.displayName;
    $("#profile-status").value = me.status;
    selectedAvatar = me.avatarEmoji;
    avatarGrid.querySelectorAll(".avatar-choice").forEach((b) => {
      b.classList.toggle("selected", b.textContent === selectedAvatar);
    });
    $("#profile-saved").textContent = "";
    $("#profile-modal").hidden = false;
  });
  $("#profile-close-btn").addEventListener("click", () => {
    $("#profile-modal").hidden = true;
  });

  $("#profile-save-btn").addEventListener("click", async () => {
    if (!me) return;
    const displayName = $("#profile-name").value.trim();
    const status = $("#profile-status").value.trim();
    if (!displayName) {
      $("#profile-saved").textContent = "Display name can't be empty.";
      return;
    }
    await updateDoc(doc(db, "users", me.uid), {
      displayName,
      status,
      avatarEmoji: selectedAvatar,
    });
    $("#profile-saved").textContent = "Saved.";
  });

  $("#logout-btn").addEventListener("click", async () => {
    if (currentVoice) await currentVoice.leave();
    currentVoice = null;
    currentVoiceChannel = null;
    if (unsubMessages) unsubMessages();
    if (unsubChannels) unsubChannels();
    if (unsubUsers) unsubUsers();
    unsubMessages = unsubChannels = unsubUsers = null;
    channelsStarted = false;
    currentTextChannel = null;
    me = null;
    $("#profile-modal").hidden = true;
    await auth.signOut();
  });
})();
