import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAXeb6-oGyNVntkM7xzK8eXIWDlTBgvsI",
  authDomain: "bibletriviarun.firebaseapp.com",
  projectId: "bibletriviarun",
  storageBucket: "bibletriviarun.firebasestorage.app",
  messagingSenderId: "582734842057",
  appId: "1:582734842057:web:6a3e419630579144176518",
};

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(firebaseApp);