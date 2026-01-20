// Firebase Configuration for Meitzad Management System
// This file should be updated with actual Firebase project credentials

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "meitzad-nihul.firebaseapp.com",
  databaseURL: "https://meitzad-nihul-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "meitzad-nihul",
  storageBucket: "meitzad-nihul.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// Configure auth persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// Export for use in other modules
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseStorage = storage;

console.log('Firebase initialized successfully');
