// 1. Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 2. Your Firebase config (keep yours same)
const firebaseConfig = {
  apiKey: "AIzaSyAtgvWb8l8E7lRZuYqR0I2X5YzrYP1FiWM",
  authDomain: "mi-store-39adb.firebaseapp.com",
  projectId: "mi-store-39adb",
  storageBucket: "mi-store-39adb.firebasestorage.app",
  messagingSenderId: "134026252994",
  appId: "1:134026252994:web:28cd65790cd20fa9b2a15b"
};

// 3. Initialize Firebase
console.log("Starting Firebase...");
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
console.log("Firebase started");

// 4. Login function
window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  console.log("Trying login...");

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      alert("Login success ✅");
      console.log(userCredential.user);
    })
    .catch((error) => {
      alert("Error: " + error.message);
      console.error(error);
    });
};

