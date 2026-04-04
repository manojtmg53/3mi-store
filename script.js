// 1. Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 2. Your Firebase config (keep yours same)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "mi-store-39adb.firebaseapp.com",
  projectId: "mi-store-39adb",
  storageBucket: "mi-store-39adb.appspot.com",
  messagingSenderId: "134026252994",
  appId: "1:134026252994:web:..."
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

