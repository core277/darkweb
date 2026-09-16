import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail,
  onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, deleteField, addDoc,
  onSnapshot, query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove, writeBatch, increment,
  runTransaction,
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
const HOME_ID = "HOME";

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
  emoji: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm3.5-9a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>',
  forum: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6h-2v9H6v2a1 1 0 001 1h11l4 4V7a1 1 0 00-1-1zm-4 6V3a1 1 0 00-1-1H3a1 1 0 00-1 1v14l4-4h10a1 1 0 001-1z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  callEnd: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 010-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85a.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>',
  cameraOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7a1 1 0 00-1-1H9.83l8.17 8.17V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 00-1 1v10a1 1 0 001 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3a2 2 0 00-2 2v12a2 2 0 002 2h5v2h8v-2h5a2 2 0 002-2V5a2 2 0 00-2-2zm0 14H3V5h18v12zm-9-9l-4 4h3v4h2v-4h3l-4-4z"/></svg>',
  stage: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v14h18V5H3zm8 12H5v-5h6v5zm0-7H5V7h6v3zm8 7h-6v-5h6v5zm0-7h-6V7h6v3z"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2V8a2 2 0 00-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-3a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>',
  poll: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 9h4v11H5V9zm10-6h4v17h-4V3zm-5 12h4v5h-4v-5z"/></svg>',
};

// Accounts created without an email get an internal one derived from the username so Firebase
// Auth can still identify them. Nobody ever sees or mails it.
const NOEMAIL_DOMAIN = "users.darkweb.local";
const usernameToEmail = (name) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug.length >= 3 ? slug + "@" + NOEMAIL_DOMAIN : null;
};
const isSyntheticEmail = (email) => !!email && email.endsWith("@" + NOEMAIL_DOMAIN);

const PERMS = [
  ["manageChannels", "Manage channels"],
  ["manageMessages", "Delete anyone's messages"],
  ["mentionEveryone", "Mention @everyone"],
];

