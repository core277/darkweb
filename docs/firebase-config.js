// Replace these placeholder values with your own Firebase project's web app config.
// Firebase Console -> Project settings -> General -> Your apps -> SDK setup and configuration.
// This config is safe to commit/expose publicly: it's a client identifier, not a secret.
// Real access control lives in firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDBgZCb0UEkFLc75kI7rFQttIG0SIJIJA4",
  authDomain: "darkweb-dce66.firebaseapp.com",
  projectId: "darkweb-dce66",
  storageBucket: "darkweb-dce66.firebasestorage.app",
  messagingSenderId: "466569421019",
  appId: "1:466569421019:web:bc1bca064ddafb560c6cfe",
};

// Optional: enables GIF search in chat. Free key from Google Cloud Console
// (enable the "Tenor API", then Credentials -> Create API key). Leave empty to disable.
export const tenorApiKey = "";

// Alternative GIF provider (used if tenorApiKey is empty). Free key from developers.giphy.com
// (Create an App -> API). Leave empty to disable.
export const giphyApiKey = "";
