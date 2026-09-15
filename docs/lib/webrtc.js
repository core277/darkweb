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

// Mesh WebRTC voice channel, signaled through Firestore documents (offer/answer/ICE
// candidates) instead of a dedicated signaling server. The peer with the lexicographically
// smaller uid always initiates the connection to a given peer, so each pair only opens once.
// `join()` takes the Firestore path segments of the voice channel document, e.g.
// ["servers", serverId, "voiceChannels", channelId].
export class VoiceManager {
  constructor(db, uid, profile, { onParticipantsChange, onRemoteStream, onPeerState, onError } = {}) {
    this.db = db;
    this.uid = uid;
    this.displayName = profile.displayName;
    this.avatarEmoji = profile.avatarEmoji;
    this.onParticipantsChange = onParticipantsChange || (() => {});
    this.onRemoteStream = onRemoteStream || (() => {});
    this.onPeerState = onPeerState || (() => {});
    this.onError = onError || (() => {});
    this.base = null;
    this.localStream = null;
    this.peers = new Map();
    this.pendingCandidates = new Map();
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

    await setDoc(doc(this.db, ...this.base, "participants", this.uid), {
      displayName: this.displayName,
      avatarEmoji: this.avatarEmoji,
      joinedAt: serverTimestamp(),
    });

    this.unsubParticipants = onSnapshot(this._participants(), (qs) => {
      const others = qs.docs.filter((d) => d.id !== this.uid).map((d) => d.id);
      this.onParticipantsChange(qs.docs.map((d) => ({ uid: d.id, ...d.data() })));
      others.forEach((otherUid) => {
        if (!this.peers.has(otherUid) && this.uid < otherUid) this._connectTo(otherUid);
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

  async _connectTo(otherUid) {
    const pc = this._createPeerConnection(otherUid);
    this.peers.set(otherUid, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this._send(otherUid, "offer", offer);
  }

  _createPeerConnection(otherUid) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate) this._send(otherUid, "candidate", e.candidate).catch(() => {});
    };
    pc.ontrack = (e) => this.onRemoteStream(otherUid, e.streams[0]);
    pc.onconnectionstatechange = () => {
      this.onPeerState(otherUid, pc.connectionState);
      if (pc.connectionState === "failed" && this.uid < otherUid) {
        // Initiator retries with a fresh ICE gathering round.
        pc.restartIce();
        pc.createOffer({ iceRestart: true })
          .then((offer) => pc.setLocalDescription(offer).then(() => this._send(otherUid, "offer", offer)))
          .catch(() => {});
      }
    };
    this.onPeerState(otherUid, "connecting");
    return pc;
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
    let pc = this.peers.get(from);
    if (!pc) {
      pc = this._createPeerConnection(from);
      this.peers.set(from, pc);
    }
    if (type === "offer") {
      await pc.setRemoteDescription(payload);
      await this._flushCandidates(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this._send(from, "answer", answer);
    } else if (type === "answer") {
      await pc.setRemoteDescription(payload);
      await this._flushCandidates(from, pc);
    } else if (type === "candidate") {
      if (!pc.remoteDescription) {
        if (!this.pendingCandidates.has(from)) this.pendingCandidates.set(from, []);
        this.pendingCandidates.get(from).push(payload);
        return;
      }
      try {
        await pc.addIceCandidate(payload);
      } catch (e) {
        // ignore candidates that no longer apply
      }
    }
  }

  _closePeer(uid) {
    const pc = this.peers.get(uid);
    if (pc) {
      pc.onconnectionstatechange = null;
      pc.close();
      this.peers.delete(uid);
    }
    this.pendingCandidates.delete(uid);
    this.onRemoteStream(uid, null);
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
    if (this.localStream) this.localStream.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    try {
      await deleteDoc(doc(this.db, ...base, "participants", this.uid));
    } catch (e) {
      // channel may already be gone
    }
  }
}
