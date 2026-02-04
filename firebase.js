// Firebase initialization module
// This is a module script loaded with type="module" in index.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    addDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    OAuthProvider
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAtOedXLBC4eigzqmBpYFciN-W5Mi2Cpmc",
    authDomain: "alpharia-c6a39.firebaseapp.com",
    projectId: "alpharia-c6a39",
    storageBucket: "alpharia-c6a39.firebasestorage.app",
    messagingSenderId: "85322759772",
    appId: "1:85322759772:web:d5c7a528fd61c9d2373099",
    measurementId: "G-KEC7MGMVE8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Analytics not available:", e);
    analytics = null;
}

// Initialize Firebase Auth
export const auth = getAuth(app);

// Auth Providers
export const googleProvider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');

// Auth functions
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithMicrosoft = () => signInWithPopup(auth, microsoftProvider);

// User management functions - Single implementation that handles both basic and role-specific profiles

export const getUserProfile = async (userId) => {
    try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
    }
};

// Collections
const usersCollection = collection(db, 'users');
const teachersCollection = collection(db, 'teachers');
const studentsCollection = collection(db, 'students');
const testsCollection = collection(db, 'tests');
const testAttemptsCollection = collection(db, 'testAttempts');
const studentProgressCollection = collection(db, 'studentProgress');
const announcementsCollection = collection(db, 'announcements');

