import { db, storage } from './firebase.js';
import { collection, addDoc, getDocs, query, where, orderBy, doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

class TestManager {
  // Create a new test
  static async createTest(testData) {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser'));
      if (!user) throw new Error('User not authenticated');

      const testRef = await addDoc(collection(db, 'tests'), {
        ...testData,
        teacherId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        isActive: true,
        participants: 0,
        averageScore: 0
      });
      
      return testRef.id;
    } catch (error) {
      console.error('Error creating test:', error);
      throw error;
    }
  }

  // Get all tests for a teacher
  static async getTeacherTests(teacherId) {
    try {
      const q = query(
        collection(db, 'tests'),
        where('teacherId', '==', teacherId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting teacher tests:', error);
      throw error;
    }
  }

  // Get all active tests for students
  static async getActiveTests() {
    try {
      const q = query(
        collection(db, 'tests'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting active tests:', error);
      throw error;
    }
  }

  // Get test by ID
  static async getTestById(testId) {
    try {
      const testDoc = await getDoc(doc(db, 'tests', testId));
      if (!testDoc.exists()) {
        throw new Error('Test not found');
      }
      return { id: testDoc.id, ...testDoc.data() };
    } catch (error) {
      console.error('Error getting test:', error);
      throw error;
    }
  }

  // Update a test
  static async updateTest(testId, testData) {
    try {
      const testRef = doc(db, 'tests', testId);
      await updateDoc(testRef, {
        ...testData,
        updatedAt: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating test:', error);
      throw error;
    }
  }

  // Delete a test
  static async deleteTest(testId) {
    try {
      // Delete test document
      await deleteDoc(doc(db, 'tests', testId));
      
      // Delete associated files in storage if any
      try {
        const storageRef = ref(storage, `tests/${testId}`);
        await deleteObject(storageRef);
      } catch (storageError) {
        console.log('No associated files to delete');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting test:', error);
      throw error;
    }
  }

  // Submit test attempt
  static async submitTestAttempt(attemptData) {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser'));
      if (!user) throw new Error('User not authenticated');

      const attemptRef = await addDoc(collection(db, 'testAttempts'), {
        ...attemptData,
        studentId: user.uid,
        submittedAt: Timestamp.now(),
        isGraded: false
      });
      
      // Update test participants count
      const testRef = doc(db, 'tests', attemptData.testId);
      const testDoc = await getDoc(testRef);
      if (testDoc.exists()) {
        const testData = testDoc.data();
        await updateDoc(testRef, {
          participants: (testData.participants || 0) + 1
        });
      }
      
      return attemptRef.id;
    } catch (error) {
      console.error('Error submitting test attempt:', error);
      throw error;
    }
  }

  // Grade a test attempt
  static async gradeTestAttempt(attemptId, score, feedback = '') {
    try {
      const attemptRef = doc(db, 'testAttempts', attemptId);
      await updateDoc(attemptRef, {
        score,
        feedback,
        isGraded: true,
        gradedAt: Timestamp.now()
      });
      
      // Update test average score
      const attemptDoc = await getDoc(attemptRef);
      if (attemptDoc.exists()) {
        const attemptData = attemptDoc.data();
        const testRef = doc(db, 'tests', attemptData.testId);
        
        // Get all graded attempts for this test
        const attemptsQuery = query(
          collection(db, 'testAttempts'),
          where('testId', '==', attemptData.testId),
          where('isGraded', '==', true)
        );
        
        const querySnapshot = await getDocs(attemptsQuery);
        const gradedAttempts = querySnapshot.docs.map(doc => doc.data().score);
        
        // Calculate new average
        const averageScore = gradedAttempts.reduce((sum, score) => sum + score, 0) / gradedAttempts.length;
        
        // Update test with new average
        await updateDoc(testRef, {
          averageScore: Math.round(averageScore * 100) / 100 // Round to 2 decimal places
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error grading test attempt:', error);
      throw error;
    }
  }

  // Get test attempts for a student
  static async getStudentAttempts(studentId) {
    try {
      const q = query(
        collection(db, 'testAttempts'),
        where('studentId', '==', studentId),
        orderBy('submittedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const attempts = [];
      
      // Get test details for each attempt
      for (const doc of querySnapshot.docs) {
        const attempt = { id: doc.id, ...doc.data() };
        const testData = await this.getTestById(attempt.testId);
        attempts.push({
          ...attempt,
          testTitle: testData.title,
          maxScore: testData.questions ? testData.questions.length : 0
        });
      }
      
      return attempts;
    } catch (error) {
      console.error('Error getting student attempts:', error);
      throw error;
    }
  }

  // Get test attempts for a specific test
  static async getTestAttempts(testId) {
    try {
      const q = query(
        collection(db, 'testAttempts'),
        where('testId', '==', testId),
        orderBy('submittedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting test attempts:', error);
      throw error;
    }
  }
}

class AnnouncementManager {
  // Create a new announcement
  static async createAnnouncement(announcementData) {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser'));
      if (!user) throw new Error('User not authenticated');

      const announcementRef = await addDoc(collection(db, 'announcements'), {
        ...announcementData,
        authorId: user.uid,
        authorName: user.displayName,
        createdAt: Timestamp.now(),
        isActive: true
      });
      
      return announcementRef.id;
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }

  // Get all announcements
  static async getAnnouncements(limit = 10) {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting announcements:', error);
      throw error;
    }
  }

  // Get announcements by author
  static async getAnnouncementsByAuthor(authorId) {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('authorId', '==', authorId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting announcements by author:', error);
      throw error;
    }
  }

  // Update an announcement
  static async updateAnnouncement(announcementId, announcementData) {
    try {
      const announcementRef = doc(db, 'announcements', announcementId);
      await updateDoc(announcementRef, {
        ...announcementData,
        updatedAt: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating announcement:', error);
      throw error;
    }
  }

  // Delete an announcement (soft delete)
  static async deleteAnnouncement(announcementId) {
    try {
      const announcementRef = doc(db, 'announcements', announcementId);
      await updateDoc(announcementRef, {
        isActive: false,
        updatedAt: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }
  }
}

// Initialize UI components when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize test creation form if it exists
  const testForm = document.getElementById('create-test-form');
  if (testForm) {
    testForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const formData = new FormData(testForm);
        const testData = {
          title: formData.get('title'),
          description: formData.get('description'),
          duration: parseInt(formData.get('duration'), 10),
          questions: JSON.parse(formData.get('questions-json') || '[]'),
          passingScore: parseInt(formData.get('passingScore'), 10) || 0,
          isActive: formData.get('isActive') === 'on'
        };
        
        await TestManager.createTest(testData);
        showNotification('Test created successfully!', 'success');
        testForm.reset();
        
        // Redirect to tests list or update UI
        if (window.location.pathname.includes('teacher')) {
          window.location.href = 'teacher-tests.html';
        }
      } catch (error) {
        console.error('Error creating test:', error);
        showNotification('Error creating test: ' + error.message, 'error');
      }
    });
  }
  
  // Initialize announcement form if it exists
  const announcementForm = document.getElementById('create-announcement-form');
  if (announcementForm) {
    announcementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const formData = new FormData(announcementForm);
        const announcementData = {
          title: formData.get('title'),
          content: formData.get('content'),
          isImportant: formData.get('isImportant') === 'on',
          targetAudience: formData.get('targetAudience') || 'all'
        };
        
        await AnnouncementManager.createAnnouncement(announcementData);
        showNotification('Announcement posted successfully!', 'success');
        announcementForm.reset();
        
        // Redirect to announcements list or update UI
        if (window.location.pathname.includes('teacher')) {
          window.location.href = 'teacher-announcements.html';
        } else {
          window.location.href = 'announcements.html';
        }
      } catch (error) {
        console.error('Error creating announcement:', error);
        showNotification('Error creating announcement: ' + error.message, 'error');
      }
    });
  }
});

export { TestManager, AnnouncementManager };
