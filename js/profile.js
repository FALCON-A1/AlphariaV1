import { auth, db, storage } from './firebase.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export class ProfileManager {
  // Get current user's profile
  static async getCurrentUserProfile() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      return await this.getUserProfile(user.uid);
    } catch (error) {
      console.error('Error getting current user profile:', error);
      throw error;
    }
  }

  // Get any user's profile by ID
  static async getUserProfile(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Update user profile
  static async updateProfile(profileData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: new Date()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  // Upload profile picture
  static async uploadProfilePicture(file) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      if (!file) throw new Error('No file provided');

      // Delete old profile picture if exists
      try {
        const oldProfile = await this.getCurrentUserProfile();
        if (oldProfile.photoURL && oldProfile.photoURL.includes('profile-pictures')) {
          const oldImageRef = ref(storage, `profile-pictures/${user.uid}`);
          await deleteObject(oldImageRef);
        }
      } catch (error) {
        console.log('No previous profile picture to delete');
      }

      // Upload new profile picture
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update user profile with new photo URL
      await this.updateProfile({ photoURL: downloadURL });
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  }

  // Get all students (for teachers)
  static async getAllStudents() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // In a real app, you might want to add additional filtering/security
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting students:', error);
      throw error;
    }
  }

  // Update student information (for teachers)
  static async updateStudentInfo(studentId, studentData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Verify the current user is a teacher
      const currentUser = await this.getCurrentUserProfile();
      if (currentUser.role !== 'teacher') {
        throw new Error('Only teachers can update student information');
      }

      const studentRef = doc(db, 'users', studentId);
      await updateDoc(studentRef, {
        ...studentData,
        updatedAt: new Date(),
        updatedBy: user.uid
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating student info:', error);
      throw error;
    }
  }

  // Initialize profile UI
  static initProfileUI() {
    const profileBtn = document.getElementById('profile-btn');
    const profileModal = document.getElementById('profile-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal, #cancel-profile');
    const profileForm = document.getElementById('profile-form');
    const profilePictureInput = document.getElementById('profile-picture');
    const profilePreview = document.getElementById('profile-preview');
    const userRole = document.body.classList.contains('role-teacher') ? 'teacher' : 'student';

    // Load profile data when modal opens
    const loadProfileData = async () => {
      try {
        const profile = await this.getCurrentUserProfile();
        
        // Update form fields
        document.getElementById('displayName').value = profile.displayName || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('phone').value = profile.phone || '';
        document.getElementById('bio').value = profile.bio || '';
        
        if (userRole === 'teacher') {
          document.getElementById('department').value = profile.department || '';
          document.getElementById('subjects').value = profile.subjects || '';
        } else {
          document.getElementById('studentId').value = profile.studentId || '';
          document.getElementById('grade').value = profile.grade || '';
          document.getElementById('parentName').value = profile.parentName || '';
          document.getElementById('parentEmail').value = profile.parentEmail || '';
          document.getElementById('parentPhone').value = profile.parentPhone || '';
        }

        // Update profile preview image
        if (profile.photoURL) {
          profilePreview.src = profile.photoURL;
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
        showNotification('Error loading profile data', 'error');
      }
    };

    // Handle profile form submission
    const handleProfileSubmit = async (e) => {
      e.preventDefault();
      
      try {
        const formData = {
          displayName: document.getElementById('displayName').value,
          phone: document.getElementById('phone').value,
          bio: document.getElementById('bio').value
        };
        
        // Add role-specific fields
        if (userRole === 'teacher') {
          formData.department = document.getElementById('department').value;
          formData.subjects = document.getElementById('subjects').value;
        } else {
          formData.studentId = document.getElementById('studentId').value;
          formData.grade = document.getElementById('grade').value;
          formData.parentName = document.getElementById('parentName').value;
          formData.parentEmail = document.getElementById('parentEmail').value;
          formData.parentPhone = document.getElementById('parentPhone').value;
        }
        
        await this.updateProfile(formData);
        showNotification('Profile updated successfully', 'success');
        
        // Update UI
        const profileName = document.getElementById('profile-name');
        if (profileName) {
          profileName.textContent = formData.displayName;
        }
        
        // Close modal
        profileModal.classList.remove('show');
        document.body.style.overflow = '';
      } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile: ' + error.message, 'error');
      }
    };

    // Event listeners
    if (profileBtn && profileModal) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        loadProfileData();
      });
    }
    
    closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        profileModal.classList.remove('show');
        document.body.style.overflow = '';
      });
    });
    
    if (profilePictureInput) {
      profilePictureInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            // Show preview
            const reader = new FileReader();
            reader.onload = (event) => {
              profilePreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
            
            // Upload the file
            await this.uploadProfilePicture(file);
            showNotification('Profile picture updated', 'success');
          } catch (error) {
            console.error('Error uploading profile picture:', error);
            showNotification('Error uploading profile picture', 'error');
          }
        }
      });
    }
    
    if (profileForm) {
      profileForm.addEventListener('submit', handleProfileSubmit);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === profileModal) {
        profileModal.classList.remove('show');
        document.body.style.overflow = '';
      }
    });
  }
}

// Initialize profile UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('profile-modal')) {
    ProfileManager.initProfileUI();
  }
});

export default ProfileManager;
