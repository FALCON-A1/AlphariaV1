import { db } from './firebase.js';
import { showNotification } from './utils.js';
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, deleteDoc, writeBatch } from 'firebase/firestore';

// Collection names and their default documents
const COLLECTIONS = {
    USERS: {
        name: 'users',
        defaultDocs: {
            admin: {
                role: 'admin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    },
    TESTS: {
        name: 'tests',
        defaultDocs: {}
    },
    TEST_ATTEMPTS: {
        name: 'testAttempts',
        defaultDocs: {}
    },
    ANNOUNCEMENTS: {
        name: 'announcements',
        defaultDocs: {
            welcome: {
                title: 'Welcome to Alpharia!',
                content: 'Thank you for joining Alpharia. We\'re excited to have you on board!',
                author: 'system',
                createdAt: new Date().toISOString(),
                isActive: true
            }
        }
    }
};

// Track initialized collections
const initializedCollections = new Set();

/**
 * Initialize a collection with default documents if it doesn't exist
 * @param {string} collectionKey - Key from COLLECTIONS object
 * @returns {Promise<void>}
 */
async function initializeCollection(collectionKey) {
    if (initializedCollections.has(collectionKey)) return;
    
    const collectionConfig = COLLECTIONS[collectionKey];
    if (!collectionConfig) {
        throw new Error(`Invalid collection key: ${collectionKey}`);
    }
    
    try {
        console.log(`Initializing collection: ${collectionConfig.name}`);
        
        // Check if collection has default documents
        const defaultDocs = collectionConfig.defaultDocs || {};
        const defaultDocKeys = Object.keys(defaultDocs);
        
        if (defaultDocKeys.length > 0) {
            // Check if any default document exists
            const docRef = doc(db, collectionConfig.name, defaultDocKeys[0]);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                console.log(`Creating default documents for ${collectionConfig.name}`);
                // Create default documents in a batch
                const batch = writeBatch(db);
                
                for (const [docId, docData] of Object.entries(defaultDocs)) {
                    const docRef = doc(db, collectionConfig.name, docId);
                    batch.set(docRef, {
                        ...docData,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
                
                await batch.commit();
                console.log(`Successfully created default documents for ${collectionConfig.name}`);
            } else {
                console.log(`Collection ${collectionConfig.name} already has documents`);
            }
        } else {
            // For collections without default docs, just check if collection exists
            console.log(`No default documents defined for ${collectionConfig.name}, skipping initialization`);
        }
        
        initializedCollections.add(collectionKey);
        console.log(`Successfully initialized collection: ${collectionConfig.name}`);
    } catch (error) {
        console.error(`Error initializing collection ${collectionKey}:`, error);
        throw error;
    }
}

/**
 * Get a collection reference, initializing it if necessary
 * @param {string} collectionKey - Key from COLLECTIONS object
 * @returns {Object} Collection reference and name
 */
async function getCollection(collectionKey) {
    if (!initializedCollections.has(collectionKey)) {
        await initializeCollection(collectionKey);
    }
    return {
        ref: collection(db, COLLECTIONS[collectionKey].name),
        name: COLLECTIONS[collectionKey].name
    };
}

/**
 * Get a document from a collection
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} - Document data or null if not found
 */
export async function getDocument(collectionKey, docId) {
    try {
        const { ref } = await getCollection(collectionKey);
        const docRef = doc(ref, docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error(`Error getting document ${docId} from ${collectionKey}:`, error);
        showNotification('Error loading data', 'error');
        throw error;
    }
}

/**
 * Add or update a document in a collection
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID (if empty, a new ID will be generated)
 * @param {Object} data - Document data
 * @returns {Promise<string>} - Document ID
 */
export async function saveDocument(collectionKey, docId, data) {
    try {
        const { ref } = await getCollection(collectionKey);
        const docRef = docId ? doc(ref, docId) : doc(ref);
        
        // Add timestamps
        const now = new Date().toISOString();
        const docData = {
            ...data,
            updatedAt: now,
            ...(!docId && { createdAt: now })
        };
        
        await setDoc(docRef, docData, { merge: true });
        return docRef.id;
    } catch (error) {
        console.error(`Error saving document to ${collectionKey}:`, error);
        showNotification('Error saving data', 'error');
        throw error;
    }
}

/**
 * Delete a document from a collection
 * @param {string} collection - Collection name
 * @param {string} docId - Document ID
 */
export async function deleteDocument(collectionKey, docId) {
    try {
        const { ref } = await getCollection(collectionKey);
        await deleteDoc(doc(ref, docId));
        return true;
    } catch (error) {
        console.error(`Error deleting document ${docId} from ${collectionKey}:`, error);
        showNotification('Error deleting data', 'error');
        throw error;
    }
}

/**
 * Query documents in a collection
 * @param {string} collection - Collection key from COLLECTIONS
 * @param {Array} where - Array of where conditions [field, operator, value]
 * @param {string} orderBy - Field to order by
 * @param {string} orderDirection - 'asc' or 'desc'
 * @param {number} limit - Maximum number of documents to return
 * @returns {Promise<Array>} - Array of documents
 */
export async function queryCollection({
    collection: collectionKey,
    where: whereClauses = [],
    orderBy: orderByField,
    orderDirection = 'asc',
    limit: limitCount
} = {}) {
    try {
        const { ref } = await getCollection(collectionKey);
        let q = ref;
        
        // Apply where clauses
        const whereConditions = whereClauses.map(([field, operator, value]) => 
            where(field, operator, value)
        );
        
        // Apply ordering
        if (orderByField) {
            whereConditions.push(orderBy(orderByField, orderDirection));
        }
        
        // Apply limit
        if (limitCount) {
            whereConditions.push(limit(limitCount));
        }
        
        // Create the query
        const queryRef = query(q, ...whereConditions);
        const querySnapshot = await getDocs(queryRef);
        
        // Process results
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return results;
    } catch (error) {
        console.error(`Error querying collection ${collectionKey}:`, error);
        showNotification('Error loading data', 'error');
        throw error;
    }
}

// User-related functions
export const UserService = {
    /**
     * Create or update a user profile
     * @param {string} userId - User ID
     * @param {Object} userData - User data
     * @returns {Promise<void>}
     */
    async createUserProfile(userId, userData) {
        try {
            // Initialize users collection first
            await initializeCollection('USERS');
            
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, {
                ...userData,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            console.log(`User profile created/updated for ${userId}`);
        } catch (error) {
            console.error('Error creating/updating user profile:', error);
            throw error;
        }
    },
    
    /**
     * Get user profile
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} - User data or null if not found
     */
    async getUserProfile(userId) {
        try {
            await initializeCollection('USERS');
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                return userSnap.data();
            }
            return null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            throw error;
        }
    },
    
    /**
     * Update user profile
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateUserProfile(userId, updates) {
        try {
            await initializeCollection('USERS');
            const userRef = doc(db, 'users', userId);
            
            await setDoc(userRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            console.log(`User profile updated for ${userId}`);
        } catch (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }
    }
};

// Test-related functions
export const TestService = {
    /**
     * Create or update a test
     * @param {string} testId - Test ID (empty for new test)
     * @param {Object} testData - Test data
     * @param {string} userId - Teacher ID who owns this test
     * @returns {Promise<string>} - Test ID
     */
    async saveTest(testId, testData, userId) {
        try {
            await initializeCollection('TESTS');
            const testRef = testId 
                ? doc(db, COLLECTIONS.TESTS.name, testId)
                : doc(collection(db, COLLECTIONS.TESTS.name));
            
            const testWithMeta = {
                ...testData,
                createdBy: userId,
                updatedAt: new Date().toISOString(),
                ...(!testId && { 
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    participants: 0,
                    averageScore: 0
                })
            };
            
            await setDoc(testRef, testWithMeta, { merge: true });
            return testRef.id;
        } catch (error) {
            console.error(`Error saving test to ${COLLECTIONS.TESTS.name}:`, error);
            showNotification('Error saving test', 'error');
            throw error;
        }
    },
    
    /**
     * Get test by ID
     * @param {string} testId - Test ID
     * @returns {Promise<Object|null>} - Test data or null if not found
     */
    async getTest(testId) {
        try {
            await initializeCollection('TESTS');
            const docRef = doc(db, COLLECTIONS.TESTS.name, testId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error(`Error getting test ${testId} from ${COLLECTIONS.TESTS.name}:`, error);
            showNotification('Error loading test', 'error');
            throw error;
        }
    },
    
    /**
     * Get all tests for a teacher
     * @param {string} teacherId - Teacher ID
     * @returns {Promise<Array>} - Array of tests
     */
    async getTeacherTests(teacherId) {
        try {
            await initializeCollection('TESTS');
            const q = query(
                collection(db, COLLECTIONS.TESTS.name),
                where('createdBy', '==', teacherId),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error getting tests for teacher ${teacherId} from ${COLLECTIONS.TESTS.name}:`, error);
            showNotification('Error loading tests', 'error');
            throw error;
        }
    },
    
    /**
     * Get all active tests (for students)
     * @returns {Promise<Array>} - Array of active tests
     */
    async getActiveTests() {
        try {
            await initializeCollection('TESTS');
            const q = query(
                collection(db, COLLECTIONS.TESTS.name),
                where('isActive', '==', true),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error(`Error getting active tests from ${COLLECTIONS.TESTS.name}:`, error);
            showNotification('Error loading tests', 'error');
            throw error;
        }
    },
    
    /**
     * Delete a test
     * @param {string} testId - Test ID
     * @returns {Promise<boolean>} - True if successful
     */
    async deleteTest(testId) {
        const batch = writeBatch(db);
        try {
            await initializeCollection('TESTS');
            await initializeCollection('TEST_ATTEMPTS');
            
            // Delete all attempts
            const q = query(
                collection(db, COLLECTIONS.TEST_ATTEMPTS.name),
                where('testId', '==', testId)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            
            // Delete the test
            const testRef = doc(db, COLLECTIONS.TESTS.name, testId);
            batch.delete(testRef);
            
            await batch.commit();
            return true;
        } catch (error) {
            console.error(`Error deleting test ${testId} from ${COLLECTIONS.TESTS.name}:`, error);
            showNotification('Error deleting test', 'error');
            throw error;
        }
    },
    
    /**
     * Submit a test attempt
     * @param {string} testId - Test ID
     * @param {string} studentId - Student ID
     * @param {Object} attemptData - Test attempt data
     * @returns {Promise<string>} - Attempt ID
     */
    async submitTestAttempt(testId, studentId, attemptData) {
        try {
            await initializeCollection('TEST_ATTEMPTS');
            const attemptRef = doc(collection(db, COLLECTIONS.TEST_ATTEMPTS.name));
            
            const attempt = {
                ...attemptData,
                testId,
                studentId,
                submittedAt: new Date().toISOString(),
                isGraded: false
            };
            
            await setDoc(attemptRef, attempt);
            await this.updateTestStats(testId);
            return attemptRef.id;
        } catch (error) {
            console.error(`Error submitting test attempt for test ${testId} and student ${studentId}:`, error);
            showNotification('Error submitting test attempt', 'error');
            throw error;
        }
    },
    
    /**
     * Update test statistics (participants, average score)
     * @param {string} testId - Test ID
     */
    async updateTestStats(testId) {
        try {
            await initializeCollection('TEST_ATTEMPTS');
            const q = query(
                collection(db, COLLECTIONS.TEST_ATTEMPTS.name),
                where('testId', '==', testId)
            );
            const querySnapshot = await getDocs(q);
            const attempts = querySnapshot.docs.map(doc => doc.data());
            
            const gradedAttempts = attempts.filter(a => a.isGraded);
            const totalScore = gradedAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
            const avgScore = gradedAttempts.length > 0 
                ? Math.round((totalScore / gradedAttempts.length) * 100) / 100 
                : 0;
            
            const testRef = doc(db, COLLECTIONS.TESTS.name, testId);
            await setDoc(testRef, {
                participants: attempts.length,
                averageScore: avgScore,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            return { participants: attempts.length, averageScore: avgScore };
        } catch (error) {
            console.error(`Error updating test stats for test ${testId}:`, error);
            showNotification('Error updating test stats', 'error');
            throw error;
        }
    },
    
    /**
     * Get test attempts for a student
     * @param {string} studentId - Student ID
     * @returns {Promise<Array>} - Array of test attempts
     */
    async getStudentAttempts(studentId) {
        try {
            await initializeCollection('TEST_ATTEMPTS');
            const q = query(
                collection(db, COLLECTIONS.TEST_ATTEMPTS.name),
                where('studentId', '==', studentId),
                orderBy('submittedAt', 'desc')
            );
            
            const querySnapshot = await getDocs(q);
            const attempts = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return await Promise.all(attempts.map(async (attempt) => {
                const test = await this.getTest(attempt.testId);
                return {
                    ...attempt,
                    testTitle: test?.title || 'Unknown Test',
                    testDescription: test?.description || ''
                };
            }));
        } catch (error) {
            console.error(`Error getting test attempts for student ${studentId}:`, error);
            showNotification('Error loading test attempts', 'error');
            throw error;
        }
    }
};

// Announcement-related functions
export const AnnouncementService = {
    /**
     * Create or update an announcement
     * @param {string} announcementId - Announcement ID (empty for new)
     * @param {Object} announcementData - Announcement data
     * @param {string} userId - User ID of the author
     * @returns {Promise<string>} - Announcement ID
     */
    async saveAnnouncement(announcementId, announcementData, userId) {
        const now = new Date();
        const data = {
            ...announcementData,
            authorId: userId,
            updatedAt: now,
            isActive: announcementData.isActive !== undefined ? announcementData.isActive : true
        };
        
        if (!announcementId) {
            data.createdAt = now;
        }
        
        return saveDocument(COLLECTIONS.ANNOUNCEMENTS, announcementId, data);
    },

    /**
     * Get all active announcements
     * @param {number} limit - Maximum number of announcements to return
     * @returns {Promise<Array>} - Array of announcements
     */
    async getActiveAnnouncements(limit = 10) {
        return queryCollection({
            collection: COLLECTIONS.ANNOUNCEMENTS,
            where: ['isActive', '==', true],
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit
        });
    },

    /**
     * Get announcements by author
     * @param {string} authorId - Author ID
     * @param {number} limit - Maximum number of announcements to return
     * @returns {Promise<Array>} - Array of announcements
     */
    async getAnnouncementsByAuthor(authorId, limit = 10) {
        return queryCollection({
            collection: COLLECTIONS.ANNOUNCEMENTS,
            where: ['authorId', '==', authorId],
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit
        });
    },

    /**
     * Delete an announcement
     * @param {string} announcementId - Announcement ID
     * @returns {Promise<boolean>} - True if successful
     */
    async deleteAnnouncement(announcementId) {
        return deleteDocument(COLLECTIONS.ANNOUNCEMENTS, announcementId);
    }
};

export default {
    UserService,
    TestService,
    AnnouncementService,
    COLLECTIONS
};
