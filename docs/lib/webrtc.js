import {
  collection, doc, setDoc, deleteDoc, addDoc, onSnapshot, query, where, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// STUN finds a direct path; the TURN relay is the fallback for networks that block
// device-to-device traffic (common on school / guest Wi-Fi with client isolation).
const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
const MAX_PARTICIPANTS = 6;
const SPEAK_THRESHOLD = 0.03;

// Mesh WebRTC voice/video channel signaled through Firestore documents. Each peer pair uses the
// "perfect negotiation" pattern (the peer with the larger uid is polite) so either side can add
// or remove camera / screen tracks at any time without the offers colliding.
// `join()` takes the Firestore path segments of the voice channel document, e.g.
// ["servers", serverId, "voiceChannels", channelId].
export class VoiceManager {
  constructor(db, uid, profile, cb = {}) {
    this.db = db;
    this.uid = uid;
    this.displayName = profile.displayName;
    this.avatarEmoji = profile.avatarEmoji;
    const noop = () => {};
    this.onParticipantsChange = cb.onParticipantsChange || noop;
    this.onRemoteStream = cb.onRemoteStream || noop; // (uid, stream|null, kind: audio|camera|screen)
    this.onStreamRemoved = cb.onStreamRemoved || noop; // (uid, streamId)
    this.onSpeaking = cb.onSpeaking || noop; // (uid, speaking)
    this.onPeerState = cb.onPeerState || noop;
    this.onError = cb.onError || noop;
    this.base = null;
    this.localStream = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.peers = new Map();
    this.pendingCandidates = new Map();
    this.remoteKinds = new Map();
    this.meters = new Map();
    this.audioCtx = null;
    this.signalQueue = Promise.resolve();
    this.unsubParticipants = null;
    this.unsubSignals = null;
  }

  _participants() {
    return collection(this.db, ...this.base, "participants");
  }
  _signals() {
    return collection(this.db, ...this.base, "signals");
  }
  _localStreams() {
    return [this.localStream, this.cameraStream, this.screenStream].filter(Boolean);
  }

  async join(pathSegments) {
    if (this.base) await this.leave();
    this.base = pathSegments;

    const existing = await getDocs(this._participants());
    if (existing.size >= MAX_PARTICIPANTS) {
      this.base = null;
      this.onError("Voice channel is full (max " + MAX_PARTICIPANTS + ").");
      return false;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      this.base = null;
      this.onError(
        e && e.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the mic for this site and try again."
          : "Couldn't open the microphone (" + (e && e.message ? e.message : "unknown error") + ")."
      );
      return false;
    }
    this._watch(this.uid, this.localStream);

    await setDoc(doc(this.db, ...this.base, "participants", this.uid), {
      displayName: this.displayName,
      avatarEmoji: this.avatarEmoji,
      joinedAt: serverTimestamp(),
    });

    this.unsubParticipants = onSnapshot(this._participants(), (qs) => {
      const others = qs.docs.filter((d) => d.id !== this.uid).map((d) => d.id);
      this.onParticipantsChange(qs.docs.map((d) => ({ uid: d.id, ...d.data() })));
      others.forEach((otherUid) => {
        // The smaller uid opens the connection; the other side answers.
        if (!this.peers.has(otherUid) && this.uid < otherUid) this._createPeer(otherUid);
      });
      for (const existingUid of Array.from(this.peers.keys())) {
        if (!others.includes(existingUid)) this._closePeer(existingUid);
      }
    });

    // Signals must be applied in order (offer before its candidates), so they're chained.
    const myIncoming = query(this._signals(), where("to", "==", this.uid));
    this.unsubSignals = onSnapshot(myIncoming, (qs) => {
      qs.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const data = change.doc.data();
        this.signalQueue = this.signalQueue
          .then(() => this._handleSignal(data))
          .catch((e) => console.warn("Dark Web voice: signal error", e))
          .finally(() => deleteDoc(change.doc.ref).catch(() => {}));
      });
    });

    return true;
  }

  async _send(to, type, payload) {
    if (!this.base) return;
    await addDoc(this._signals(), {
      from: this.uid,
      to,
      type,
      payload: JSON.stringify(payload),
      createdAt: serverTimestamp(),
    });
  }

  _createPeer(otherUid) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, makingOffer: false, ignoreOffer: false, polite: this.uid > otherUid };
    this.peers.set(otherUid, peer);

    // Tell the other side what our extra streams are before their tracks arrive.
    if (this.cameraStream) this._send(otherUid, "meta", { streamId: this.cameraStream.id, kind: "camera" }).catch(() => {});
    if (this.screenStream) this._send(otherUid, "meta", { streamId: this.screenStream.id, kind: "screen" }).catch(() => {});
    this._localStreams().forEach((st) => st.getTracks().forEach((t) => pc.addTrack(t, st)));

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        await this._send(otherUid, "offer", pc.localDescription);
      } catch (e) {
        console.warn("Dark Web voice: negotiation failed", e);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && this.base) this._send(otherUid, "candidate", e.candidate).catch(() => {});
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      const kind = e.track.kind === "audio" ? "audio" : this._kindFor(otherUid, stream.id);
      this.onRemoteStream(otherUid, stream, kind);
      if (e.track.kind === "audio") this._watch(otherUid, stream);
      const gone = () => {
        if (!stream.getTracks().some((t) => t.readyState === "live")) this.onStreamRemoved(otherUid, stream.id);
      };
      e.track.onended = gone;
      stream.onremovetrack = gone;
    };
    pc.onconnectionstatechange = () => {
      this.onPeerState(otherUid, pc.connectionState);
      if (pc.connectionState === "failed") pc.restartIce();
    };
    this.onPeerState(otherUid, "connecting");
    return peer;
  }

  _kindFor(uid, streamId) {
    const kinds = this.remoteKinds.get(uid);
    return (kinds && kinds.get(streamId)) || "camera";
  }

  async _flushCandidates(uid, pc) {
    const queued = this.pendingCandidates.get(uid) || [];
    this.pendingCandidates.delete(uid);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {
        // stale candidate from an earlier negotiation; ignore
      }
    }
  }

  async _handleSignal(data) {
    if (!this.base) return;
    const { from, type } = data;
    const payload = JSON.parse(data.payload);
    if (type === "meta") {
      if (!this.remoteKinds.has(from)) this.remoteKinds.set(from, new Map());
      if (payload.kind === "stop") {
        this.remoteKinds.get(from).delete(payload.streamId);
        this.onStreamRemoved(from, payload.streamId);
      } else {
        this.remoteKinds.get(from).set(payload.streamId, payload.kind);
      }
      return;
    }
    const peer = this.peers.get(from) || this._createPeer(from);
    const pc = peer.pc;
    if (type === "offer") {
      const collision = peer.makingOffer || pc.signalingState !== "stable";
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;
      await pc.setRemoteDescription(payload);
      await this._flushCandidates(from, pc);
      await pc.setLocalDescription(await pc.createAnswer());
      await this._send(from, "answer", pc.localDescription);
    } else if (type === "answer") {
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(payload);
        await this._flushCandidates(from, pc);
      }
    } else if (type === "candidate") {
      if (!pc.remoteDescription) {
        if (!this.pendingCandidates.has(from)) this.pendingCandidates.set(from, []);
        this.pendingCandidates.get(from).push(payload);
        return;
      }
      try {
        await pc.addIceCandidate(payload);
      } catch (e) {
        if (!peer.ignoreOffer) console.warn("Dark Web voice: bad candidate", e);
      }
    }
  }

  // ---- camera / screen ----
  async startCamera() {
    if (!this.base || this.cameraStream) return !!this.cameraStream;
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 }, facingMode: "user" },
      });
    } catch (e) {
      this.onError(e && e.name === "NotAllowedError" ? "Camera access was blocked." : "Couldn't start the camera.");
      return false;
    }
    this._addLocalStream(this.cameraStream, "camera");
    return true;
  }
  stopCamera() {
    if (!this.cameraStream) return;
    this._removeLocalStream(this.cameraStream, "camera");
    this.cameraStream = null;
  }
  async startScreen() {
    if (!this.base || this.screenStream) return !!this.screenStream;
    if (!navigator.mediaDevices.getDisplayMedia) {
      this.onError("Screen sharing isn't supported in this browser.");
      return false;
    }
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
    } catch (e) {
      if (!(e && e.name === "NotAllowedError")) this.onError("Couldn't share the screen.");
      return false;
    }
    const track = this.screenStream.getVideoTracks()[0];
    if (track) track.onended = () => this.stopScreen();
    this._addLocalStream(this.screenStream, "screen");
    return true;
  }
  stopScreen() {
    if (!this.screenStream) return;
    const st = this.screenStream;
    this.screenStream = null;
    this._removeLocalStream(st, "screen");
    this.onStreamRemoved(this.uid, st.id);
  }
  _addLocalStream(stream, kind) {
    this.peers.forEach((peer, uid) => {
      this._send(uid, "meta", { streamId: stream.id, kind }).catch(() => {});
      stream.getTracks().forEach((t) => peer.pc.addTrack(t, stream));
    });
  }
  _removeLocalStream(stream, kind) {
    const tracks = stream.getTracks();
    this.peers.forEach((peer, uid) => {
      peer.pc.getSenders().forEach((s) => {
        if (s.track && tracks.includes(s.track)) {
          try {
            peer.pc.removeTrack(s);
          } catch (e) {
            // connection may already be closed
          }
        }
      });
      this._send(uid, "meta", { streamId: stream.id, kind: "stop" }).catch(() => {});
    });
    tracks.forEach((t) => t.stop());
  }

  // ---- speaking detection ----
  _ctx() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.audioCtx = new AC();
    }
    if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
    return this.audioCtx;
  }
  _watch(key, stream) {
    if (!stream.getAudioTracks().length) return;
    const ctx = this._ctx();
    if (!ctx) return;
    this._unwatch(key);
    try {
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const meter = { src, analyser, speaking: false, timer: null };
      meter.timer = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const speaking = Math.sqrt(sum / data.length) > SPEAK_THRESHOLD;
        if (speaking !== meter.speaking) {
          meter.speaking = speaking;
          this.onSpeaking(key, speaking);
        }
      }, 120);
      this.meters.set(key, meter);
    } catch (e) {
      // analyser unavailable; speaking indicator just stays off
    }
  }
  _unwatch(key) {
    const m = this.meters.get(key);
    if (!m) return;
    clearInterval(m.timer);
    try {
      m.src.disconnect();
    } catch (e) {
      // already disconnected
    }
    this.meters.delete(key);
    if (m.speaking) this.onSpeaking(key, false);
  }

  _closePeer(uid) {
    const peer = this.peers.get(uid);
    if (peer) {
      peer.pc.onconnectionstatechange = null;
      peer.pc.onnegotiationneeded = null;
      peer.pc.close();
      this.peers.delete(uid);
    }
    this.pendingCandidates.delete(uid);
    this.remoteKinds.delete(uid);
    this._unwatch(uid);
    this.onRemoteStream(uid, null, "audio");
    this.onPeerState(uid, "closed");
  }

  setMuted(muted) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  async leave() {
    if (!this.base) return;
    const base = this.base;
    this.base = null;
    if (this.unsubParticipants) this.unsubParticipants();
    if (this.unsubSignals) this.unsubSignals();
    this.unsubParticipants = this.unsubSignals = null;
    for (const uid of Array.from(this.peers.keys())) this._closePeer(uid);
    for (const key of Array.from(this.meters.keys())) this._unwatch(key);
    [this.localStream, this.cameraStream, this.screenStream].forEach((st) => {
      if (st) st.getTracks().forEach((t) => t.stop());
    });
    this.localStream = this.cameraStream = this.screenStream = null;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    try {
      await deleteDoc(doc(this.db, ...base, "participants", this.uid));
    } catch (e) {
      // channel may already be gone
    }
  }
}
