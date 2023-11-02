import { initializeApp } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-app.js";

import {
    addDoc,
    collection,
    connectFirestoreEmulator,
    deleteDoc,
    doc,
    Firestore,
    getDoc,
    getDocs,
    getFirestore,
    initializeFirestore,
    query,
    QuerySnapshot,
    setDoc,
    where,
  } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-firestore.js";

  
import { getAuth } from "https://www.gstatic.com/firebasejs/9.8.1/firebase-auth.js";
import { logger } from "./util.ts";

export const app = initializeApp({
    apiKey: Deno.env.get("FIREBASE_API_KEY"),
    authDomain: Deno.env.get("FIREBASE_AUTH_DOMAIN"),
    projectId: Deno.env.get("FIREBASE_PROJECT_ID"),
    storageBucket: Deno.env.get("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: Deno.env.get("FIREBASE_MESSING_SENDER_ID"),
    appId: Deno.env.get("FIREBASE_APP_ID"),
    measurementId: Deno.env.get("FIREBASE_MEASUREMENT_ID"),
});
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  timestampsInSnapshots: true
});
export const auth = getAuth(app);
