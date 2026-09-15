import {
  collection, doc, setDoc, deleteDoc, addDoc, onSnapshot, query, where, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const MAX_PARTICIPANTS = 6;

// Mesh WebRTC voice channel, signaled through Firestore documents (offer/answer/ICE
// candidates) instead of a dedicated signaling server. The peer with the lexicographically
// smaller uid always initiates the connection to a given peer, so each pair only opens once.
// `join()` takes the Firestore path segments of the voice channel document, e.g.
// ["servers", serverId, "voiceChannels", channelId].
export class VoiceManager {
  constructor(db, uid, profile, { onParticipantsChange, onRemoteStream, onError } = {}) {
    this.db = db;
    this.uid = uid;
    this.displayName = profile.displayName;
    this.avatarEmoji = profile.avatarEmoji;
    this.onParticipantsChange = onParticipantsChange || (() => {});
    this.onRemoteStream = onRemoteStream || (() => {});
    this.onError = onError || (() => {});
    this.base = null;
    this.localStream = null;
    this.peers = new Map();
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
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      this.base = null;
      this.onError("Microphone permission denied or unavailable.");
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

    const myIncoming = query(this._signals(), where("to", "==", this.uid));
    this.unsubSignals = onSnapshot(myIncoming, (qs) => {
      qs.docChanges().forEach(async (change) => {
        if (change.type !== "added") return;
        try {
          await this._handleSignal(change.doc.data());
        } finally {
          deleteDoc(change.doc.ref).catch(() => {});
        }
      });
    });

    return true;
  }

  async _connectTo(otherUid) {
    const pc = this._createPeerConnection(otherUid);
    this.peers.set(otherUid, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await addDoc(this._signals(), {
      from: this.uid,
      to: otherUid,
      type: "offer",
      payload: JSON.stringify(offer),
      createdAt: serverTimestamp(),
    });
  }

  _createPeerConnection(otherUid) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream));
    pc.onicecandidate = (e) => {
      if (e.candidate && this.base) {
        addDoc(this._signals(), {
          from: this.uid,
          to: otherUid,
          type: "candidate",
          payload: JSON.stringify(e.candidate),
          createdAt: serverTimestamp(),
        }).catch(() => {});
      }
    };
    pc.ontrack = (e) => this.onRemoteStream(otherUid, e.streams[0]);
    return pc;
  }

  async _handleSignal(data) {
    const { from, type, payload } = data;
    let pc = this.peers.get(from);
    if (!pc) {
      pc = this._createPeerConnection(from);
      this.peers.set(from, pc);
    }
    if (type === "offer") {
      await pc.setRemoteDescription(JSON.parse(payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await addDoc(this._signals(), {
        from: this.uid,
        to: from,
        type: "answer",
        payload: JSON.stringify(answer),
        createdAt: serverTimestamp(),
      });
    } else if (type === "answer") {
      await pc.setRemoteDescription(JSON.parse(payload));
    } else if (type === "candidate") {
      try {
        await pc.addIceCandidate(JSON.parse(payload));
      } catch (e) {
        // candidate can arrive before remote description is set in rare races; safe to ignore
      }
    }
  }

  _closePeer(uid) {
    const pc = this.peers.get(uid);
    if (pc) {
      pc.close();
      this.peers.delete(uid);
    }
    this.onRemoteStream(uid, null);
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