// User Management
export async function createUserProfile(userId, userData) {
    const batch = writeBatch(db);
    
    try {
        // Create user document
        const userRef = doc(usersCollection, userId);
        batch.set(userRef, {
            ...userData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Create role-specific document
        if (userData.role === 'teacher') {
            const teacherRef = doc(teachersCollection, userId);
            batch.set(teacherRef, {
                userId,
                displayName: userData.displayName,
                email: userData.email,
                totalStudents: 0,
                totalTestsCreated: 0,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            // Create initial teacher stats
            const teacherStatsRef = doc(collection(db, 'teacherStats'), userId);
            batch.set(teacherStatsRef, {
                totalStudents: 0,
                totalTests: 0,
                averageClassScore: 0,
                lastUpdated: serverTimestamp()
            });
            
        } else if (userData.role === 'student') {
            const studentRef = doc(studentsCollection, userId);
            batch.set(studentRef, {
                userId,
                displayName: userData.displayName,
                email: userData.email,
                grade: userData.grade || '',
                level: userData.level || '',
                totalTestsTaken: 0,
                averageScore: 0,
                lastTestDate: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            // Create initial student progress document
            const progressRef = doc(studentProgressCollection, userId);
            batch.set(progressRef, {
                userId,
                displayName: userData.displayName,
                grade: userData.grade || '',
                level: userData.level || '',
                totalTests: 0,
                averageScore: 0,
                lastTestDate: null,
                testHistory: [],
                readingLevel: userData.level || 'beginner',
                readingSpeed: 0, // words per minute
                comprehensionScore: 0,
                vocabularySize: 0,
                lastUpdated: serverTimestamp()
            });
        }
        
        await batch.commit();
        return { success: true };
        
    } catch (error) {
        console.error('Error creating user profile:', error);
        return { success: false, error };
    }
}

// Teacher Functions
export async function createTeacher(userId, teacherData) {
    try {
        const teacherRef = doc(teachersCollection, userId);
        await setDoc(teacherRef, {
            ...teacherData,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error creating teacher:', error);
        return { success: false, error };
    }
}

// Student Functions
export async function createStudent(userId, studentData) {
    try {
        const studentRef = doc(studentsCollection, userId);
        await setDoc(studentRef, {
            ...studentData,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error creating student:', error);
        return { success: false, error };
    }
}

// Test Functions
export async function createTest(testData) {
    const batch = writeBatch(db);
    
    try {
        // Create test document
        const testRef = doc(testsCollection);
        const testId = testRef.id;
        
        batch.set(testRef, {
            ...testData,
            testId,
            totalQuestions: testData.questions?.length || 0,
            totalAttempts: 0,
            averageScore: 0,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Update teacher's test count
        if (testData.teacherId) {
            const teacherRef = doc(teachersCollection, testData.teacherId);
            batch.update(teacherRef, {
                totalTestsCreated: increment(1),
                updatedAt: serverTimestamp()
            });
            
            // Update teacher stats
            const teacherStatsRef = doc(collection(db, 'teacherStats'), testData.teacherId);
            batch.update(teacherStatsRef, {
                totalTests: increment(1),
                lastUpdated: serverTimestamp()
            });
        }
        
        // Create test results subcollection
        const testResultsRef = doc(collection(testRef, 'results'), 'initial');
        batch.set(testResultsRef, {
            testId,
            totalAttempts: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            lastUpdated: serverTimestamp()
        });
        
        await batch.commit();
        return { success: true, id: testId };
        
    } catch (error) {
        console.error('Error creating test:', error);
        return { success: false, error };
    }
}

export async function submitTestAttempt(attemptData) {
    const batch = writeBatch(db);
    
    try {
        const { testId, studentId, answers, score, totalQuestions } = attemptData;
        const attemptRef = doc(testAttemptsCollection);
        const attemptId = attemptRef.id;
        
        // Record the test attempt
        batch.set(attemptRef, {
            attemptId,
            testId,
            studentId,
            score,
            totalQuestions,
            percentage: Math.round((score / totalQuestions) * 100),
            completedAt: serverTimestamp(),
            status: 'completed'
        });
        
        // Update test statistics
        const testRef = doc(testsCollection, testId);
        batch.update(testRef, {
            totalAttempts: increment(1),
            updatedAt: serverTimestamp()
        });
        
        // Update student's progress
        const progressRef = doc(studentProgressCollection, studentId);
        batch.update(progressRef, {
            totalTests: increment(1),
            lastTestDate: serverTimestamp(),
            lastTestScore: score,
            lastTestPercentage: Math.round((score / totalQuestions) * 100),
            lastUpdated: serverTimestamp(),
            testHistory: arrayUnion({
                testId,
                attemptId,
                score,
                totalQuestions,
                percentage: Math.round((score / totalQuestions) * 100),
                completedAt: serverTimestamp()
            })
        });
        
        // Update test results
        const testResultsRef = doc(collection(doc(testsCollection, testId), 'results'), 'stats');
        batch.set(testResultsRef, {
            totalAttempts: increment(1),
            totalScore: increment(score),
            lastUpdated: serverTimestamp()
        }, { merge: true });
        
        // Update student's average score
        const studentRef = doc(studentsCollection, studentId);
        batch.update(studentRef, {
            totalTestsTaken: increment(1),
            lastTestDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
        });
        
        await batch.commit();
        return { success: true, attemptId };
        
    } catch (error) {
        console.error('Error submitting test attempt:', error);
        return { success: false, error };
    }
}

export async function getStudentProgress(studentId) {
    try {
        const progressRef = doc(studentProgressCollection, studentId);
        const progressDoc = await getDoc(progressRef);
        
        if (!progressDoc.exists()) {
            return { success: false, error: 'Progress not found' };
        }
        
        return { success: true, data: progressDoc.data() };
    } catch (error) {
        console.error('Error getting student progress:', error);
        return { success: false, error };
    }
}

export async function getClassProgress(teacherId) {
    try {
        // Get all students assigned to this teacher's class
        const q = query(
            studentProgressCollection,
            where('assignedTeacherId', '==', teacherId)
        );
        
        const querySnapshot = await getDocs(q);
        const students = [];
        
        querySnapshot.forEach(doc => {
            students.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Calculate class statistics
        const totalStudents = students.length;
        const totalTests = students.reduce((sum, student) => sum + (student.totalTests || 0), 0);
        const averageScore = students.length > 0 
            ? students.reduce((sum, student) => sum + (student.averageScore || 0), 0) / students.length 
            : 0;
        
        return {
            success: true,
            data: {
                totalStudents,
                totalTests,
                averageScore: Math.round(averageScore * 100) / 100,
                students
            }
        };
        
    } catch (error) {
        console.error('Error getting class progress:', error);
        return { success: false, error };
    }
}

export async function getTestsByTeacher(teacherId) {
    try {
        const q = query(
            testsCollection,
            where('teacherId', '==', teacherId),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        // For each test, get the latest results
        const tests = [];
        for (const doc of querySnapshot.docs) {
            const testData = { id: doc.id, ...doc.data() };
            
            // Get test results
            const resultsRef = doc(collection(doc.ref, 'results'), 'stats');
            const resultsDoc = await getDoc(resultsRef);
            
            if (resultsDoc.exists()) {
                testData.results = resultsDoc.data();
            }
            
            tests.push(testData);
        }
        
        return tests;
    } catch (error) {
        console.error('Error getting tests:', error);
        return [];
    }
}

// Announcement Functions
export async function createAnnouncement(announcementData) {
    try {
        const announcementRef = await addDoc(announcementsCollection, {
            ...announcementData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isActive: true
        });
        return { success: true, id: announcementRef.id };
    } catch (error) {
        console.error('Error creating announcement:', error);
        return { success: false, error };
    }
}

export async function getAnnouncements(limitCount = 10) {
    try {
        const q = query(
            announcementsCollection,
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting announcements:', error);
        return [];
    }
}

// Expose to window for non-module scripts
window.alphariaFirebase = {
    // Auth
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithGoogle,
    signInWithMicrosoft,
    
    // User Management
    createUserProfile,
    getUserProfile,
    
    // Teacher Functions
    createTeacher,
    
    // Student Functions
    createStudent,
    
    // Test Functions
    createTest,
    getTestsByTeacher,
    
    // Announcement Functions
    createAnnouncement,
    getAnnouncements,
    
    // Collections (for direct access if needed)
    collections: {
        users: usersCollection,
        teachers: teachersCollection,
        students: studentsCollection,
        tests: testsCollection,
        testAttempts: testAttemptsCollection,
        studentProgress: studentProgressCollection,
        announcements: announcementsCollection
    },
    
    // Progress and Analytics
    submitTestAttempt,
    getStudentProgress,
    getClassProgress
};

// Make auth available globally for debugging
window.auth = auth;