const EMOJI_GROUPS = [
  ["Smileys", "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾"],
  ["Gestures & hearts", "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 💪 🫶 👀 👁️ 🧠 🦷 🦴 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 💣 💬 💤"],
  ["Animals & nature", "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦛 🦏 🐪 🦒 🦘 🐄 🐎 🐖 🐑 🐐 🦌 🐕 🐈 🐓 🕊️ 🐇 🦝 🦨 🦦 🦥 🐀 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍄 💐 🌷 🌹 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌚 🌕 🌙 ⭐ 🌟 ✨ ⚡ ☄️ 🔥 🌈 ☀️ ⛅ ☁️ 🌧️ ⛈️ ❄️ ☃️ ⛄ 🌊"],
  ["Food & drink", "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥙 🧆 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🥠 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉"],
  ["Activities", "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🥍 🏏 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤸 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎫 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🧩"],
  ["Travel & places", "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🏍️ 🛵 🚲 🛴 🚨 🚔 🚡 🚠 🚃 🚄 🚅 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋"],
  ["Objects", "⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ ⏰ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 💸 💵 💰 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 ⛓️ 🧲 🔫 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🏺 🔮 📿 🧿 💈 🔭 🔬 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🚿 🛁 🧼 🪥 🧽 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🧸 🖼️ 🛍️ 🛒 🎁 🎈 🎏 🎀 🎊 🎉 🪄 🎎 🏮 🎐 ✉️ 📦 📫 📮 📜 📃 📑 📊 📈 📉 📆 📅 🗓️ 📇 🗃️ 📋 📁 📂 🗂️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓"],
  ["Symbols & flags", "✅ ❌ ❓ ❗ ‼️ ⁉️ 💯 🔞 📵 🚫 ⛔ 🚭 ♻️ ✳️ ❇️ 🆗 🆒 🆕 🆓 🆙 🆖 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ⚠️ 🔰 ⚜️ 🔱 📛 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ 🔀 🔁 🔂 🔼 🔽 ⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ 🔃 🔄 🔙 🔚 🔛 🔜 🔝 ➕ ➖ ➗ ✖️ ♾️ 💲 💱 ™️ ©️ ®️ 🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏴‍☠️ 🇮🇪 🇬🇧 🇺🇸 🇨🇦 🇦🇺 🇩🇪 🇫🇷 🇪🇸 🇮🇹 🇵🇱 🇯🇵 🇰🇷 🇧🇷 🇲🇽 🇮🇳"],
];
const RECENT_EMOJI_KEY = "darkweb:recentEmoji";
const EMOJI_ONLY_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier}|‍|️|\s)+$/u;

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
        <label class="field-label">Username</label>
        <input id="signup-name" maxlength="24" autocomplete="nickname" />
      </div>
      <label class="field-label" id="auth-email-label">Email</label>
      <input id="auth-email" type="text" autocomplete="username" />
      <div id="auth-email-hint" class="hint" hidden>Optional, but recommended: it's the only way to reset a forgotten password.</div>
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
      <p class="auth-sub" id="banned-text">You have been banned from Dark Web.</p>
    </div>
  </div>

  <div id="app-screen" hidden>
    <nav id="server-rail">
      <div class="rail-home" title="Dark Web">${ICONS.logo}<span id="home-badge" class="rail-badge" hidden></span></div>
      <button id="dm-rail-btn" class="rail-icon rail-dm" title="Direct Messages">${ICONS.chat}<span id="dm-badge" class="rail-badge" hidden></span></button>
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
      <div id="dm-sidebar">
        <div class="dm-sidebar-head"><span>Direct Messages</span><button id="new-dm-btn" class="icon-btn" title="New message">${ICONS.plus}</button></div>
        <div id="dm-list"></div>
      </div>
      <div id="channel-scroll">
        <div id="channel-groups"></div>
      </div>
      <div id="voice-panel" hidden>
        <div class="voice-panel-row">
          <div class="voice-panel-info">
            <div class="voice-connected">Voice Connected</div>
            <div id="voice-panel-channel" class="voice-panel-channel"></div>
          </div>
          <button id="leave-voice-btn" class="hangup-btn" title="Disconnect">${ICONS.callEnd}</button>
        </div>
        <div class="voice-actions">
          <button id="camera-btn" class="voice-action" title="Turn on camera">${ICONS.camera}<span>Camera</span></button>
          <button id="screen-btn" class="voice-action" title="Share your screen">${ICONS.screen}<span>Share</span></button>
          <button id="stage-toggle-btn" class="voice-action" title="Show or hide the call view">${ICONS.stage}<span>View</span></button>
        </div>
        <div id="voice-peers"></div>
        <button id="audio-unlock-btn" class="btn btn-primary btn-sm btn-block" hidden>Tap to enable audio</button>
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
        <button id="post-back-btn" class="icon-btn" title="Back to posts" hidden>${ICONS.back}</button>
        <span class="hash-icon" id="channel-header-icon">${ICONS.hash}</span>
        <span id="channel-header-name">Welcome</span>
        <div class="header-actions">
          <button id="new-post-btn" class="btn btn-primary btn-sm" hidden>New post</button>
          <button id="dm-call-btn" class="icon-btn" title="Voice call" hidden>${ICONS.phone}</button>
          <button id="toggle-members-btn" class="icon-btn" title="Toggle member list">${ICONS.members}</button>
          <button id="minimize-btn" class="icon-btn" title="Minimize">${ICONS.minimize}</button>
          <button id="close-btn" class="icon-btn" title="Close">${ICONS.close}</button>
        </div>
      </header>
      <div id="incoming-call-banner" hidden>
        <span id="incoming-call-text"></span>
        <div class="incoming-call-actions">
          <button id="incoming-call-accept" class="btn btn-primary btn-sm">Answer</button>
          <button id="incoming-call-decline" class="btn btn-danger btn-sm">Decline</button>
        </div>
      </div>
      <div id="call-stage" hidden></div>
      <div id="message-list"></div>
      <div id="composer" hidden>
        <div id="mention-popup" hidden>
          <div class="mention-title">Members</div>
          <div id="mention-list"></div>
        </div>
        <div id="picker" hidden>
          <div class="picker-head">
            <button class="picker-tab active" data-picker="emoji">Emoji</button>
            <button class="picker-tab" data-picker="gif">GIFs</button>
            <input id="picker-search" placeholder="Search Tenor" autocomplete="off" hidden />
          </div>
          <div id="picker-emoji" class="picker-body"></div>
          <div id="picker-gif" class="picker-body" hidden></div>
        </div>
        <div id="image-preview" hidden>
          <img id="image-preview-img" alt="" />
          <button id="image-preview-remove" class="icon-btn" title="Remove">${ICONS.close}</button>
        </div>
        <div class="composer-bar">
          <button id="attach-btn" class="icon-btn attach" title="Upload image">${ICONS.plus}</button>
          <input type="file" id="image-input" accept="image/*" hidden />
          <textarea id="message-input" rows="1" placeholder="Message" autocomplete="off"></textarea>
          <button id="poll-btn" class="icon-btn" title="Create a poll">${ICONS.poll}</button>
          <button id="gif-btn" class="icon-btn gif-chip" title="GIFs">GIF</button>
          <button id="emoji-btn" class="icon-btn" title="Emoji">${ICONS.emoji}</button>
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
          <label class="field-label">About me</label>
          <textarea id="profile-bio" rows="3" maxlength="190" placeholder="Tell people a bit about yourself"></textarea>
          <label class="field-label">Games I play</label>
          <input id="profile-games" maxlength="120" autocomplete="off" placeholder="Minecraft, Fortnite, Rocket League" />
          <div class="hint">Separate games with commas. They show as tags on your profile.</div>
          <div class="row-end"><button id="profile-save-btn" class="btn btn-primary">Save changes</button></div>
          <div id="profile-msg" class="form-msg"></div>
        </section>
        <section id="settings-tab-account" class="settings-section" hidden>
          <h2>Account</h2>
          <label class="field-label">Email</label>
          <input id="account-email" readonly />
          <div id="account-email-hint" class="hint"></div>
          <h3 id="email-change-title">Add an email</h3>
          <div class="hint">Lets you reset your password if you forget it. You'll get a confirmation link.</div>
          <label class="field-label">New email</label>
          <input id="email-new" type="email" autocomplete="email" />
          <label class="field-label">Current password</label>
          <input id="email-pw" type="password" autocomplete="current-password" />
          <div class="row-end"><button id="email-save-btn" class="btn btn-primary">Send confirmation</button></div>
          <div id="email-msg" class="form-msg"></div>
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

  <div id="profile-card-modal" class="modal" hidden>
    <div class="modal-card profile-card">
      <div class="profile-banner"></div>
      <button class="icon-btn corner-close" id="profile-card-close" title="Close">${ICONS.close}</button>
      <div class="profile-card-body">
        <div id="profile-card-avatar"></div>
        <div id="profile-card-name" class="profile-card-name"></div>
        <div id="profile-card-status" class="profile-card-status"></div>
        <div id="profile-card-roles" class="role-chips"></div>
        <div id="profile-card-bio-wrap">
          <div class="profile-card-label">About me</div>
          <div id="profile-card-bio" class="profile-card-bio"></div>
        </div>
        <div id="profile-card-games-wrap">
          <div class="profile-card-label">Games</div>
          <div id="profile-card-games" class="game-tags"></div>
        </div>
        <div class="row-end profile-card-actions">
          <button id="profile-card-dm" class="btn btn-primary">Message</button>
          <button id="profile-card-edit" class="btn btn-secondary" hidden>Edit profile</button>
        </div>
      </div>
    </div>
  </div>

  <div id="poll-modal" class="modal" hidden>
    <div class="modal-card small-card">
      <div class="modal-header"><span>Create a poll</span><button id="poll-close" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="admin-tab">
        <label class="field-label">Question</label>
        <input id="poll-question" maxlength="150" placeholder="What should we do this weekend?" autocomplete="off" />
        <label class="field-label">Options</label>
        <div id="poll-options"></div>
        <button id="poll-add-option" class="btn btn-secondary btn-sm" type="button">+ Add option</button>
        <label class="hint" style="display:flex;align-items:center;gap:8px;margin-top:14px;">
          <input id="poll-multi" type="checkbox" style="width:auto;" /> Allow picking more than one option
        </label>
        <div class="row-end"><button id="poll-create-btn" class="btn btn-primary">Create Poll</button></div>
        <div id="poll-msg" class="form-msg"></div>
      </div>
    </div>
  </div>

  <div id="new-post-modal" class="modal" hidden>
    <div class="modal-card small-card">
      <div class="modal-header"><span>New post</span><button id="new-post-close" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="admin-tab">
        <label class="field-label">Title</label>
        <input id="new-post-title" maxlength="80" autocomplete="off" />
        <label class="field-label">Message</label>
        <input id="new-post-body" maxlength="500" autocomplete="off" />
        <div class="row-end"><button id="new-post-create" class="btn btn-primary">Post</button></div>
        <div id="new-post-msg" class="form-msg"></div>
      </div>
    </div>
  </div>

  <div id="new-dm-modal" class="modal" hidden>
    <div class="modal-card small-card">
      <div class="modal-header"><span>New message</span><button id="new-dm-close" class="icon-btn" title="Close">${ICONS.close}</button></div>
      <div class="admin-tab">
        <input id="new-dm-search" placeholder="Search people" autocomplete="off" />
        <div id="new-dm-list" class="dm-user-list"></div>
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
        <button class="tab-btn" data-stab="roles">Roles</button>
        <button class="tab-btn" data-stab="members">Members</button>
      </div>
      <div id="stab-overview" class="admin-tab">
        <label class="field-label">Server icon</label>
        <div class="pfp-row">
          <div id="server-icon-preview"></div>
          <div class="pfp-actions">
            <button id="server-icon-upload-btn" class="btn btn-primary">Upload icon</button>
            <button id="server-icon-remove-btn" class="btn btn-secondary">Remove icon</button>
            <input type="file" id="server-icon-input" accept="image/*" hidden />
            <div class="hint">Shown in the rail. Cropped to a square.</div>
          </div>
        </div>
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
        <div id="category-manager">
          <h3 class="first">Categories</h3>
          <form id="new-category-form" class="role-form">
            <input id="new-category-name" placeholder="New category name" maxlength="32" autocomplete="off" />
            <button type="submit" class="btn btn-primary">Add category</button>
          </form>
          <div id="category-list"></div>
        </div>
        <h3>Channels</h3>
        <form id="new-channel-form">
          <input id="new-channel-name" placeholder="new-channel" autocomplete="off" maxlength="32" />
          <select id="new-channel-type">
            <option value="text">Text</option>
            <option value="voice">Voice</option>
            <option value="forum">Forum</option>
          </select>
          <select id="new-channel-cat"></select>
          <button type="submit" class="btn btn-primary">Create</button>
        </form>
        <div id="admin-channel-list"></div>
      </div>
      <div id="stab-roles" class="admin-tab" hidden>
        <form id="new-role-form" class="role-form">
          <input id="new-role-name" placeholder="New role name" maxlength="24" autocomplete="off" />
          <input id="new-role-color" type="color" value="#5865f2" title="Role colour" />
          <button type="submit" class="btn btn-primary">Add role</button>
        </form>
        <div class="hint">Roles higher in the list take priority for name colours and member grouping.</div>
        <div id="role-list"></div>
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
  const [configModule, { VoiceManager }] = await Promise.all([
    import(new URL("./firebase-config.js" + bust, import.meta.url).href),
    import(new URL("./lib/webrtc.js" + bust, import.meta.url).href),
  ]);
  const firebaseConfig = configModule.firebaseConfig;
  const tenorApiKey = (configModule.tenorApiKey || "").trim();
  const giphyApiKey = (configModule.giphyApiKey || "").trim();
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
  let viewMode = "server";
  let dms = [];
  let currentDm = null;
  let currentPost = null;
  let postsCache = [];
  let unsubPosts = null;
  let unsubDms = null;
  let unsubDmMessages = null;
  let homeServer = null;
  let creatingHome = false;
  let currentServer = null;
  let pendingSelectServer = null;
  let channelsCache = [];
  let currentTextChannel = null;
  let currentVoiceChannel = null;
  let currentVoiceServer = null;
  let currentVoiceDm = null;
  let currentVoice = null;
  let dmCallParticipants = []; // participants in whichever DM call the client is watching
  let dmCallListenerId = null; // which dm's call/current/participants the listener above covers
  let unsubDmCallParticipants = null;
  let declinedDmCall = null; // dmId of an incoming call the user dismissed, so it doesn't re-pop
  let muted = false;
  let pendingImage = null;
  let lastMessages = [];
  let messagesFirstRender = true;
  let selectedAvatarEmoji = DEFAULT_EMOJI;
  let pendingPfp = undefined;
  const voiceParticipants = new Map();
  const voiceListeners = new Map();
  const remoteAudioEls = new Map();
  let pingsByServer = new Map(); // serverId -> ping docs (unread @mentions in that server)
  let unsubServers = null;
  let unsubHome = null;
  let unsubPings = null;
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
  const hasPerm = (s, p) => !!(me && s && (canManage(s) || ((s.memberPerms || {})[me.uid] || []).includes(p)));
  const serverRoles = (s) => (s && Array.isArray(s.roles) ? s.roles : []);
  const memberRoleIds = (s, uid) => ((s && s.memberRoles) || {})[uid] || [];
  const topRole = (s, uid) => {
    const ids = memberRoleIds(s, uid);
    return serverRoles(s).find((r) => ids.includes(r.id)) || null;
  };
  // Permissions are denormalised per member so Firestore rules can check them without loops.
  function computeMemberPerms(roles, memberRoles) {
    const out = {};
    Object.entries(memberRoles || {}).forEach(([uid, ids]) => {
      const set = new Set();
      (ids || []).forEach((id) => {
        const r = roles.find((x) => x.id === id);
        if (r) (r.perms || []).forEach((p) => set.add(p));
      });
      if (set.size) out[uid] = Array.from(set);
    });
    return out;
  }
  async function saveRoles(roles, memberRoles) {
    await updateDoc(doc(db, "servers", currentServer.id), {
      roles,
      memberRoles,
      memberPerms: computeMemberPerms(roles, memberRoles),
    });
  }
  const isMemberOf = (s) => !!(me && s && (s.isHome || (s.memberIds || []).includes(me.uid)));
  const allServers = () => (homeServer ? [homeServer] : []).concat(servers.filter((s) => s.id !== HOME_ID));
  const allUsers = () => Array.from(usersCache.entries()).map(([uid, u]) => ({ uid, ...u }));

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
    if (unsubPosts) unsubPosts();
    unsubMessages = unsubChannels = unsubPosts = null;
    currentPost = null;
    postsCache = [];
    voiceListeners.forEach((fn) => fn());
    voiceListeners.clear();
    voiceParticipants.clear();
  }

  function stopSessionListeners() {
    teardownServerListeners();
    if (unsubServers) unsubServers();
    if (unsubHome) unsubHome();
    if (unsubUsers) unsubUsers();
    if (unsubMe) unsubMe();
    if (unsubDms) unsubDms();
    if (unsubDmMessages) unsubDmMessages();
    if (unsubPings) unsubPings();
    unsubscribeDmCallParticipants();
    declinedDmCall = null;
    unsubServers = unsubHome = unsubUsers = unsubMe = unsubDms = unsubDmMessages = unsubPings = null;
    pingsByServer = new Map();
    homeServer = null;
    homeJoinAttempted = false;
    dms = [];
    currentDm = null;
    viewMode = "server";
    $("#app-screen").classList.remove("dm-mode");
    $("#channel-header-icon").innerHTML = ICONS.hash;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (membersRefreshTimer) clearInterval(membersRefreshTimer);
    heartbeatTimer = membersRefreshTimer = null;
  }

  async function leaveVoice() {
    if (currentVoice) await currentVoice.leave();
    currentVoice = null;
    const wasDm = currentVoiceDm;
    currentVoiceChannel = null;
    currentVoiceServer = null;
    currentVoiceDm = null;
    remoteAudioEls.forEach((el) => el.remove());
    remoteAudioEls.clear();
    peerStates.clear();
    speakingNow.clear();
    stageStreams.clear();
    cameraOn = screenOn = false;
    $("#voice-panel").hidden = true;
    $("#audio-unlock-btn").hidden = true;
    $("#user-panel-avatar").classList.remove("speaking");
    if (wasDm) {
      if (inDm() && currentDm) ensureDmCallListener(currentDm.id);
      else unsubscribeDmCallParticipants();
    }
    renderStage();
    renderChannels();
    renderDmCallUi();
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
    $("#auth-email-label").textContent = signup ? "Email (optional)" : "Username or email";
    $("#auth-email-hint").hidden = !signup;
    $("#auth-email").placeholder = signup ? "you@example.com" : "";
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
    const identifier = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    setMsg("#login-error", "");
    let email = identifier;
    if (authMode === "signup") {
      const name = $("#signup-name").value.trim();
      if (!name) {
        setMsg("#login-error", "Pick a username.", "error");
        return;
      }
      if (!email) {
        email = usernameToEmail(name);
        if (!email) {
          setMsg("#login-error", "Username needs at least 3 letters or numbers.", "error");
          return;
        }
      } else if (!email.includes("@")) {
        setMsg("#login-error", "That email doesn't look right (or leave it blank).", "error");
        return;
      }
      window.__darkwebPendingName = name;
    } else {
      if (!identifier) {
        setMsg("#login-error", "Enter your username or email.", "error");
        return;
      }
      if (!identifier.includes("@")) {
        email = usernameToEmail(identifier);
        if (!email) {
          setMsg("#login-error", "Enter your username or email.", "error");
          return;
        }
      }
    }
    if (!password) {
      setMsg("#login-error", "Enter a password.", "error");
      return;
    }
    $("#auth-submit-btn").disabled = true;
    try {
      if (authMode === "signup") await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      if (e.code === "auth/email-already-in-use" && isSyntheticEmail(email)) {
        setMsg("#login-error", "That username is taken. Pick another one, or add an email to make it unique.", "error");
      } else if ((e.code === "auth/invalid-credential" || e.code === "auth/user-not-found") && isSyntheticEmail(email)) {
        setMsg("#login-error", "No account with that username, or wrong password. If you signed up with an email, log in with it.", "error");
      } else {
        setMsg("#login-error", friendlyAuthError(e), "error");
      }
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
    if (!email.includes("@")) {
      setMsg("#login-error", "Password reset needs an email. Accounts created with just a username can't be reset.", "error");
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
      ["#auth-email", "#auth-password", "#signup-name"].forEach((sel) => ($(sel).value = ""));
      setAuthMode("login");
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
        $("#banned-text").textContent = data.deleted
          ? "This account was deleted by an admin."
          : "You have been banned from Dark Web.";
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
        bio: data.bio || "",
        games: Array.isArray(data.games) ? data.games : [],
      };
      $("#admin-btn").hidden = !isGlobalAdmin();
      renderUserPanel();
      if (firstLoad) {
        showScreen("app-screen");
        syncLayoutForWidth();
        startHeartbeat(userRef);
        subscribeUsers();
        subscribeHome();
        subscribeDms();
        subscribePings();
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
      renderDmList();
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
    const source = currentServer.isHome
      ? allUsers()
      : (currentServer.memberIds || []).map((uid) => ({ uid, ...(usersCache.get(uid) || {}) }));
    const members = source.filter((u) => u.displayName && !u.banned);
    const rank = (u) => (u.uid === currentServer.ownerUid ? 0 : u.role === "admin" ? 1 : 2);
    const sortFn = (a, b) => rank(a) - rank(b) || (a.displayName || "").localeCompare(b.displayName || "");
    const online = members.filter(isOnline);
    const offline = members.filter((u) => !isOnline(u)).sort(sortFn);
    const roles = serverRoles(currentServer);
    const byRole = new Map();
    const noRole = [];
    online.forEach((u) => {
      const r = topRole(currentServer, u.uid);
      if (r) {
        if (!byRole.has(r.id)) byRole.set(r.id, []);
        byRole.get(r.id).push(u);
      } else noRole.push(u);
    });

    const section = (title, arr, dim) => {
      if (!arr.length) return;
      const h = document.createElement("div");
      h.className = "member-section";
      h.textContent = title + " — " + arr.length;
      list.appendChild(h);
      arr.forEach((u) => {
        const row = document.createElement("div");
        row.className = "member-row" + (dim ? " offline" : "") + (u.uid !== me.uid ? " clickable" : "");
        if (u.uid !== me.uid) {
          row.title = "Message " + u.displayName;
          row.addEventListener("click", () => openProfile(u.uid));
        } else {
          row.classList.add("clickable");
          row.addEventListener("click", () => openProfile(u.uid));
        }
        row.appendChild(makeAvatar(u, u.uid, "avatar-32", true));
        const text = document.createElement("div");
        text.className = "member-text";
        const name = document.createElement("div");
        name.className = "member-name";
        name.textContent = u.displayName;
        const role = topRole(currentServer, u.uid);
        if (role && role.color) name.style.color = role.color;
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
    roles.forEach((r) => {
      if (byRole.has(r.id)) section(r.name, byRole.get(r.id).sort(sortFn), false);
    });
    section("Online", noRole.sort(sortFn), false);
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
        resolveSelection();
      },
      (err) => {
        console.error("Dark Web: servers listener", err);
        showLoadError(err);
      }
    );
  }

  // The home server (document id "HOME") is one everybody is in automatically and can't leave.
  function subscribeHome() {
    if (unsubHome) unsubHome();
    unsubHome = onSnapshot(
      doc(db, "servers", HOME_ID),
      (snap) => {
        if (snap.exists()) {
          homeServer = { id: HOME_ID, ...snap.data(), isHome: true };
          ensureHomeMembership();
        } else {
          homeServer = null;
          // Only trust a confirmed-from-server "missing"; a cached miss must never trigger creation.
          if (isGlobalAdmin() && !snap.metadata.fromCache) createHome();
        }
        renderRail();
        renderAdminServerList();
        resolveSelection();
      },
      (err) => console.error("Dark Web: home listener", err)
    );
  }

  // The server doc must be committed before the channels: the channel rules look the server up.
  // Fixed channel ids keep this idempotent if two admins race to create HOME.
  async function createServerWithDefaults(id, name, extra) {
    await setDoc(doc(db, "servers", id), {
      name,
      ownerUid: me.uid,
      memberIds: [me.uid],
      categories: [
        { id: "text", name: "Text Channels" },
        { id: "voice", name: "Voice Channels" },
      ],
      createdAt: serverTimestamp(),
      ...(extra || {}),
    });
    await Promise.all([
      setDoc(doc(db, "servers", id, "channels", "general"), { name: "general", type: "text", categoryId: "text", createdAt: serverTimestamp() }),
      setDoc(doc(db, "servers", id, "channels", "voice"), { name: "voice", type: "voice", categoryId: "voice", createdAt: serverTimestamp() }),
    ]);
  }

  // Membership in HOME is implicit in the rules, but we also record it so older rule sets
  // (which only check memberIds) still let everyone in. Failure here is harmless.
  let homeJoinAttempted = false;
  function ensureHomeMembership() {
    if (homeJoinAttempted || !me || !homeServer) return;
    if ((homeServer.memberIds || []).includes(me.uid)) return;
    homeJoinAttempted = true;
    updateDoc(doc(db, "servers", HOME_ID), { memberIds: arrayUnion(me.uid) }).catch(() => {});
  }

  // Creates HOME atomically and only if it truly doesn't exist, so it can never overwrite a live
  // home server (which would wipe roles, icon, categories and members).
  async function createHome() {
    if (creatingHome || homeServer) return;
    creatingHome = true;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "servers", HOME_ID);
        const snap = await tx.get(ref);
        if (snap.exists()) return;
        tx.set(ref, {
          name: "Dark Web",
          ownerUid: me.uid,
          memberIds: [me.uid],
          isHome: true,
          categories: [
            { id: "text", name: "Text Channels" },
            { id: "voice", name: "Voice Channels" },
          ],
          createdAt: serverTimestamp(),
        });
        tx.set(doc(db, "servers", HOME_ID, "channels", "general"), { name: "general", type: "text", categoryId: "text", createdAt: serverTimestamp() });
        tx.set(doc(db, "servers", HOME_ID, "channels", "voice"), { name: "voice", type: "voice", categoryId: "voice", createdAt: serverTimestamp() });
      });
    } catch (e) {
      console.error("Dark Web: couldn't create home server", e);
    } finally {
      creatingHome = false;
    }
  }

  function resolveSelection() {
    const list = allServers();
    let target = null;
    if (pendingSelectServer) {
      target = list.find((s) => s.id === pendingSelectServer);
      if (target) pendingSelectServer = null;
    }
    if (!target && currentServer) target = list.find((s) => s.id === currentServer.id);
    if (!target) {
      const last = safeGet("darkweb:lastServer");
      target = list.find((s) => s.id === last) || list[0] || null;
    }
    if (target) selectServer(target);
    else showNoServer();
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

  $(".rail-home").addEventListener("click", () => {
    if (homeServer) selectServer(homeServer, true);
  });

  function pingBadge(count) {
    const b = document.createElement("span");
    b.className = "rail-badge";
    b.textContent = count > 9 ? "9+" : String(count);
    return b;
  }

  function renderRail() {
    const home = $(".rail-home");
    home.classList.toggle("active", !inDm() && !!(currentServer && currentServer.isHome));
    $("#dm-rail-btn").classList.toggle("active", inDm());
    home.classList.toggle("disabled", !homeServer);
    home.title = homeServer ? homeServer.name + " (everyone)" : "Home server not set up yet";
    const homeCount = homeServer ? (pingsByServer.get(homeServer.id) || []).length : 0;
    $("#home-badge").hidden = homeCount === 0;
    $("#home-badge").textContent = homeCount > 9 ? "9+" : String(homeCount);
    const list = $("#server-list");
    list.innerHTML = "";
    servers.filter((s) => s.id !== HOME_ID).forEach((s) => {
      const el = document.createElement("div");
      el.className =
        "rail-icon" +
        (!inDm() && currentServer && currentServer.id === s.id ? " active" : "") +
        (isMemberOf(s) ? "" : " guest");
      el.title = s.name + (isMemberOf(s) ? "" : " (viewing as admin)");
      if (s.iconUrl) {
        const img = document.createElement("img");
        img.src = s.iconUrl;
        img.alt = "";
        el.appendChild(img);
      } else {
        el.textContent = serverInitials(s.name);
      }
      el.style.setProperty("--accent", avatarColor(s.id));
      const pings = pingsByServer.get(s.id) || [];
      if (pings.length) el.appendChild(pingBadge(pings.length));
      el.addEventListener("click", () => selectServer(s, true));
      list.appendChild(el);
    });
  }

  // userInitiated: a click on the rail (leaves DM view). Background calls from snapshot
  // handlers keep whatever view the user is looking at.
  function selectServer(s, userInitiated) {
    const same = currentServer && currentServer.id === s.id;
    currentServer = s;
    safeSet("darkweb:lastServer", s.id);
    if (inDm() && userInitiated) leaveDmView();
    clearServerPings(s.id);
    renderRail();
    renderServerHeader();
    renderMembers();
    renderServerMemberList();
    if (same) {
      renderChannels();
      renderRoleList();
      renderServerIconPreview();
      renderAdminChannelList();
      if (inDm()) return;
      if (userInitiated && !unsubMessages) {
        const ch = currentTextChannel || channelsCache.find((c) => c.type === "text");
        if (ch) selectTextChannel(ch, 1);
        else showNoChannels();
      } else {
        renderMessages();
      }
      return;
    }
    teardownServerListeners();
    currentTextChannel = null;
    channelsCache = [];
    if (!inDm()) lastMessages = [];
    $("#app-screen").classList.remove("sidebar-open");
    subscribeChannels();
  }

  function showNoServer() {
    currentServer = null;
    teardownServerListeners();
    currentTextChannel = null;
    channelsCache = [];
    renderRail();
    renderServerHeader();
    renderChannels();
    renderMembers();
    if (inDm()) return;
    lastMessages = [];
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
    $("#menu-invite").hidden = !!(s && s.isHome);
    $("#menu-settings").hidden = !(canManage(s) || hasPerm(s, "manageChannels"));
    $("#menu-leave").hidden = !(s && !s.isHome && isMemberOf(s) && s.ownerUid !== (me && me.uid));
    $$(".category-add").forEach((b) => (b.hidden = !hasPerm(s, "manageChannels")));
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
      await createServerWithDefaults(id, name);
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
    const full = canManage(currentServer);
    $("#server-settings-title").textContent = currentServer.name + " — Settings";
    $("#server-rename-input").value = currentServer.name;
    $("#settings-invite-code").textContent = currentServer.isHome ? "Everyone joins automatically" : currentServer.id;
    $("#server-delete-btn").hidden = !!currentServer.isHome;
    setMsg("#server-settings-msg", "");
    $$(".tab-btn[data-stab]").forEach((b) => {
      const t = b.dataset.stab;
      b.hidden = t === "channels" ? !hasPerm(currentServer, "manageChannels") : !full;
    });
    if (!full && tab !== "channels") tab = "channels";
    renderServerIconPreview();
    renderAdminChannelList();
    renderRoleList();
    renderServerMemberList();
    showTabs("data-stab", "stab-", tab);
    openModal("server-settings-modal");
  }

  function renderServerIconPreview() {
    const box = $("#server-icon-preview");
    if (!box || !currentServer) return;
    box.innerHTML = "";
    const el = document.createElement("div");
    el.className = "server-icon-big";
    if (currentServer.iconUrl) {
      const img = document.createElement("img");
      img.src = currentServer.iconUrl;
      img.alt = "";
      el.appendChild(img);
    } else {
      el.textContent = serverInitials(currentServer.name);
      el.style.background = avatarColor(currentServer.id);
    }
    box.appendChild(el);
  }
  $("#server-icon-upload-btn").addEventListener("click", () => $("#server-icon-input").click());
  $("#server-icon-input").addEventListener("change", async () => {
    const file = $("#server-icon-input").files[0];
    $("#server-icon-input").value = "";
    if (!file || !currentServer) return;
    try {
      const iconUrl = await readImageFile(file, { maxDim: 128, square: true, quality: 0.85 });
      await updateDoc(doc(db, "servers", currentServer.id), { iconUrl });
      setMsg("#server-settings-msg", "Icon updated.", "ok");
    } catch (e) {
      setMsg("#server-settings-msg", e.message, "error");
    }
  });
  $("#server-icon-remove-btn").addEventListener("click", async () => {
    if (!currentServer) return;
    try {
      await updateDoc(doc(db, "servers", currentServer.id), { iconUrl: deleteField() });
    } catch (e) {
      setMsg("#server-settings-msg", e.message, "error");
    }
  });

  // ---- roles ----
  function renderRoleList() {
    const list = $("#role-list");
    if (!list || !currentServer) return;
    list.innerHTML = "";
    const roles = serverRoles(currentServer);
    if (!roles.length) {
      list.innerHTML = '<div class="empty-hint small">No roles yet. Add one above, then hand it out in the Members tab.</div>';
      return;
    }
    roles.forEach((r, idx) => {
      const card = document.createElement("div");
      card.className = "role-card";
      const head = document.createElement("div");
      head.className = "role-head";
      const color = document.createElement("input");
      color.type = "color";
      color.value = r.color || "#5865f2";
      color.title = "Role colour";
      color.addEventListener("change", () => updateRole(r.id, { color: color.value }));
      const name = document.createElement("input");
      name.className = "role-name-input";
      name.value = r.name;
      name.maxLength = 24;
      name.addEventListener("change", () => {
        if (name.value.trim()) updateRole(r.id, { name: name.value.trim() });
      });
      const mk = (label, cls, fn, disabled) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-sm " + cls;
        b.textContent = label;
        b.disabled = !!disabled;
        b.addEventListener("click", fn);
        return b;
      };
      head.appendChild(color);
      head.appendChild(name);
      head.appendChild(mk("↑", "btn-secondary", () => moveRole(idx, -1), idx === 0));
      head.appendChild(mk("↓", "btn-secondary", () => moveRole(idx, 1), idx === roles.length - 1));
      head.appendChild(mk("Delete", "btn-danger", () => deleteRole(r)));
      card.appendChild(head);
      const perms = document.createElement("div");
      perms.className = "role-perms";
      PERMS.forEach(([key, label]) => {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = (r.perms || []).includes(key);
        cb.addEventListener("change", () => {
          const set = new Set(r.perms || []);
          if (cb.checked) set.add(key);
          else set.delete(key);
          updateRole(r.id, { perms: Array.from(set) });
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(label));
        perms.appendChild(lab);
      });
      card.appendChild(perms);
      list.appendChild(card);
    });
  }

  async function updateRole(id, patch) {
    const roles = serverRoles(currentServer).map((r) => (r.id === id ? { ...r, ...patch } : r));
    try {
      await saveRoles(roles, currentServer.memberRoles || {});
    } catch (e) {
      setMsg("#server-settings-msg", e.message, "error");
    }
  }
  async function moveRole(idx, dir) {
    const roles = serverRoles(currentServer).slice();
    const j = idx + dir;
    if (j < 0 || j >= roles.length) return;
    [roles[idx], roles[j]] = [roles[j], roles[idx]];
    await saveRoles(roles, currentServer.memberRoles || {});
  }
  async function deleteRole(r) {
    if (!confirm('Delete the "' + r.name + '" role?')) return;
    const roles = serverRoles(currentServer).filter((x) => x.id !== r.id);
    const memberRoles = {};
    Object.entries(currentServer.memberRoles || {}).forEach(([uid, ids]) => {
      const rest = (ids || []).filter((id) => id !== r.id);
      if (rest.length) memberRoles[uid] = rest;
    });
    await saveRoles(roles, memberRoles);
  }
  $("#new-role-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentServer) return;
    const name = $("#new-role-name").value.trim();
    if (!name) return;
    const roles = serverRoles(currentServer).concat([{ id: genCode(), name, color: $("#new-role-color").value, perms: [] }]);
    try {
      await saveRoles(roles, currentServer.memberRoles || {});
      $("#new-role-name").value = "";
    } catch (err) {
      setMsg("#server-settings-msg", err.message, "error");
    }
  });
  async function toggleMemberRole(uid, roleId) {
    const memberRoles = { ...(currentServer.memberRoles || {}) };
    const cur = new Set(memberRoles[uid] || []);
    if (cur.has(roleId)) cur.delete(roleId);
    else cur.add(roleId);
    if (cur.size) memberRoles[uid] = Array.from(cur);
    else delete memberRoles[uid];
    await saveRoles(serverRoles(currentServer), memberRoles);
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
    const ids = currentServer.isHome ? allUsers().map((u) => u.uid) : currentServer.memberIds || [];
    ids.forEach((uid) => {
      const u = usersCache.get(uid);
      if (!u || u.banned) return;
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      label.appendChild(makeAvatar(u, uid, "avatar-24", false));
      const nameWrap = document.createElement("span");
      const name = document.createElement("span");
      name.textContent = u.displayName;
      const top = topRole(currentServer, uid);
      if (top && top.color) name.style.color = top.color;
      nameWrap.appendChild(name);
      if (uid === currentServer.ownerUid) nameWrap.appendChild(badgeIcon(ICONS.crown, "crown", "Owner"));
      const roles = serverRoles(currentServer);
      if (roles.length) {
        const chips = document.createElement("div");
        chips.className = "role-chips";
        const assigned = memberRoleIds(currentServer, uid);
        roles.forEach((r) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "role-chip" + (assigned.includes(r.id) ? " on" : "") + (canManage(currentServer) ? "" : " static");
          chip.textContent = r.name;
          chip.style.setProperty("--chip", r.color || "#5865f2");
          chip.title = canManage(currentServer) ? "Toggle role" : "";
          if (canManage(currentServer)) chip.addEventListener("click", () => toggleMemberRole(uid, r.id));
          chips.appendChild(chip);
        });
        nameWrap.appendChild(chips);
      }
      label.appendChild(nameWrap);
      const actions = document.createElement("span");
      if (canManage(currentServer) && !currentServer.isHome && uid !== currentServer.ownerUid && uid !== me.uid) {
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

  // A listen can race the write that grants access (server creation, joining); on a
  // permission error retry a few times before giving up.
  function retryOnDenied(err, label, retry, attempt, onGiveUp) {
    console.error("Dark Web: " + label + " listener", err);
    if (err && err.code === "permission-denied" && attempt < 3) setTimeout(() => retry(attempt + 1), 1200);
    else if (onGiveUp) onGiveUp(err);
  }

  function showAccessDenied(what, forDm) {
    if (inDm() !== !!forDm) return;
    $("#composer").hidden = true;
    $("#message-list").innerHTML =
      '<div class="empty-hint"><div class="empty-title">Can\'t load ' + what + "</div>" +
      "Firestore denied access. If you're the site admin, publish the latest <strong>firestore.rules</strong> " +
      "from the repo (Firestore → Rules → Publish), then relaunch.</div>";
  }

  function subscribeChannels(attempt = 0) {
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
          const firstText = channelsCache.find((c) => c.type === "text") || channelsCache.find((c) => c.type === "forum");
          if (inDm()) currentTextChannel = firstText || null;
          else if (firstText) selectTextChannel(firstText);
          else showNoChannels();
        } else {
          const fresh = channelsCache.find((c) => c.id === currentTextChannel.id);
          if (inDm()) currentTextChannel = fresh;
          else if (fresh.name !== currentTextChannel.name) selectTextChannel(fresh);
        }
        if (currentVoiceServer === sid && currentVoiceChannel && !channelsCache.some((c) => c.id === currentVoiceChannel)) {
          leaveVoice();
        }
      },
      (err) => retryOnDenied(err, "channels", (n) => {
        if (currentServer && currentServer.id === sid) subscribeChannels(n);
      }, attempt, () => {
        if (currentServer && currentServer.id === sid) showAccessDenied("this server's channels");
      })
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

  // Categories live on the server doc; channels point at one via categoryId. Channels created
  // before categories existed fall back to a virtual group per type so nothing disappears.
  const LEGACY_CATS = { text: "Text Channels", voice: "Voice Channels", forum: "Forums" };
  const serverCategories = (s) => (s && Array.isArray(s.categories) ? s.categories : []);

  function channelGroups() {
    const cats = serverCategories(currentServer);
    const known = new Set(cats.map((c) => c.id));
    const groups = cats.map((c) => ({ id: c.id, name: c.name, channels: [] }));
    const legacy = {};
    channelsCache.forEach((ch) => {
      let g = ch.categoryId && known.has(ch.categoryId) ? groups.find((x) => x.id === ch.categoryId) : null;
      // Uncategorised channels join a real category with the matching default name if one exists.
      if (!g) {
        const fallbackName = (LEGACY_CATS[ch.type] || "").toLowerCase();
        g = groups.find((x) => (x.name || "").toLowerCase() === fallbackName) || null;
      }
      if (g) g.channels.push(ch);
      else {
        const key = "_" + ch.type;
        if (!legacy[key]) legacy[key] = { id: key, name: LEGACY_CATS[ch.type] || "Channels", channels: [], legacy: true };
        legacy[key].channels.push(ch);
      }
    });
    ["_text", "_voice", "_forum"].forEach((k) => {
      if (legacy[k]) groups.push(legacy[k]);
    });
    return groups;
  }

  const collapseKey = (catId) => "darkweb:collapsed:" + currentServer.id + ":" + catId;

  function channelItem(c) {
    const isVoice = c.type === "voice";
    const active = isVoice
      ? currentVoiceServer === currentServer.id && currentVoiceChannel === c.id
      : !inDm() && currentTextChannel && currentTextChannel.id === c.id;
    const el = document.createElement("div");
    el.className = "channel-item" + (active ? " active" : "");
    const icon = c.type === "text" ? ICONS.hash : c.type === "forum" ? ICONS.forum : ICONS.speaker;
    el.innerHTML = '<span class="ch-icon">' + icon + '</span><span class="ch-name"></span>';
    el.querySelector(".ch-name").textContent = c.name;
    el.addEventListener("click", () => {
      if (isVoice) joinVoiceChannel(c);
      else if (c.type === "forum") selectForumChannel(c);
      else selectTextChannel(c);
    });
    if (!isVoice) return el;
    const wrap = document.createElement("div");
    wrap.appendChild(el);
    const parts = voiceParticipants.get(c.id) || [];
    if (parts.length) {
      const ul = document.createElement("div");
      ul.className = "voice-members";
      parts.forEach((p) => {
        const row = document.createElement("div");
        row.className = "voice-member" + (speakingNow.has(p.uid) ? " speaking" : "");
        row.dataset.uid = p.uid;
        const prof = profileFor(p.uid, p);
        row.appendChild(makeAvatar(prof, p.uid, "avatar-24", false));
        const n = document.createElement("span");
        n.textContent = prof.displayName || p.displayName || "Unknown";
        row.appendChild(n);
        ul.appendChild(row);
      });
      wrap.appendChild(ul);
    }
    return wrap;
  }

  function renderChannels() {
    const box = $("#channel-groups");
    box.innerHTML = "";
    if (!currentServer) return;
    const groups = channelGroups();
    const manage = hasPerm(currentServer, "manageChannels");
    if (!groups.length) {
      box.innerHTML = '<div class="empty-hint small">No channels yet</div>';
      return;
    }
    groups.forEach((g) => {
      const collapsed = safeGet(collapseKey(g.id)) === "1";
      const head = document.createElement("div");
      head.className = "category" + (collapsed ? " collapsed" : "");
      const nameBtn = document.createElement("button");
      nameBtn.className = "category-toggle";
      nameBtn.innerHTML = '<span class="chev">' + ICONS.chevDown + '</span><span class="category-name"></span>';
      nameBtn.querySelector(".category-name").textContent = g.name;
      nameBtn.addEventListener("click", () => {
        safeSet(collapseKey(g.id), collapsed ? "0" : "1");
        renderChannels();
      });
      head.appendChild(nameBtn);
      if (manage) {
        const add = document.createElement("button");
        add.className = "category-add";
        add.title = "Create channel in " + g.name;
        add.innerHTML = ICONS.plus;
        add.addEventListener("click", (e) => {
          e.stopPropagation();
          openServerSettings("channels");
          const sel = $("#new-channel-cat");
          if (!g.legacy && sel) sel.value = g.id;
          $("#new-channel-name").focus();
        });
        head.appendChild(add);
      }
      box.appendChild(head);
      const list = document.createElement("div");
      list.className = "category-channels";
      g.channels.forEach((c) => {
        const isActive =
          (c.type === "voice" && currentVoiceServer === currentServer.id && currentVoiceChannel === c.id) ||
          (c.type !== "voice" && !inDm() && currentTextChannel && currentTextChannel.id === c.id);
        const hasVoiceMembers = c.type === "voice" && (voiceParticipants.get(c.id) || []).length > 0;
        if (collapsed && !isActive && !hasVoiceMembers) return;
        list.appendChild(channelItem(c));
      });
      box.appendChild(list);
    });
  }

  function showNoChannels() {
    currentTextChannel = null;
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    if (inDm()) return;
    resetForumUi();
    lastMessages = [];
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
  const messagesCol = () => {
    if (inDm()) return collection(db, "dms", currentDm.id, "messages");
    if (currentPost) {
      return collection(db, "servers", currentServer.id, "channels", currentTextChannel.id, "posts", currentPost.id, "messages");
    }
    return collection(db, "servers", currentServer.id, "channels", currentTextChannel.id, "messages");
  };

  function resetForumUi() {
    currentPost = null;
    if (unsubPosts) unsubPosts();
    unsubPosts = null;
    postsCache = [];
    $("#post-back-btn").hidden = true;
    $("#new-post-btn").hidden = true;
    $("#channel-header-icon").innerHTML = ICONS.hash;
  }

  function selectTextChannel(ch, attempt = 0) {
    if (ch.type === "forum") return selectForumChannel(ch, attempt);
    if (inDm()) leaveDmView();
    resetForumUi();
    const switching = attempt > 0 || !currentTextChannel || currentTextChannel.id !== ch.id;
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
        if (inDm() || !currentServer || currentServer.id !== sid || !currentTextChannel || currentTextChannel.id !== ch.id) return;
        lastMessages = qs.docs.map((d) => ({ id: d.id, data: d.data() }));
        renderMessages();
      },
      (err) => retryOnDenied(err, "messages", (n) => {
        if (currentServer && currentServer.id === sid && currentTextChannel && currentTextChannel.id === ch.id) selectTextChannel(ch, n);
      }, attempt, () => {
        if (currentServer && currentServer.id === sid && currentTextChannel && currentTextChannel.id === ch.id) showAccessDenied("#" + ch.name);
      })
    );
  }

  // ---- forum channels ----
  const postsCol = (ch) => collection(db, "servers", currentServer.id, "channels", ch.id, "posts");

  function selectForumChannel(ch, attempt = 0) {
    if (inDm()) leaveDmView();
    const switching = attempt > 0 || !currentTextChannel || currentTextChannel.id !== ch.id;
    currentTextChannel = ch;
    currentPost = null;
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    lastMessages = [];
    $("#channel-header-icon").innerHTML = ICONS.forum;
    $("#channel-header-name").textContent = ch.name;
    $("#composer").hidden = true;
    $("#new-post-btn").hidden = false;
    $("#post-back-btn").hidden = true;
    $("#app-screen").classList.remove("sidebar-open");
    renderChannels();
    if (!switching) {
      renderPosts();
      return;
    }
    if (unsubPosts) unsubPosts();
    postsCache = [];
    renderPosts();
    unsubPosts = onSnapshot(
      query(postsCol(ch), orderBy("lastActivity", "desc"), limit(50)),
      (qs) => {
        if (inDm() || !currentTextChannel || currentTextChannel.id !== ch.id) return;
        postsCache = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (currentPost) {
          const fresh = postsCache.find((p) => p.id === currentPost.id);
          if (fresh) {
            currentPost = fresh;
            $("#channel-header-name").textContent = fresh.title;
          } else closePost();
        } else renderPosts();
      },
      (err) => retryOnDenied(err, "posts", (n) => {
        if (currentTextChannel && currentTextChannel.id === ch.id) selectForumChannel(ch, n);
      }, attempt, () => {
        if (currentTextChannel && currentTextChannel.id === ch.id) showAccessDenied("#" + ch.name);
      })
    );
  }

  function renderPosts() {
    if (inDm() || !currentTextChannel || currentTextChannel.type !== "forum" || currentPost) return;
    const list = $("#message-list");
    list.innerHTML = "";
    const head = document.createElement("div");
    head.className = "welcome";
    head.innerHTML = '<div class="welcome-icon">' + ICONS.forum + "</div><h2></h2><p>Start a post to kick off a discussion.</p>";
    head.querySelector("h2").textContent = currentTextChannel.name;
    list.appendChild(head);
    if (!postsCache.length) {
      const hint = document.createElement("div");
      hint.className = "empty-hint small";
      hint.style.padding = "0 16px";
      hint.textContent = "No posts yet.";
      list.appendChild(hint);
      return;
    }
    postsCache.forEach((p) => {
      const card = document.createElement("div");
      card.className = "post-card";
      const title = document.createElement("div");
      title.className = "post-title";
      title.textContent = p.title || "(untitled)";
      const meta = document.createElement("div");
      meta.className = "post-meta";
      const prof = profileFor(p.uid, { displayName: p.displayName });
      meta.appendChild(makeAvatar(prof, p.uid, "avatar-24", false));
      const who = document.createElement("span");
      who.textContent = prof.displayName || p.displayName || "Unknown";
      const when = document.createElement("span");
      when.textContent = formatTime(p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : new Date());
      const count = document.createElement("span");
      const n = p.messageCount || 0;
      count.textContent = n + (n === 1 ? " message" : " messages");
      meta.appendChild(who);
      meta.appendChild(when);
      meta.appendChild(count);
      if (me && (p.uid === me.uid || hasPerm(currentServer, "manageMessages"))) {
        const del = document.createElement("button");
        del.className = "icon-btn danger del";
        del.title = "Delete post";
        del.innerHTML = ICONS.trash;
        del.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (confirm('Delete the post "' + p.title + '"?')) await deleteDoc(doc(postsCol(currentTextChannel), p.id));
        });
        meta.appendChild(del);
      }
      card.appendChild(title);
      card.appendChild(meta);
      card.addEventListener("click", () => openPost(p));
      list.appendChild(card);
    });
  }

  function openPost(p, attempt = 0) {
    currentPost = p;
    messagesFirstRender = true;
    lastMessages = [];
    $("#post-back-btn").hidden = false;
    $("#new-post-btn").hidden = true;
    $("#channel-header-name").textContent = p.title;
    $("#composer").hidden = false;
    $("#message-input").placeholder = "Reply to this post";
    if (unsubMessages) unsubMessages();
    const ch = currentTextChannel;
    unsubMessages = onSnapshot(
      query(collection(postsCol(ch), p.id, "messages"), orderBy("createdAt"), limit(MESSAGE_LIMIT)),
      (qs) => {
        if (inDm() || !currentPost || currentPost.id !== p.id) return;
        lastMessages = qs.docs.map((d) => ({ id: d.id, data: d.data() }));
        renderMessages();
      },
      (err) => retryOnDenied(err, "post messages", (n) => {
        if (currentPost && currentPost.id === p.id) openPost(p, n);
      }, attempt, () => {
        if (currentPost && currentPost.id === p.id) showAccessDenied("this post");
      })
    );
  }

  function closePost() {
    currentPost = null;
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    lastMessages = [];
    $("#post-back-btn").hidden = true;
    $("#new-post-btn").hidden = false;
    $("#composer").hidden = true;
    if (currentTextChannel) $("#channel-header-name").textContent = currentTextChannel.name;
    renderPosts();
  }
  $("#post-back-btn").addEventListener("click", closePost);

  function postWelcomeBlock(p) {
    const w = document.createElement("div");
    w.className = "welcome";
    const prof = profileFor(p.uid, { displayName: p.displayName });
    w.innerHTML = "<h2></h2><p>Posted by <b></b> in #<span></span>.</p>";
    w.querySelector("h2").textContent = p.title;
    w.querySelector("b").textContent = prof.displayName || p.displayName || "Unknown";
    w.querySelector("span").textContent = currentTextChannel ? currentTextChannel.name : "";
    return w;
  }

  function notePostActivity() {
    if (inDm() || !currentPost || !currentTextChannel) return;
    updateDoc(doc(postsCol(currentTextChannel), currentPost.id), {
      lastActivity: serverTimestamp(),
      messageCount: increment(1),
    }).catch(() => {});
  }

  $("#new-post-btn").addEventListener("click", () => {
    $("#new-post-title").value = "";
    $("#new-post-body").value = "";
    setMsg("#new-post-msg", "");
    openModal("new-post-modal");
    $("#new-post-title").focus();
  });
  $("#new-post-close").addEventListener("click", () => closeModal("new-post-modal"));
  $("#new-post-create").addEventListener("click", async () => {
    const title = $("#new-post-title").value.trim();
    const body = $("#new-post-body").value.trim();
    if (!title || !body) {
      setMsg("#new-post-msg", "Give the post a title and a first message.", "error");
      return;
    }
    if (!currentServer || !currentTextChannel || currentTextChannel.type !== "forum") return;
    const ch = currentTextChannel;
    const postMentions = renderRichText(document.createElement("div"), body).uids;
    const postRef = doc(postsCol(ch));
    const batch = writeBatch(db);
    batch.set(postRef, {
      title,
      uid: me.uid,
      displayName: me.displayName,
      createdAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      messageCount: 1,
    });
    batch.set(doc(collection(postRef, "messages")), {
      text: body,
      uid: me.uid,
      displayName: me.displayName,
      avatarEmoji: me.avatarEmoji,
      mentions: postMentions,
      reactions: {},
      createdAt: serverTimestamp(),
    });
    try {
      await batch.commit();
      closeModal("new-post-modal");
      openPost({ id: postRef.id, title, uid: me.uid, displayName: me.displayName });
      firePings(postMentions, title + ": " + body);
    } catch (e) {
      setMsg("#new-post-msg", "Couldn't post: " + e.message, "error");
    }
  });

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

  function dmWelcomeBlock(name) {
    const w = document.createElement("div");
    w.className = "welcome";
    w.innerHTML = "<h2></h2><p>This is the beginning of your direct message history with <b></b>.</p>";
    w.querySelector("h2").textContent = name;
    w.querySelector("b").textContent = "@" + name;
    return w;
  }

  function renderMessages() {
    const list = $("#message-list");
    if (inDm() ? !currentDm : !currentServer || !currentTextChannel) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    list.innerHTML = "";
    if (lastMessages.length < MESSAGE_LIMIT) {
      list.appendChild(
        inDm()
          ? dmWelcomeBlock(profileFor(dmOther(currentDm), { displayName: "Unknown" }).displayName || "Unknown")
          : currentPost
            ? postWelcomeBlock(currentPost)
            : welcomeBlock(currentTextChannel.name)
      );
    }

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
        if (!inDm()) {
          const role = topRole(currentServer, m.uid);
          if (role && role.color) author.style.color = role.color;
        }
        if (me && m.uid !== me.uid) {
          author.classList.add("clickable");
          author.title = "Message " + (prof.displayName || "");
          author.addEventListener("click", () => openProfile(m.uid));
        }
        const badgeText =
          !inDm() && m.uid === currentServer.ownerUid ? "OWNER" : prof.role === "admin" ? "ADMIN" : null;
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
        text.className = "msg-text" + (EMOJI_ONLY_RE.test(m.text) && Array.from(m.text.trim()).length <= 12 ? " jumbo" : "");
        const { mentionsMe } = renderRichText(text, m.text);
        if (mentionsMe || (Array.isArray(m.mentions) && me && (m.mentions.includes(me.uid) || m.mentions.includes("everyone")))) {
          row.classList.add("mentioned");
        }
        body.appendChild(text);
      }
      if (m.type === "poll") body.appendChild(renderPoll(m, id));
      const imageSrc = m.imageData || m.gifUrl;
      if (imageSrc) {
        const img = document.createElement("img");
        img.className = "msg-image";
        img.src = imageSrc;
        img.alt = m.gifUrl ? "GIF" : "attachment";
        img.loading = "lazy";
        img.addEventListener("click", () => {
          $("#lightbox-img").src = imageSrc;
          openModal("lightbox");
        });
        body.appendChild(img);
      }
      row.appendChild(body);

      const reactionRow = renderReactions(m, id);
      if (reactionRow) body.appendChild(reactionRow);

      if (me) {
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const react = document.createElement("button");
        react.className = "icon-btn react-trigger";
        react.title = "Add reaction";
        react.innerHTML = ICONS.emoji;
        react.addEventListener("click", () => openReactionPicker(id, m));
        actions.appendChild(react);
        if (me.uid === m.uid || (!inDm() && hasPerm(currentServer, "manageMessages"))) {
          const del = document.createElement("button");
          del.className = "icon-btn danger";
          del.title = "Delete message";
          del.innerHTML = ICONS.trash;
          del.addEventListener("click", () => deleteDoc(doc(messagesCol(), id)));
          actions.appendChild(del);
        }
        row.appendChild(actions);
      }
      list.appendChild(row);
      prev = { uid: m.uid, date };
    });

    if (nearBottom || messagesFirstRender) list.scrollTop = list.scrollHeight;
    messagesFirstRender = false;
  }

  // ---------- @mentions ----------
  const isWordChar = (c) => !!c && /[A-Za-z0-9_]/.test(c);

  function mentionNames() {
    return allUsers()
      .filter((u) => u.displayName)
      .map((u) => ({ uid: u.uid, name: u.displayName }))
      .sort((a, b) => b.name.length - a.name.length);
  }

  // Turns "@Name" runs in plain text into mention pills. Returns who was mentioned.
  function renderRichText(el, text) {
    const names = mentionNames();
    const uids = new Set();
    let mentionsMe = false;
    let i = 0;
    while (i < text.length) {
      const at = text.indexOf("@", i);
      if (at === -1) {
        el.appendChild(document.createTextNode(text.slice(i)));
        break;
      }
      el.appendChild(document.createTextNode(text.slice(i, at)));
      const rest = text.slice(at + 1);
      const lower = rest.toLowerCase();
      let match = null;
      if (lower.startsWith("everyone") && !isWordChar(rest[8])) match = { uid: "everyone", name: "everyone" };
      else {
        for (const n of names) {
          if (lower.startsWith(n.name.toLowerCase()) && !isWordChar(rest[n.name.length])) {
            match = n;
            break;
          }
        }
      }
      if (match) {
        const forMe = me && (match.uid === me.uid || match.uid === "everyone");
        const pill = document.createElement("span");
        pill.className = "mention" + (forMe ? " me" : "");
        pill.textContent = "@" + match.name;
        el.appendChild(pill);
        uids.add(match.uid);
        if (forMe) mentionsMe = true;
        i = at + 1 + match.name.length;
      } else {
        el.appendChild(document.createTextNode("@"));
        i = at + 1;
      }
    }
    return { mentionsMe, uids: Array.from(uids) };
  }

  let mentionItems = [];
  let mentionIndex = 0;
  let mentionStart = -1;
  const mentionPopup = $("#mention-popup");
  const mentionList = $("#mention-list");

  function mentionCandidates(q) {
    let pool;
    if (inDm()) pool = (currentDm.participants || []).map((uid) => ({ uid, ...(usersCache.get(uid) || {}) }));
    else if (!currentServer) return [];
    else pool = currentServer.isHome
      ? allUsers()
      : (currentServer.memberIds || []).map((uid) => ({ uid, ...(usersCache.get(uid) || {}) }));
    const items = pool
      .filter((u) => u.displayName && !u.banned && u.displayName.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          (a.displayName.toLowerCase().startsWith(q) ? 0 : 1) - (b.displayName.toLowerCase().startsWith(q) ? 0 : 1) ||
          a.displayName.localeCompare(b.displayName)
      )
      .slice(0, 8)
      .map((u) => ({ uid: u.uid, name: u.displayName, profile: u }));
    if (!inDm() && "everyone".startsWith(q) && hasPerm(currentServer, "mentionEveryone")) items.unshift({ uid: "everyone", name: "everyone" });
    return items;
  }

  function closeMentionPopup() {
    mentionPopup.hidden = true;
    mentionItems = [];
    mentionStart = -1;
  }

  function updateMentionPopup() {
    const input = $("#message-input");
    const caret = input.selectionStart;
    const before = input.value.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1 || (at > 0 && isWordChar(before[at - 1])) || before.slice(at).length > 32 || before.slice(at).includes("\n")) {
      closeMentionPopup();
      return;
    }
    const q = before.slice(at + 1).toLowerCase();
    mentionItems = mentionCandidates(q);
    if (!mentionItems.length) {
      closeMentionPopup();
      return;
    }
    mentionStart = at;
    mentionIndex = Math.min(mentionIndex, mentionItems.length - 1);
    renderMentionPopup();
    mentionPopup.hidden = false;
  }

  function renderMentionPopup() {
    mentionList.innerHTML = "";
    mentionItems.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "mention-item" + (idx === mentionIndex ? " active" : "");
      if (item.uid === "everyone") {
        const tag = document.createElement("span");
        tag.className = "mention-everyone";
        tag.textContent = "@";
        row.appendChild(tag);
      } else {
        row.appendChild(makeAvatar(item.profile, item.uid, "avatar-24", false));
      }
      const name = document.createElement("span");
      name.textContent = item.uid === "everyone" ? "everyone" : item.name;
      row.appendChild(name);
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        insertMention(item);
      });
      mentionList.appendChild(row);
    });
  }

  function insertMention(item) {
    const input = $("#message-input");
    const caret = input.selectionStart;
    const value = input.value;
    const inserted = "@" + item.name + " ";
    input.value = value.slice(0, mentionStart) + inserted + value.slice(caret);
    const pos = mentionStart + inserted.length;
    input.setSelectionRange(pos, pos);
    input.focus();
    closeMentionPopup();
  }

  function autoGrowComposer() {
    const el = $("#message-input");
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }
  $("#message-input").addEventListener("input", () => {
    mentionIndex = 0;
    updateMentionPopup();
    autoGrowComposer();
  });
  $("#message-input").addEventListener("blur", () => setTimeout(closeMentionPopup, 150));

  $("#send-btn").addEventListener("click", sendMessage);
  $("#message-input").addEventListener("keydown", (e) => {
    if (!mentionPopup.hidden) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        mentionIndex = (mentionIndex + 1) % mentionItems.length;
        renderMentionPopup();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        mentionIndex = (mentionIndex - 1 + mentionItems.length) % mentionItems.length;
        renderMentionPopup();
        return;
      }
      if (e.key === "Enter" || e.keyCode === 13 || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionItems[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMentionPopup();
        return;
      }
    }
    if ((e.key === "Enter" || e.keyCode === 13) && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  async function sendMessage() {
    const input = $("#message-input");
    const text = input.value.trim();
    if ((!text && !pendingImage) || !me || (inDm() ? !currentDm : !currentServer || !currentTextChannel)) return;
    closeMentionPopup();
    closePicker();
    const payload = {
      text,
      uid: me.uid,
      displayName: me.displayName,
      avatarEmoji: me.avatarEmoji,
      mentions: renderRichText(document.createElement("div"), text).uids,
      reactions: {},
      createdAt: serverTimestamp(),
    };
    if (pendingImage) payload.imageData = pendingImage;
    input.value = "";
    autoGrowComposer();
    clearPendingImage();
    try {
      await addDoc(messagesCol(), payload);
      noteDmActivity(text || "Sent an image");
      notePostActivity();
      firePings(payload.mentions, text);
    } catch (e) {
      alert("Couldn't send: " + e.message);
    }
  }

  // ---------- emoji & GIF picker ----------
  const picker = $("#picker");
  let pickerMode = "emoji";
  let gifTimer = null;
  let gifRequestId = 0;
  let reactionTarget = null; // { msgId, m } when the picker was opened to react to a message

  function recentEmoji() {
    try {
      return JSON.parse(safeGet(RECENT_EMOJI_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function rememberEmoji(emoji) {
    const list = [emoji].concat(recentEmoji().filter((e) => e !== emoji)).slice(0, 24);
    safeSet(RECENT_EMOJI_KEY, JSON.stringify(list));
  }

  function insertAtCaret(text) {
    const input = $("#message-input");
    const start = input.selectionStart == null ? input.value.length : input.selectionStart;
    const end = input.selectionEnd == null ? start : input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    input.focus();
  }

  function renderEmojiPicker() {
    const box = $("#picker-emoji");
    box.innerHTML = "";
    const groups = [];
    const recent = recentEmoji();
    if (recent.length) groups.push(["Recently used", recent]);
    EMOJI_GROUPS.forEach(([name, str]) => groups.push([name, str.split(/\s+/).filter(Boolean)]));
    groups.forEach(([name, list]) => {
      const h = document.createElement("div");
      h.className = "picker-section";
      h.textContent = name;
      box.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "emoji-grid";
      list.forEach((emoji) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "emoji-btn";
        b.textContent = emoji;
        b.addEventListener("mousedown", (e) => e.preventDefault());
        b.addEventListener("click", () => {
          if (reactionTarget) {
            toggleReaction(reactionTarget.msgId, reactionTarget.m, emoji);
            closePicker();
          } else {
            insertAtCaret(emoji);
            rememberEmoji(emoji);
          }
        });
        grid.appendChild(b);
      });
      box.appendChild(grid);
    });
  }

  function showPicker(mode) {
    pickerMode = mode;
    $$(".picker-tab").forEach((t) => t.classList.toggle("active", t.dataset.picker === mode));
    $("#picker-emoji").hidden = mode !== "emoji";
    $("#picker-gif").hidden = mode !== "gif";
    $("#picker-search").hidden = mode !== "gif";
    closeMentionPopup();
    picker.hidden = false;
    if (mode === "emoji") renderEmojiPicker();
    else {
      $("#picker-search").focus();
      loadGifs($("#picker-search").value.trim());
    }
  }
  function closePicker() {
    picker.hidden = true;
    reactionTarget = null;
    $(".picker-tab[data-picker='gif']").hidden = false;
  }
  function togglePicker(mode) {
    if (!picker.hidden && pickerMode === mode) closePicker();
    else showPicker(mode);
  }
  function openReactionPicker(msgId, m) {
    reactionTarget = { msgId, m };
    $(".picker-tab[data-picker='gif']").hidden = true;
    showPicker("emoji");
  }

  $$(".picker-tab").forEach((t) => t.addEventListener("click", () => showPicker(t.dataset.picker)));
  $("#emoji-btn").addEventListener("click", () => {
    reactionTarget = null;
    togglePicker("emoji");
  });
  $("#gif-btn").addEventListener("click", () => {
    reactionTarget = null;
    togglePicker("gif");
  });
  $("#picker-search").addEventListener("input", () => {
    clearTimeout(gifTimer);
    gifTimer = setTimeout(() => loadGifs($("#picker-search").value.trim()), 350);
  });
  $("#picker-search").addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePicker();
  });
  shadow.addEventListener("click", (e) => {
    if (picker.hidden) return;
    const path = e.composedPath();
    if (
      !path.includes(picker) &&
      !path.includes($("#emoji-btn")) &&
      !path.includes($("#gif-btn")) &&
      !path.some((el) => el.classList && el.classList.contains("react-trigger"))
    ) {
      closePicker();
    }
  });

  // Returns [{preview, full, alt}] from whichever GIF provider has a key configured.
  async function fetchGifs(q) {
    if (tenorApiKey) {
      const params = new URLSearchParams({
        key: tenorApiKey,
        client_key: "darkweb",
        limit: "30",
        media_filter: "tinygif,mediumgif,gif",
        contentfilter: "medium",
      });
      let url = "https://tenor.googleapis.com/v2/featured?" + params;
      if (q) {
        params.set("q", q);
        url = "https://tenor.googleapis.com/v2/search?" + params;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Tenor returned " + res.status);
      const data = await res.json();
      return (data.results || [])
        .map((r) => {
          const f = r.media_formats || {};
          return {
            preview: (f.tinygif || f.mediumgif || f.gif || {}).url,
            full: (f.mediumgif || f.gif || f.tinygif || {}).url,
            alt: r.content_description || "GIF",
          };
        })
        .filter((g) => g.preview && g.full);
    }
    const params = new URLSearchParams({ api_key: giphyApiKey, limit: "30", rating: "pg-13" });
    let url = "https://api.giphy.com/v1/gifs/trending?" + params;
    if (q) {
      params.set("q", q);
      url = "https://api.giphy.com/v1/gifs/search?" + params;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("GIPHY returned " + res.status);
    const data = await res.json();
    return (data.data || [])
      .map((r) => {
        const im = r.images || {};
        return {
          preview: (im.fixed_width_small || im.fixed_width || {}).url,
          full: (im.fixed_width || im.downsized || im.original || {}).url,
          alt: r.title || "GIF",
        };
      })
      .filter((g) => g.preview && g.full);
  }

  async function loadGifs(q) {
    const box = $("#picker-gif");
    if (!tenorApiKey && !giphyApiKey) {
      box.innerHTML =
        '<div class="picker-note">GIF search needs a free <strong>Tenor</strong> or <strong>GIPHY</strong> API key. ' +
        "Whoever runs this Dark Web instance adds it to <code>firebase-config.js</code> (see the README).</div>";
      return;
    }
    const id = ++gifRequestId;
    box.innerHTML = '<div class="picker-note">Loading…</div>';
    try {
      const results = await fetchGifs(q);
      if (id !== gifRequestId) return;
      box.innerHTML = "";
      if (!results.length) {
        box.innerHTML = '<div class="picker-note">No GIFs found.</div>';
        return;
      }
      const grid = document.createElement("div");
      grid.className = "gif-grid";
      results.forEach((g) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "gif-item";
        const img = document.createElement("img");
        img.src = g.preview;
        img.alt = g.alt;
        img.loading = "lazy";
        b.appendChild(img);
        b.addEventListener("click", () => sendGif(g.full));
        grid.appendChild(b);
      });
      box.appendChild(grid);
    } catch (e) {
      if (id !== gifRequestId) return;
      box.innerHTML = '<div class="picker-note">Couldn\'t load GIFs: ' + e.message + "</div>";
    }
  }

  async function sendGif(url) {
    if (!me || (inDm() ? !currentDm : !currentServer || !currentTextChannel)) return;
    closePicker();
    try {
      await addDoc(messagesCol(), {
        text: "",
        gifUrl: url,
        uid: me.uid,
        displayName: me.displayName,
        avatarEmoji: me.avatarEmoji,
        mentions: [],
        reactions: {},
        createdAt: serverTimestamp(),
      });
      noteDmActivity("Sent a GIF");
      notePostActivity();
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

  // ---------- polls ----------
  const MAX_POLL_OPTIONS = 10;
  function renderPollOptionInputs(count) {
    const box = $("#poll-options");
    box.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const row = document.createElement("div");
      row.className = "poll-option-row";
      const input = document.createElement("input");
      input.className = "poll-option-input";
      input.placeholder = "Option " + (i + 1);
      input.maxLength = 80;
      row.appendChild(input);
      if (count > 2) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "icon-btn danger";
        rm.title = "Remove option";
        rm.innerHTML = ICONS.close;
        rm.addEventListener("click", () => {
          row.remove();
          Array.from(box.children).forEach((r, idx) => {
            if (!r.querySelector(".poll-option-input").value) r.querySelector(".poll-option-input").placeholder = "Option " + (idx + 1);
          });
        });
        row.appendChild(rm);
      }
      box.appendChild(row);
    }
  }
  $("#poll-btn").addEventListener("click", () => {
    if (!me || (inDm() ? !currentDm : !currentServer || !currentTextChannel)) return;
    closePicker();
    closeMentionPopup();
    $("#poll-question").value = "";
    $("#poll-multi").checked = false;
    setMsg("#poll-msg", "");
    renderPollOptionInputs(2);
    openModal("poll-modal");
    $("#poll-question").focus();
  });
  $("#poll-close").addEventListener("click", () => closeModal("poll-modal"));
  $("#poll-add-option").addEventListener("click", () => {
    const box = $("#poll-options");
    if (box.children.length >= MAX_POLL_OPTIONS) return;
    renderPollOptionInputs(box.children.length + 1);
  });
  $("#poll-create-btn").addEventListener("click", async () => {
    const question = $("#poll-question").value.trim();
    const options = Array.from($("#poll-options").querySelectorAll(".poll-option-input"))
      .map((i) => i.value.trim())
      .filter(Boolean);
    if (!question) {
      setMsg("#poll-msg", "Give the poll a question.", "error");
      return;
    }
    if (options.length < 2) {
      setMsg("#poll-msg", "Add at least 2 options.", "error");
      return;
    }
    if (!me || (inDm() ? !currentDm : !currentServer || !currentTextChannel)) return;
    try {
      await addDoc(messagesCol(), {
        type: "poll",
        question,
        pollOptions: options.map((text, i) => ({ id: "opt" + i, text })),
        multi: $("#poll-multi").checked,
        votes: {},
        reactions: {},
        text: "",
        uid: me.uid,
        displayName: me.displayName,
        avatarEmoji: me.avatarEmoji,
        mentions: [],
        createdAt: serverTimestamp(),
      });
      noteDmActivity("📊 " + question);
      notePostActivity();
      closeModal("poll-modal");
    } catch (e) {
      setMsg("#poll-msg", "Couldn't create poll: " + e.message, "error");
    }
  });

  async function votePoll(msgId, m, optionId) {
    if (!me) return;
    const mine = (m.votes && m.votes[me.uid]) || [];
    let next;
    if (m.multi) {
      next = mine.includes(optionId) ? mine.filter((o) => o !== optionId) : mine.concat([optionId]);
    } else {
      next = mine.length === 1 && mine[0] === optionId ? [] : [optionId];
    }
    try {
      if (next.length) await updateDoc(doc(messagesCol(), msgId), { ["votes." + me.uid]: next });
      else await updateDoc(doc(messagesCol(), msgId), { ["votes." + me.uid]: deleteField() });
    } catch (e) {
      alert("Couldn't vote: " + e.message);
    }
  }

  // ---------- reactions ----------
  async function toggleReaction(msgId, m, emoji) {
    if (!me) return;
    const mine = (m.reactions && m.reactions[me.uid]) || [];
    const next = mine.includes(emoji) ? mine.filter((e) => e !== emoji) : mine.concat([emoji]);
    try {
      if (next.length) await updateDoc(doc(messagesCol(), msgId), { ["reactions." + me.uid]: next });
      else await updateDoc(doc(messagesCol(), msgId), { ["reactions." + me.uid]: deleteField() });
    } catch (e) {
      alert("Couldn't react: " + e.message);
    }
  }

  function renderReactions(m, msgId) {
    const reactions = m.reactions || {};
    const byEmoji = new Map();
    Object.entries(reactions).forEach(([uid, emojis]) => {
      (emojis || []).forEach((e) => {
        if (!byEmoji.has(e)) byEmoji.set(e, []);
        byEmoji.get(e).push(uid);
      });
    });
    if (!byEmoji.size) return null;
    const wrap = document.createElement("div");
    wrap.className = "reaction-row";
    byEmoji.forEach((uids, emoji) => {
      const mine = !!(me && uids.includes(me.uid));
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "reaction-pill" + (mine ? " mine" : "");
      pill.title = uids.map((u) => profileFor(u, { displayName: "Unknown" }).displayName || "Unknown").join(", ");
      const em = document.createElement("span");
      em.textContent = emoji;
      const count = document.createElement("span");
      count.className = "reaction-count";
      count.textContent = String(uids.length);
      pill.appendChild(em);
      pill.appendChild(count);
      pill.addEventListener("click", () => toggleReaction(msgId, m, emoji));
      wrap.appendChild(pill);
    });
    return wrap;
  }

  function renderPoll(m, msgId) {
    const card = document.createElement("div");
    card.className = "poll-card";
    const q = document.createElement("div");
    q.className = "poll-question";
    q.innerHTML = ICONS.poll;
    const qText = document.createElement("span");
    qText.textContent = m.question;
    q.appendChild(qText);
    card.appendChild(q);

    const votes = m.votes || {};
    const counts = {};
    let total = 0;
    const mine = (me && votes[me.uid]) || [];
    (m.pollOptions || []).forEach((o) => (counts[o.id] = 0));
    Object.values(votes).forEach((arr) => {
      (arr || []).forEach((id) => {
        if (id in counts) {
          counts[id]++;
          total++;
        }
      });
    });

    (m.pollOptions || []).forEach((o) => {
      const n = counts[o.id] || 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      const selected = mine.includes(o.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "poll-option" + (selected ? " selected" : "");
      row.disabled = !me;
      const fill = document.createElement("div");
      fill.className = "poll-option-fill";
      fill.style.width = pct + "%";
      row.appendChild(fill);
      const label = document.createElement("span");
      label.className = "poll-option-label";
      label.textContent = o.text;
      const stat = document.createElement("span");
      stat.className = "poll-option-stat";
      stat.textContent = n + " · " + pct + "%";
      row.appendChild(label);
      row.appendChild(stat);
      row.addEventListener("click", () => votePoll(msgId, m, o.id));
      card.appendChild(row);
    });

    const footer = document.createElement("div");
    footer.className = "poll-footer";
    footer.textContent = total + (total === 1 ? " vote" : " votes") + (m.multi ? " · pick any" : " · pick one");
    card.appendChild(footer);
    return card;
  }

  // ---------- direct messages ----------
  const DM_READ_KEY = "darkweb:dmRead";
  const dmIdFor = (a, b) => (a < b ? a + "_" + b : b + "_" + a);
  function inDm() {
    return viewMode === "dm";
  }
  function dmOther(dm) {
    return (dm.participants || []).find((u) => u !== me.uid) || me.uid;
  }

  // Tracks who has joined a DM's call so the header can show "Call" / an incoming-call
  // banner / nothing. Stays pinned to whichever DM you're actually calling in even if you
  // browse to view a different conversation; otherwise it follows the DM you're viewing.
  function ensureDmCallListener(viewedDmId) {
    const target = currentVoiceDm || viewedDmId;
    if (!target || dmCallListenerId === target) return;
    if (unsubDmCallParticipants) unsubDmCallParticipants();
    dmCallListenerId = target;
    dmCallParticipants = [];
    unsubDmCallParticipants = onSnapshot(
      collection(db, "dms", target, "call", "current", "participants"),
      (qs) => {
        dmCallParticipants = qs.docs.map((d) => ({ uid: d.id, ...d.data() }));
        if (!dmCallParticipants.some((p) => p.uid !== me.uid)) declinedDmCall = null;
        renderDmCallUi();
        renderStage();
        renderVoicePeers();
      },
      (err) => console.error("Dark Web: dm call listener", err)
    );
  }
  function unsubscribeDmCallParticipants() {
    if (unsubDmCallParticipants) unsubDmCallParticipants();
    unsubDmCallParticipants = null;
    dmCallListenerId = null;
    dmCallParticipants = [];
  }

  function renderDmCallUi() {
    const banner = $("#incoming-call-banner");
    const callBtn = $("#dm-call-btn");
    if (!inDm() || !currentDm) {
      callBtn.hidden = true;
      banner.hidden = true;
      return;
    }
    const inThisCall = currentVoiceDm === currentDm.id;
    const dmCallActive = dmCallListenerId === currentDm.id;
    const otherJoined = dmCallActive && dmCallParticipants.some((p) => p.uid !== me.uid);
    callBtn.hidden = inThisCall || otherJoined;
    banner.hidden = !(otherJoined && !inThisCall && declinedDmCall !== currentDm.id);
    if (otherJoined) {
      const other = dmCallParticipants.find((p) => p.uid !== me.uid);
      const prof = profileFor(other.uid, other);
      $("#incoming-call-text").textContent = (prof.displayName || "Someone") + " is calling…";
    }
  }
  $("#dm-call-btn").addEventListener("click", () => {
    if (currentDm) startDmCall(currentDm);
  });
  $("#incoming-call-accept").addEventListener("click", () => {
    if (currentDm) startDmCall(currentDm);
  });
  $("#incoming-call-decline").addEventListener("click", () => {
    if (currentDm) declinedDmCall = currentDm.id;
    renderDmCallUi();
  });

  function noteDmCallActivity(dm) {
    updateDoc(doc(db, "dms", dm.id), {
      lastMessageAt: serverTimestamp(),
      lastText: "📞 Started a call",
      lastFrom: me.uid,
    }).catch(() => {});
  }
  function dmReadMap() {
    try {
      return JSON.parse(safeGet(DM_READ_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function markDmRead(dmId) {
    const m = dmReadMap();
    m[dmId] = Date.now() + 2000;
    safeSet(DM_READ_KEY, JSON.stringify(m));
  }
  function dmUnread(dm) {
    if (!me || !dm.lastMessageAt || dm.lastFrom === me.uid) return false;
    return ts(dm.lastMessageAt) > (dmReadMap()[dm.id] || 0);
  }

  function subscribeDms() {
    if (unsubDms) unsubDms();
    unsubDms = onSnapshot(
      query(collection(db, "dms"), where("participants", "array-contains", me.uid)),
      (qs) => {
        dms = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
        dms.sort((a, b) => ts(b.lastMessageAt || b.createdAt) - ts(a.lastMessageAt || a.createdAt));
        if (currentDm) {
          const fresh = dms.find((d) => d.id === currentDm.id);
          if (fresh) {
            currentDm = fresh;
            if (inDm()) markDmRead(fresh.id);
          }
        }
        renderDmList();
        renderDmBadge();
      },
      (err) => console.error("Dark Web: dms listener", err)
    );
  }

  // ---------- @mention pings (server notification badges) ----------
  // Fanned out on write to pings/{recipientUid}/items so a client only ever needs to
  // watch its own subcollection - no cross-server listeners or indexes required.
  function subscribePings() {
    if (unsubPings) unsubPings();
    unsubPings = onSnapshot(
      collection(db, "pings", me.uid, "items"),
      (qs) => {
        pingsByServer = new Map();
        qs.forEach((d) => {
          const p = d.data();
          if (!pingsByServer.has(p.serverId)) pingsByServer.set(p.serverId, []);
          pingsByServer.get(p.serverId).push({ id: d.id, ...p });
        });
        if (!inDm() && currentServer && pingsByServer.has(currentServer.id)) clearServerPings(currentServer.id);
        renderRail();
      },
      (err) => console.error("Dark Web: pings listener", err)
    );
  }

  function clearServerPings(sid) {
    const items = pingsByServer.get(sid);
    if (!items || !items.length) return;
    pingsByServer.delete(sid);
    items.forEach((it) => deleteDoc(doc(db, "pings", me.uid, "items", it.id)).catch(() => {}));
    renderRail();
  }

  function firePings(mentionUids, text) {
    if (!me || inDm() || !currentServer || !currentTextChannel || !mentionUids || !mentionUids.length) return;
    let targets;
    if (mentionUids.includes("everyone")) {
      const pool = currentServer.isHome ? allUsers().map((u) => u.uid) : currentServer.memberIds || [];
      targets = pool.filter((uid) => uid !== me.uid);
    } else {
      targets = Array.from(new Set(mentionUids.filter((uid) => uid !== "everyone" && uid !== me.uid)));
    }
    targets.forEach((uid) => {
      addDoc(collection(db, "pings", uid, "items"), {
        serverId: currentServer.id,
        channelId: currentTextChannel.id,
        channelName: currentTextChannel.name,
        fromUid: me.uid,
        fromName: me.displayName,
        text: (text || "").slice(0, 80),
        createdAt: serverTimestamp(),
      }).catch(() => {});
    });
  }

  function renderDmBadge() {
    const n = dms.filter(dmUnread).length;
    const b = $("#dm-badge");
    b.hidden = n === 0;
    b.textContent = n > 9 ? "9+" : String(n);
  }

  function renderDmList() {
    const list = $("#dm-list");
    if (!list || !me) return;
    list.innerHTML = "";
    if (!dms.length) {
      list.innerHTML = '<div class="empty-hint small">No conversations yet. Click a member, or the + above, to start one.</div>';
      return;
    }
    dms.forEach((dm) => {
      const other = dmOther(dm);
      const prof = profileFor(other, { displayName: "Unknown" });
      const unread = dmUnread(dm);
      const row = document.createElement("div");
      row.className = "member-row dm-row" + (currentDm && currentDm.id === dm.id && inDm() ? " active" : "") + (unread ? " unread" : "");
      row.appendChild(makeAvatar(prof, other, "avatar-32", true));
      const text = document.createElement("div");
      text.className = "member-text";
      const name = document.createElement("div");
      name.className = "member-name";
      name.textContent = prof.displayName || "Unknown";
      text.appendChild(name);
      if (dm.lastText) {
        const st = document.createElement("div");
        st.className = "member-status";
        st.textContent = (dm.lastFrom === me.uid ? "You: " : "") + dm.lastText;
        text.appendChild(st);
      }
      row.appendChild(text);
      if (unread) {
        const dot = document.createElement("span");
        dot.className = "unread-dot";
        row.appendChild(dot);
      }
      row.addEventListener("click", () => openDm(other));
      list.appendChild(row);
    });
  }

  async function openDm(otherUid) {
    if (!me || !otherUid || otherUid === me.uid) return;
    closeModal("new-dm-modal");
    const id = dmIdFor(me.uid, otherUid);
    let dm = dms.find((d) => d.id === id);
    if (!dm) {
      const participants = [me.uid, otherUid].sort();
      try {
        const ref = doc(db, "dms", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) await setDoc(ref, { participants, createdAt: serverTimestamp() });
        dm = { id, participants };
      } catch (e) {
        alert("Couldn't open the conversation: " + e.message);
        return;
      }
    }
    enterDmView(dm);
  }

  function enterDmView(dm) {
    const switching = !inDm() || !currentDm || currentDm.id !== dm.id;
    viewMode = "dm";
    currentDm = dm;
    markDmRead(dm.id);
    closeAllModals();
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    $("#post-back-btn").hidden = true;
    $("#new-post-btn").hidden = true;
    $("#app-screen").classList.add("dm-mode");
    $("#app-screen").classList.remove("sidebar-open");
    renderRail();
    renderDmList();
    renderDmBadge();
    const other = dmOther(dm);
    const prof = profileFor(other, { displayName: "Unknown" });
    const icon = $("#channel-header-icon");
    icon.innerHTML = "";
    icon.appendChild(makeAvatar(prof, other, "avatar-24", false));
    $("#channel-header-name").textContent = prof.displayName || "Unknown";
    $("#composer").hidden = false;
    $("#message-input").placeholder = "Message @" + (prof.displayName || "");
    ensureDmCallListener(dm.id);
    renderDmCallUi();
    if (!switching) {
      renderMessages();
      return;
    }
    messagesFirstRender = true;
    lastMessages = [];
    renderMessages();
    subscribeDmMessages(dm);
  }

  function subscribeDmMessages(dm, attempt = 0) {
    if (unsubDmMessages) unsubDmMessages();
    unsubDmMessages = onSnapshot(
      query(collection(db, "dms", dm.id, "messages"), orderBy("createdAt"), limit(MESSAGE_LIMIT)),
      (qs) => {
        if (!inDm() || !currentDm || currentDm.id !== dm.id) return;
        lastMessages = qs.docs.map((d) => ({ id: d.id, data: d.data() }));
        renderMessages();
        markDmRead(dm.id);
        renderDmList();
        renderDmBadge();
      },
      (err) => retryOnDenied(err, "dm messages", (n) => {
        if (inDm() && currentDm && currentDm.id === dm.id) subscribeDmMessages(dm, n);
      }, attempt, () => {
        if (inDm() && currentDm && currentDm.id === dm.id) showAccessDenied("this conversation", true);
      })
    );
  }

  function enterDmHome() {
    viewMode = "dm";
    currentDm = null;
    if (unsubMessages) unsubMessages();
    unsubMessages = null;
    if (unsubDmMessages) unsubDmMessages();
    unsubDmMessages = null;
    if (!currentVoiceDm) unsubscribeDmCallParticipants();
    $("#app-screen").classList.add("dm-mode");
    $("#app-screen").classList.remove("sidebar-open");
    $("#post-back-btn").hidden = true;
    $("#new-post-btn").hidden = true;
    renderRail();
    renderDmList();
    renderDmCallUi();
    $("#channel-header-icon").innerHTML = ICONS.chat;
    $("#channel-header-name").textContent = "Direct Messages";
    $("#composer").hidden = true;
    const list = $("#message-list");
    list.innerHTML =
      '<div class="empty-hint"><div class="empty-title">Direct Messages</div>' +
      "Pick a conversation on the left, click someone in a member list, or start a new one." +
      '<div class="empty-actions"><button class="btn btn-primary" id="dmhome-new">New message</button></div></div>';
    list.querySelector("#dmhome-new").addEventListener("click", openNewDm);
  }

  // Switches state back to server view; the caller re-renders the channel.
  function leaveDmView() {
    if (!inDm()) return;
    viewMode = "server";
    if (unsubDmMessages) unsubDmMessages();
    unsubDmMessages = null;
    if (!currentVoiceDm) unsubscribeDmCallParticipants();
    lastMessages = [];
    $("#app-screen").classList.remove("dm-mode");
    $("#channel-header-icon").innerHTML = ICONS.hash;
    renderRail();
    renderDmList();
    renderDmCallUi();
  }

  $("#dm-rail-btn").addEventListener("click", () => {
    if (inDm()) return;
    if (currentDm) enterDmView(currentDm);
    else if (dms.length) enterDmView(dms[0]);
    else enterDmHome();
  });

  function openNewDm() {
    $("#new-dm-search").value = "";
    renderNewDmList("");
    openModal("new-dm-modal");
    $("#new-dm-search").focus();
  }
  function renderNewDmList(q) {
    const list = $("#new-dm-list");
    list.innerHTML = "";
    const people = allUsers()
      .filter((u) => u.uid !== me.uid && u.displayName && !u.banned && u.displayName.toLowerCase().includes(q))
      .sort((a, b) => (isOnline(a) ? 0 : 1) - (isOnline(b) ? 0 : 1) || a.displayName.localeCompare(b.displayName));
    if (!people.length) {
      list.innerHTML = '<div class="empty-hint small">Nobody found.</div>';
      return;
    }
    people.forEach((u) => {
      const row = document.createElement("div");
      row.className = "member-row clickable";
      row.appendChild(makeAvatar(u, u.uid, "avatar-32", true));
      const text = document.createElement("div");
      text.className = "member-text";
      const name = document.createElement("div");
      name.className = "member-name";
      name.textContent = u.displayName;
      text.appendChild(name);
      row.appendChild(text);
      row.addEventListener("click", () => openDm(u.uid));
      list.appendChild(row);
    });
  }
  $("#new-dm-btn").addEventListener("click", openNewDm);
  $("#new-dm-close").addEventListener("click", () => closeModal("new-dm-modal"));
  $("#new-dm-search").addEventListener("input", () => renderNewDmList($("#new-dm-search").value.trim().toLowerCase()));

  function noteDmActivity(summary) {
    if (!inDm() || !currentDm) return;
    updateDoc(doc(db, "dms", currentDm.id), {
      lastMessageAt: serverTimestamp(),
      lastText: summary.slice(0, 80),
      lastFrom: me.uid,
    }).catch(() => {});
  }

  // ---------- voice ----------
  const speakingNow = new Set();
  const stageStreams = new Map();
  let stageVisible = true;
  let cameraOn = false;
  let screenOn = false;

  // Shared setup used by both server voice channels and DM calls.
  async function resetVoiceState() {
    if (currentVoice) await currentVoice.leave();
    remoteAudioEls.forEach((el) => el.remove());
    remoteAudioEls.clear();
    peerStates.clear();
    speakingNow.clear();
    stageStreams.clear();
    cameraOn = screenOn = false;
    $("#audio-unlock-btn").hidden = true;
  }
  function makeVoiceCallbacks() {
    return {
      onRemoteStream: (uid, stream, kind) => {
        if (!stream) {
          attachRemoteAudio(uid, null);
          Array.from(stageStreams.keys()).forEach((k) => {
            if (k.startsWith(uid + ":")) stageStreams.delete(k);
          });
          speakingNow.delete(uid);
          renderStage();
          return;
        }
        if (kind === "audio") {
          attachRemoteAudio(uid, stream);
          return;
        }
        stageStreams.set(uid + ":" + stream.id, { uid, stream, kind });
        renderStage();
      },
      onStreamRemoved: (uid, streamId) => {
        stageStreams.delete(uid + ":" + streamId);
        renderStage();
      },
      onSpeaking: (uid, speaking) => {
        if (speaking) speakingNow.add(uid);
        else speakingNow.delete(uid);
        $$(".voice-member[data-uid='" + uid + "'], .stage-tile[data-uid='" + uid + "']").forEach((el) =>
          el.classList.toggle("speaking", speaking)
        );
        if (uid === me.uid) $("#user-panel-avatar").classList.toggle("speaking", speaking);
      },
      onPeerState: (uid, state) => {
        if (state === "closed") peerStates.delete(uid);
        else peerStates.set(uid, state);
        renderVoicePeers();
      },
      onError: (msg) => alert(msg),
    };
  }

  async function joinVoiceChannel(ch) {
    if (!me || !currentServer) return;
    const sid = currentServer.id;
    if (currentVoiceServer === sid && currentVoiceChannel === ch.id) {
      stageVisible = true;
      renderStage();
      return;
    }
    await resetVoiceState();
    currentVoice = new VoiceManager(db, me.uid, { displayName: me.displayName, avatarEmoji: me.avatarEmoji }, makeVoiceCallbacks());
    const ok = await currentVoice.join(["servers", sid, "voiceChannels", ch.id]);
    if (!ok) {
      currentVoice = null;
      return;
    }
    currentVoice.setMuted(muted);
    currentVoiceChannel = ch.id;
    currentVoiceServer = sid;
    currentVoiceDm = null;
    stageVisible = true;
    $("#voice-panel").hidden = false;
    $("#voice-panel-channel").textContent = ch.name + " / " + currentServer.name;
    updateVoiceActionButtons();
    renderVoicePeers();
    renderChannels();
    renderUserPanel();
    renderStage();
  }

  async function startDmCall(dm) {
    if (!me) return;
    if (currentVoiceDm === dm.id) {
      stageVisible = true;
      renderStage();
      return;
    }
    declinedDmCall = null;
    await resetVoiceState();
    currentVoice = new VoiceManager(db, me.uid, { displayName: me.displayName, avatarEmoji: me.avatarEmoji }, makeVoiceCallbacks());
    const ok = await currentVoice.join(["dms", dm.id, "call", "current"]);
    if (!ok) {
      currentVoice = null;
      return;
    }
    currentVoice.setMuted(muted);
    currentVoiceDm = dm.id;
    currentVoiceChannel = null;
    currentVoiceServer = null;
    stageVisible = true;
    ensureDmCallListener(dm.id);
    const other = profileFor(dmOther(dm), { displayName: "Unknown" });
    $("#voice-panel").hidden = false;
    $("#voice-panel-channel").textContent = "Call with " + (other.displayName || "Unknown");
    updateVoiceActionButtons();
    renderVoicePeers();
    renderDmCallUi();
    renderUserPanel();
    renderStage();
    noteDmCallActivity(dm);
  }

  function activeCallParticipants() {
    if (currentVoiceDm) return dmCallParticipants;
    if (currentVoiceChannel) return voiceParticipants.get(currentVoiceChannel) || [];
    return [];
  }

  function renderStage() {
    const stage = $("#call-stage");
    const activeServer = !!currentVoiceChannel && !inDm() && currentServer && currentServer.id === currentVoiceServer;
    const activeDm = !!currentVoiceDm && inDm() && currentDm && currentDm.id === currentVoiceDm;
    const show = (activeServer || activeDm) && stageVisible;
    stage.hidden = !show;
    if (!show) {
      stage.innerHTML = "";
      return;
    }
    stage.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "stage-grid";
    const cameras = new Map();
    const screens = [];
    stageStreams.forEach((s) => {
      if (s.kind === "screen") screens.push(s);
      else cameras.set(s.uid, s);
    });
    if (currentVoice && currentVoice.cameraStream) cameras.set(me.uid, { uid: me.uid, stream: currentVoice.cameraStream, kind: "camera", local: true });
    if (currentVoice && currentVoice.screenStream) screens.unshift({ uid: me.uid, stream: currentVoice.screenStream, kind: "screen", local: true });

    const parts = voiceChannelParticipants();
    if (!parts.some((p) => p.uid === me.uid)) parts.push({ uid: me.uid, displayName: me.displayName, avatarEmoji: me.avatarEmoji });
    parts.forEach((p) => {
      const prof = profileFor(p.uid, p);
      const tile = document.createElement("div");
      tile.className = "stage-tile" + (speakingNow.has(p.uid) ? " speaking" : "");
      tile.dataset.uid = p.uid;
      const cam = cameras.get(p.uid);
      if (cam) {
        const v = document.createElement("video");
        v.autoplay = true;
        v.playsInline = true;
        v.muted = true;
        v.srcObject = cam.stream;
        if (cam.local) v.classList.add("mirror");
        tile.appendChild(v);
      } else {
        const av = makeAvatar(prof, p.uid, "avatar-80", false);
        tile.appendChild(av);
      }
      const label = document.createElement("div");
      label.className = "stage-label";
      label.textContent = (prof.displayName || p.displayName || "Member") + (p.uid === me.uid ? " (you)" : "");
      tile.appendChild(label);
      grid.appendChild(tile);
    });
    screens.forEach((s) => {
      const prof = profileFor(s.uid, { displayName: "Member" });
      const tile = document.createElement("div");
      tile.className = "stage-tile screen-tile";
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.srcObject = s.stream;
      tile.appendChild(v);
      const label = document.createElement("div");
      label.className = "stage-label";
      label.textContent = (s.local ? "Your" : (prof.displayName || "Member") + "'s") + " screen";
      tile.appendChild(label);
      tile.addEventListener("dblclick", () => {
        if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
      });
      grid.appendChild(tile);
    });
    stage.appendChild(grid);
  }

  function updateVoiceActionButtons() {
    const cam = $("#camera-btn");
    cam.innerHTML = (cameraOn ? ICONS.cameraOff : ICONS.camera) + "<span>Camera</span>";
    cam.classList.toggle("on", cameraOn);
    cam.title = cameraOn ? "Turn off camera" : "Turn on camera";
    const scr = $("#screen-btn");
    scr.classList.toggle("on", screenOn);
    scr.title = screenOn ? "Stop sharing" : "Share your screen";
    scr.innerHTML = ICONS.screen + "<span>" + (screenOn ? "Stop" : "Share") + "</span>";
    $("#stage-toggle-btn").classList.toggle("on", stageVisible);
  }
  $("#camera-btn").addEventListener("click", async () => {
    if (!currentVoice) return;
    if (cameraOn) {
      currentVoice.stopCamera();
      cameraOn = false;
    } else {
      cameraOn = await currentVoice.startCamera();
    }
    updateVoiceActionButtons();
    renderStage();
  });
  $("#screen-btn").addEventListener("click", async () => {
    if (!currentVoice) return;
    if (screenOn) {
      currentVoice.stopScreen();
      screenOn = false;
    } else {
      screenOn = await currentVoice.startScreen();
    }
    updateVoiceActionButtons();
    renderStage();
  });
  $("#stage-toggle-btn").addEventListener("click", () => {
    stageVisible = !stageVisible;
    updateVoiceActionButtons();
    renderStage();
  });

  const peerStates = new Map();
  function renderVoicePeers() {
    const box = $("#voice-peers");
    box.innerHTML = "";
    if (!currentVoiceChannel && !currentVoiceDm) return;
    if (!peerStates.size) {
      box.innerHTML = '<div class="voice-peer muted-text">Waiting for others to join…</div>';
      return;
    }
    const labels = {
      new: "connecting…",
      connecting: "connecting…",
      connected: "connected",
      disconnected: "reconnecting…",
      failed: "failed — retrying",
    };
    peerStates.forEach((state, uid) => {
      const row = document.createElement("div");
      row.className = "voice-peer state-" + state;
      const name = document.createElement("span");
      name.textContent = (profileFor(uid).displayName || "Member");
      const st = document.createElement("span");
      st.className = "voice-peer-state";
      st.textContent = labels[state] || state;
      row.appendChild(name);
      row.appendChild(st);
      box.appendChild(row);
    });
  }

  $("#leave-voice-btn").addEventListener("click", leaveVoice);
  $("#audio-unlock-btn").addEventListener("click", () => {
    remoteAudioEls.forEach((el) => el.play().catch(() => {}));
    $("#audio-unlock-btn").hidden = true;
  });

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
      el.setAttribute("playsinline", "");
      shadow.appendChild(el);
      remoteAudioEls.set(uid, el);
    }
    el.srcObject = stream;
    // Mobile browsers may refuse autoplay of remote audio; offer a tap-to-enable fallback.
    const p = el.play();
    if (p && p.catch) p.catch(() => { $("#audio-unlock-btn").hidden = false; });
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
    $("#profile-bio").value = me.bio || "";
    $("#profile-games").value = (me.games || []).join(", ");
    const hasEmail = me.email && !isSyntheticEmail(me.email);
    $("#account-email").value = hasEmail ? me.email : "No email on this account";
    $("#account-email-hint").textContent = hasEmail
      ? "Used to log in and to reset your password."
      : "You log in with your username. Without an email, a forgotten password can't be reset.";
    $("#email-change-title").textContent = hasEmail ? "Change email" : "Add an email";
    ["#pw-current", "#pw-new", "#pw-confirm", "#email-new", "#email-pw"].forEach((s) => ($(s).value = ""));
    setMsg("#profile-msg", "");
    setMsg("#pw-msg", "");
    setMsg("#email-msg", "");
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
    const bio = $("#profile-bio").value.trim().slice(0, 190);
    const games = $("#profile-games").value.split(",").map((g) => g.trim()).filter(Boolean).slice(0, 10);
    const update = { displayName, status, bio, games, avatarEmoji: selectedAvatarEmoji };
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

  $("#email-save-btn").addEventListener("click", async () => {
    const next = $("#email-new").value.trim();
    const pw = $("#email-pw").value;
    setMsg("#email-msg", "");
    if (!next || !next.includes("@")) {
      setMsg("#email-msg", "Enter a valid email address.", "error");
      return;
    }
    if (!pw) {
      setMsg("#email-msg", "Enter your current password to confirm.", "error");
      return;
    }
    const user = auth.currentUser;
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
      await verifyBeforeUpdateEmail(user, next);
      $("#email-new").value = "";
      $("#email-pw").value = "";
      setMsg("#email-msg", "Confirmation sent to " + next + ". Click the link in it, then log in with that email.", "ok");
    } catch (e) {
      setMsg("#email-msg", friendlyAuthError(e), "error");
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

  // ---------- profile card ----------
  function openProfile(uid) {
    const u = usersCache.get(uid);
    if (!u) return;
    closeAllModals();
    const av = $("#profile-card-avatar");
    av.innerHTML = "";
    av.appendChild(makeAvatar(u, uid, "avatar-80", true));
    const name = $("#profile-card-name");
    name.textContent = u.displayName || "Unknown";
    name.style.color = "";
    const roleChips = $("#profile-card-roles");
    roleChips.innerHTML = "";
    if (!inDm() && currentServer) {
      const top = topRole(currentServer, uid);
      if (top && top.color) name.style.color = top.color;
      if (uid === currentServer.ownerUid) name.appendChild(badgeIcon(ICONS.crown, "crown", "Server owner"));
      const ids = memberRoleIds(currentServer, uid);
      serverRoles(currentServer)
        .filter((r) => ids.includes(r.id))
        .forEach((r) => {
          const chip = document.createElement("span");
          chip.className = "role-chip on static";
          chip.style.setProperty("--chip", r.color || "#5865f2");
          chip.textContent = r.name;
          roleChips.appendChild(chip);
        });
    }
    if (u.role === "admin") name.appendChild(badgeIcon(ICONS.shield, "badge-admin", "Site admin"));
    $("#profile-card-status").textContent = u.status || (isOnline(u) ? "Online" : "Offline");
    $("#profile-card-bio").textContent = u.bio || "";
    $("#profile-card-bio-wrap").hidden = !u.bio;
    const games = $("#profile-card-games");
    games.innerHTML = "";
    (Array.isArray(u.games) ? u.games : []).forEach((g) => {
      const tag = document.createElement("span");
      tag.className = "game-tag";
      tag.innerHTML = ICONS.gamepad + "<span></span>";
      tag.querySelector("span").textContent = g;
      games.appendChild(tag);
    });
    $("#profile-card-games-wrap").hidden = !games.children.length;
    const isSelf = uid === me.uid;
    $("#profile-card-dm").hidden = isSelf;
    $("#profile-card-edit").hidden = !isSelf;
    $("#profile-card-dm").onclick = () => openDm(uid);
    openModal("profile-card-modal");
  }
  $("#profile-card-close").addEventListener("click", () => closeModal("profile-card-modal"));
  $("#profile-card-edit").addEventListener("click", () => {
    closeModal("profile-card-modal");
    $("#settings-btn").click();
  });

  // ---------- categories (server settings) ----------
  async function saveCategories(categories) {
    await updateDoc(doc(db, "servers", currentServer.id), { categories });
  }
  function renderCategoryManager() {
    const box = $("#category-manager");
    if (!box || !currentServer) return;
    box.hidden = !canManage(currentServer);
    const list = $("#category-list");
    list.innerHTML = "";
    const cats = serverCategories(currentServer);
    if (!cats.length) list.innerHTML = '<div class="empty-hint small">No categories yet. Channels without one are grouped by type.</div>';
    cats.forEach((cat, idx) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      label.textContent = cat.name;
      const actions = document.createElement("span");
      const mk = (text, cls, fn, disabled) => {
        const b = document.createElement("button");
        b.className = "btn btn-sm " + cls;
        b.textContent = text;
        b.disabled = !!disabled;
        b.addEventListener("click", fn);
        return b;
      };
      actions.appendChild(mk("↑", "btn-secondary", () => moveCategory(idx, -1), idx === 0));
      actions.appendChild(mk("↓", "btn-secondary", () => moveCategory(idx, 1), idx === cats.length - 1));
      actions.appendChild(mk("Rename", "btn-secondary", async () => {
        const name = prompt("Category name", cat.name);
        if (name && name.trim()) await saveCategories(cats.map((c) => (c.id === cat.id ? { ...c, name: name.trim() } : c)));
      }));
      actions.appendChild(mk("Delete", "btn-danger", async () => {
        if (confirm('Delete category "' + cat.name + '"? Its channels stay and regroup by type.')) {
          await saveCategories(cats.filter((c) => c.id !== cat.id));
        }
      }));
      row.appendChild(label);
      row.appendChild(actions);
      list.appendChild(row);
    });
    const sel = $("#new-channel-cat");
    sel.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = cats.length ? "Category: by type" : "No category";
    sel.appendChild(none);
    cats.forEach((cat) => {
      const o = document.createElement("option");
      o.value = cat.id;
      o.textContent = cat.name;
      sel.appendChild(o);
    });
  }
  async function moveCategory(idx, dir) {
    const cats = serverCategories(currentServer).slice();
    const j = idx + dir;
    if (j < 0 || j >= cats.length) return;
    [cats[idx], cats[j]] = [cats[j], cats[idx]];
    await saveCategories(cats);
  }
  $("#new-category-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentServer) return;
    const name = $("#new-category-name").value.trim();
    if (!name) return;
    try {
      await saveCategories(serverCategories(currentServer).concat([{ id: genCode(), name }]));
      $("#new-category-name").value = "";
    } catch (err) {
      setMsg("#server-settings-msg", err.message, "error");
    }
  });

  // ---------- channel admin (server settings) ----------
  function renderAdminChannelList() {
    const list = $("#admin-channel-list");
    list.innerHTML = "";
    if (!currentServer) return;
    renderCategoryManager();
    if (!channelsCache.length) {
      list.innerHTML = '<div class="empty-hint small">No channels yet. Create one above.</div>';
      return;
    }
    const cats = serverCategories(currentServer);
    channelsCache.forEach((c) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      const label = document.createElement("span");
      label.className = "admin-label";
      const icon = c.type === "text" ? ICONS.hash : c.type === "forum" ? ICONS.forum : ICONS.speaker;
      label.innerHTML = '<span class="ch-icon">' + icon + "</span><span></span>";
      label.querySelector("span:last-child").textContent = c.name;
      const actions = document.createElement("span");
      if (cats.length) {
        const sel = document.createElement("select");
        sel.className = "cat-select";
        sel.title = "Category";
        const none = document.createElement("option");
        none.value = "";
        none.textContent = "By type";
        sel.appendChild(none);
        cats.forEach((cat) => {
          const o = document.createElement("option");
          o.value = cat.id;
          o.textContent = cat.name;
          sel.appendChild(o);
        });
        sel.value = c.categoryId && cats.some((x) => x.id === c.categoryId) ? c.categoryId : "";
        sel.addEventListener("change", () =>
          updateDoc(doc(channelsCol(), c.id), { categoryId: sel.value || deleteField() }).catch((err) => alert(err.message))
        );
        actions.appendChild(sel);
      }
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
    const categoryId = $("#new-channel-cat").value;
    if (!name) return;
    try {
      const data = { name, type, createdAt: serverTimestamp() };
      if (categoryId) data.categoryId = categoryId;
      await addDoc(channelsCol(), data);
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
    const all = allServers();
    if (!all.length) {
      list.innerHTML = '<div class="empty-hint small">No servers exist yet.</div>';
      return;
    }
    all.forEach((s) => {
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
      const count = s.isHome ? allUsers().filter((u) => !u.banned).length : (s.memberIds || []).length;
      text.querySelector("small").textContent =
        (s.isHome ? "Home server · everyone · " : "") +
        count + " member" + (count === 1 ? "" : "s") +
        " · owner: " + (owner ? owner.displayName : "unknown") +
        (s.isHome ? "" : " · code " + s.id);
      label.appendChild(text);
      const actions = document.createElement("span");
      const open = document.createElement("button");
      open.className = "btn btn-secondary btn-sm";
      open.textContent = "Open";
      open.addEventListener("click", () => {
        closeModal("admin-modal");
        selectServer(s);
      });
      actions.appendChild(open);
      if (!s.isHome) {
        const del = document.createElement("button");
        del.className = "btn btn-danger btn-sm";
        del.textContent = "Delete";
        del.addEventListener("click", async () => {
          if (confirm('Delete "' + s.name + '" for everyone?')) {
            if (currentVoiceServer === s.id) await leaveVoice();
            await deleteDoc(doc(db, "servers", s.id));
          }
        });
        actions.appendChild(del);
      }
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
      if (u.deleted) {
        const b = document.createElement("span");
        b.className = "role-badge banned";
        b.textContent = "DELETED";
        label.appendChild(b);
      } else if (u.banned) {
        const b = document.createElement("span");
        b.className = "role-badge banned";
        b.textContent = "BANNED";
        label.appendChild(b);
      }
      const actions = document.createElement("span");
      row.appendChild(label);
      row.appendChild(actions);
      list.appendChild(row);
      if (u.deleted) return;
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
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "Delete";
      delBtn.disabled = isSelf;
      delBtn.addEventListener("click", () => deleteAccount(u));
      actions.appendChild(roleBtn);
      actions.appendChild(banBtn);
      actions.appendChild(delBtn);
    });
  }

  // Wipes the profile, locks the account out for good, and drops it from every server.
  // The Firebase Auth login itself can only be removed server-side (Firebase console).
  async function deleteAccount(u) {
    if (!confirm('Delete "' + u.displayName + '"? Their profile is erased, they are locked out, and their messages will show as "Deleted User". This cannot be undone.')) return;
    try {
      await updateDoc(doc(db, "users", u.uid), {
        displayName: "Deleted User",
        status: "",
        avatarEmoji: DEFAULT_EMOJI,
        avatarUrl: deleteField(),
        role: "member",
        banned: true,
        deleted: true,
      });
      const ownedOrJoined = servers.filter((s) => (s.memberIds || []).includes(u.uid));
      await Promise.all(ownedOrJoined.map((s) => updateDoc(doc(db, "servers", s.id), { memberIds: arrayRemove(u.uid) })));
    } catch (e) {
      alert("Couldn't delete account: " + e.message);
    }
  }

  updateMuteButton();
  setAuthMode("login");
})();
