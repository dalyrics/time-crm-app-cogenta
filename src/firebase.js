// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Make sure this line is here
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDZivQqqcjJMKgktNc-FJU8rZ_QkYlufw",
  authDomain: "time-crm-app-cogenta.firebaseapp.com",
  projectId: "time-crm-app-cogenta",
  storageBucket: "time-crm-app-cogenta.firebasestorage.app",
  messagingSenderId: "1004891900129",
  appId: "1:1004891900129:web:3dd906120b54470adb8fa0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app); // Make sure this line is here

// Export the database instance so you can use it in other files
export { db }; // Make sure this line is here
