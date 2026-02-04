// Script to create an admin user in the 'admins' collection
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin user details
const adminEmail = "admin@example.com";
const adminPassword = "admin123";  // In a real app, use a secure password and environment variables
const adminData = {
    firstName: "Admin",
    lastName: "User",
    email: adminEmail,
    phone: "+1234567890",
    role: "admin",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
};

// Function to create admin user
async function createAdminUser() {
    try {
        // Sign in with admin credentials
        const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        const user = userCredential.user;
        
        // Add admin to the 'admins' collection
        await setDoc(doc(db, 'admins', user.uid), adminData);
        
        console.log('Admin user created successfully!');
        console.log('Admin UID:', user.uid);
        
        // Sign out after creating admin
        await signOut(auth);
        
    } catch (error) {
        console.error('Error creating admin user:', error);
        if (error.code === 'auth/user-not-found') {
            console.error('Admin user not found. Please create the user in Firebase Authentication first.');
        }
    }
}

// Run the function
createAdminUser();
