// Import modules
import { auth, storage } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { showNotification, formatDate, timeAgo } from './utils.js';
import { UserService, TestService, AnnouncementService } from './firestoreService.js';

// DOM Elements
const sidebar = document.querySelector('.sidebar');
const mainNavItems = document.querySelectorAll('.main-nav li');
const contentSections = document.querySelectorAll('.content-section');
const logoutBtn = document.getElementById('logout-btn');
const addQuestionBtn = document.getElementById('add-question');
const questionsContainer = document.getElementById('questions-container');
const addStudentBtn = document.getElementById('add-student');
const addStudentModal = document.getElementById('add-student-modal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const addStudentForm = document.getElementById('add-student-form');
const studentsTableBody = document.getElementById('students-table-body');
const availableTestsGrid = document.getElementById('available-tests-grid');
const testHistoryGrid = document.getElementById('test-history-grid');
const recentActivityList = document.getElementById('recent-activity');
const mobileMenuToggle = document.createElement('button');

// State
let currentUser = null;
let isTeacher = false;
let unsubscribeCallbacks = [];

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check authentication state first
        const isAuthenticated = checkAuthState();
        if (!isAuthenticated) return;
        
        // Initialize UI components
        initializeAuthState();
        setupEventListeners();
        setupMobileMenu();
        initializeProfileUI();
        
        // Load data
        await loadDashboardData();
        
        // Set up real-time listeners
        setupRealtimeListeners();
        
        // Clean up on page unload
        window.addEventListener('beforeunload', cleanup);
        
        // Show dashboard content
        document.body.classList.add('loaded');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error initializing dashboard. Please try again.', 'error');
    }
});

// Check authentication state and redirect if not logged in
function checkAuthState() {
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.includes('login-fixed.html') || 
                      currentPath.includes('signup.html') || 
                      currentPath.includes('forgot-password.html') ||
                      currentPath.endsWith('index.html') || 
                      currentPath === '/';
    
    // Redirect to login if not authenticated and not on auth page
    if (!auth.currentUser && !isAuthPage) {
        window.location.href = '/auth/login-fixed.html';
        return false;
    }
    
    // Redirect to dashboard if authenticated and on auth page
    if (auth.currentUser && isAuthPage) {
        window.location.href = 'dashboard.html';
        return false;
    }
    
    return !!auth.currentUser;
}

// Initialize authentication state
function initializeAuthState() {
    // Check auth state first
    if (!checkAuthState()) return;
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL
            }));
            
            await loadUserData();
            updateUI();
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/auth/login-fixed.html';
        }
    });
}

// Set up real-time listeners
function setupRealtimeListeners() {
    // Listen for announcements
    if (isTeacher) {
        const announcementsQuery = query(
            collection(db, 'announcements'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        
        const unsubscribeAnnouncements = onSnapshot(announcementsQuery, (snapshot) => {
            const announcements = [];
            snapshot.forEach(doc => {
                announcements.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            updateAnnouncementsUI(announcements);
        });
        
        unsubscribeCallbacks.push(unsubscribeAnnouncements);
    }
    
    // Listen for test updates
    const testsQuery = isTeacher 
        ? query(collection(db, 'tests'), where('teacherId', '==', currentUser.uid))
        : query(collection(db, 'tests'), where('isActive', '==', true));
    
    const unsubscribeTests = onSnapshot(testsQuery, (snapshot) => {
        const tests = [];
        snapshot.forEach(doc => {
            tests.push({
                id: doc.id,
                ...doc.data()
            });
        });
        updateTestsUI(tests);
    });
    
    unsubscribeCallbacks.push(unsubscribeTests);
}

// Update announcements UI
function updateAnnouncementsUI(announcements) {
    if (!recentActivityList) return;
    
    if (announcements.length === 0) {
        recentActivityList.innerHTML = '<p class="text-muted">No recent announcements</p>';
        return;
    }
    
    recentActivityList.innerHTML = announcements.map(announcement => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas fa-bullhorn"></i>
            </div>
            <div class="activity-details">
                <h4>${announcement.title}</h4>
                <p>${truncate(announcement.content, 100)}</p>
                <small class="text-muted">${timeAgo(announcement.createdAt)}</small>
            </div>
        </div>
    `).join('');
}

// Update tests UI
function updateTestsUI(tests) {
    if (isTeacher) {
        updateTeacherTestsUI(tests);
    } else {
        updateStudentTestsUI(tests);
    }
}

// Update teacher's tests UI
function updateTeacherTestsUI(tests) {
    // Implementation for teacher's test list
    if (!availableTestsGrid) return;
    
    if (tests.length === 0) {
        availableTestsGrid.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body text-center py-5">
                        <i class="fas fa-tasks fa-3x text-muted mb-3"></i>
                        <h5>No tests created yet</h5>
                        <p class="text-muted">Click the "Create Test" button to add a new test</p>
                        <button class="btn btn-primary" id="create-test-btn">
                            <i class="fas fa-plus"></i> Create Test
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('create-test-btn')?.addEventListener('click', () => {
            window.location.href = 'create-test.html';
        });
        
        return;
    }
    
    availableTestsGrid.innerHTML = tests.map(test => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <h5 class="card-title mb-0">${test.title}</h5>
                        <span class="badge ${test.isActive ? 'bg-success' : 'bg-secondary'}">
                            ${test.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <p class="card-text text-muted small">
                        ${test.description || 'No description provided.'}
                    </p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <div>
                            <span class="badge bg-light text-dark me-2">
                                <i class="fas fa-users me-1"></i> ${test.participants || 0}
                            </span>
                            <span class="badge bg-light text-dark">
                                <i class="fas fa-chart-line me-1"></i> ${test.averageScore || 0}%
                            </span>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" 
                                data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item" href="view-test.html?id=${test.id}">
                                        <i class="fas fa-eye me-2"></i>View
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="edit-test.html?id=${test.id}">
                                        <i class="fas fa-edit me-2"></i>Edit
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" href="test-results.html?id=${test.id}">
                                        <i class="fas fa-chart-bar me-2"></i>Results
                                    </a>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <button class="dropdown-item text-danger" onclick="deleteTest('${test.id}')">
                                        <i class="fas fa-trash me-2"></i>Delete
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <small class="text-muted">
                        Created ${timeAgo(test.createdAt)} • ${test.questions?.length || 0} questions
                    </small>
                </div>
            </div>
        </div>
    `).join('');
}

// Update student's tests UI
function updateStudentTestsUI(tests) {
    if (!availableTestsGrid) return;
    
    if (tests.length === 0) {
        availableTestsGrid.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body text-center py-5">
                        <i class="fas fa-tasks fa-3x text-muted mb-3"></i>
                        <h5>No tests available</h5>
                        <p class="text-muted">Check back later for new tests</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    availableTestsGrid.innerHTML = tests.map(test => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">${test.title}</h5>
                    <p class="card-text text-muted small">
                        ${test.description || 'No description provided.'}
                    </p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="badge bg-light text-dark">
                            <i class="far fa-clock me-1"></i> ${test.duration || 30} mins
                        </span>
                        <div>
                            <button class="btn btn-sm btn-primary start-test" 
                                data-test-id="${test.id}">
                                Start Test
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <small class="text-muted">
                        ${test.questions?.length || 0} questions • ${test.passingScore || 0}% to pass
                    </small>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add event listeners to start test buttons
    document.querySelectorAll('.start-test').forEach(button => {
        button.addEventListener('click', (e) => {
            const testId = e.target.closest('.start-test').dataset.testId;
            window.location.href = `take-test.html?id=${testId}`;
        });
    });
}

// Load dashboard data
async function loadDashboardData() {
    try {
        if (isTeacher) {
            // Load teacher's students
            const students = await ProfileManager.getAllStudents();
            updateStudentsTable(students);
            
            // Load teacher's announcements
            const announcements = await AnnouncementManager.getAnnouncementsByAuthor(currentUser.uid);
            updateAnnouncementsUI(announcements);
        } else {
            // Load student's test history
            const testHistory = await TestManager.getStudentAttempts(currentUser.uid);
            updateTestHistoryUI(testHistory);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
    }
}

// Update test history UI
function updateTestHistoryUI(attempts) {
    if (!testHistoryGrid) return;
    
    if (attempts.length === 0) {
        testHistoryGrid.innerHTML = `
            <div class="col-12">
                <div class="card">
                    <div class="card-body text-center py-5">
                        <i class="fas fa-history fa-3x text-muted mb-3"></i>
                        <h5>No test history</h5>
                        <p class="text-muted">Your completed tests will appear here</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    testHistoryGrid.innerHTML = attempts.map(attempt => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title mb-0">${attempt.testTitle || 'Test'}</h5>
                        <span class="badge ${attempt.isGraded ? 'bg-success' : 'bg-warning'}">
                            ${attempt.isGraded ? 'Graded' : 'Pending'}
                        </span>
                    </div>
                    ${attempt.isGraded ? `
                        <div class="progress mb-3" style="height: 10px;">
                            <div class="progress-bar bg-success" 
                                 role="progressbar" 
                                 style="width: ${attempt.score}%" 
                                 aria-valuenow="${attempt.score}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span>Score:</span>
                            <strong>${attempt.score}%</strong>
                        </div>
                    ` : ''}
                    <div class="d-flex justify-content-between text-muted small">
                        <span>Submitted: ${timeAgo(attempt.submittedAt)}</span>
                        ${attempt.isGraded ? `
                            <span>Graded: ${timeAgo(attempt.gradedAt || attempt.submittedAt)}</span>
                        ` : ''}
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <a href="test-result.html?id=${attempt.id}" class="btn btn-sm btn-outline-primary w-100">
                        <i class="fas fa-eye me-1"></i> View Details
                    </a>
                </div>
            </div>
        </div>
    `).join('');
}

// Initialize profile UI
function initializeProfileUI() {
    // Profile picture upload
    const profilePictureInput = document.getElementById('profile-picture');
    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                // Show loading state
                const submitBtn = document.querySelector('#profile-form button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Uploading...';
                
                // Upload the file
                await ProfileManager.uploadProfilePicture(file);
                
                // Update UI
                const profileImg = document.getElementById('profile-preview');
                if (profileImg) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        profileImg.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                }
                
                showNotification('Profile picture updated successfully', 'success');
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                showNotification('Error uploading profile picture', 'error');
            } finally {
                // Reset button state
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    }
    
    // Profile form submission
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const submitBtn = profileForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
                
                const formData = new FormData(profileForm);
                const profileData = {
                    displayName: formData.get('displayName'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    bio: formData.get('bio'),
                    updatedAt: new Date()
                };
                
                // Add role-specific fields
                if (isTeacher) {
                    profileData.role = 'teacher';
                    profileData.department = formData.get('department');
                    profileData.subjects = formData.get('subjects');
                } else {
                    profileData.role = 'student';
                    profileData.studentId = formData.get('studentId');
                    profileData.grade = formData.get('grade');
                    profileData.parentName = formData.get('parentName');
                    profileData.parentEmail = formData.get('parentEmail');
                    profileData.parentPhone = formData.get('parentPhone');
                }
                
                // Handle profile picture upload if changed
                const fileInput = document.getElementById('profile-picture');
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const storageRef = ref(storage, `profile-pictures/${currentUser.uid}`);
                    await uploadBytes(storageRef, file);
                    const photoURL = await getDownloadURL(storageRef);
                    profileData.photoURL = photoURL;
                    
                    // Update auth profile
                    await updateProfile(auth.currentUser, { photoURL });
                    
                    // Update UI
                    const profilePreview = document.getElementById('profile-preview');
                    const headerAvatar = document.getElementById('header-avatar');
                    if (profilePreview) profilePreview.src = photoURL;
                    if (headerAvatar) headerAvatar.src = photoURL;
                }
                
                // Update user profile in Firestore
                await UserService.updateUserProfile(currentUser.uid, profileData);
                
                // Update UI with new profile data
                updateUserUI(await UserService.getUserProfile(currentUser.uid));
                
                showNotification('Profile updated successfully', 'success');
                
                // Close modal if open
                const profileModal = document.getElementById('profileModal');
                if (profileModal) {
                    const modal = bootstrap.Modal.getInstance(profileModal);
                    if (modal) modal.hide();
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                showNotification('Error updating profile: ' + error.message, 'error');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }
            }
        });
    }
}

// Clean up event listeners and subscriptions
function cleanup() {
    unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    unsubscribeCallbacks = [];
}

// Load user data from Firestore
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userDoc = await UserService.getUser(currentUser.uid);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            isTeacher = userData.role === 'teacher';
            
            // Store user data in localStorage for quick access
            localStorage.setItem('userRole', isTeacher ? 'teacher' : 'student');
            localStorage.setItem('userData', JSON.stringify(userData));
            
            // Update UI based on role
            updateUIForRole();
            
            // Load role-specific data
            if (isTeacher) {
                await this.loadTeacherData();
            } else {
                await this.loadStudentData();
            }
            
            return userData;
        } else {
            // If user document doesn't exist, create it
            console.log('No user document found, creating one...');
            await UserService.createUser({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                photoURL: currentUser.photoURL || '',
                role: 'student', // Default role
                createdAt: new Date().toISOString()
            });
            
            // Redirect to profile completion if needed
            window.location.href = 'profile.html?setup=1';
            return null;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data. Please try again.', 'error');
        return null;
    }
}

// Update UI based on user role and screen size
function updateUIForRole() {
    const teacherSections = document.querySelectorAll('.teacher-only');
    const studentSections = document.querySelectorAll('.student-only');
    const sidebarLinks = document.querySelectorAll('.nav-item');
    
    if (isTeacher) {
        // Show teacher sections and hide student sections
        teacherSections.forEach(section => section.style.display = 'block');
        studentSections.forEach(section => section.style.display = 'none');
        
        // Update active navigation
        sidebarLinks.forEach(link => {
            if (link.dataset.role === 'student') {
                link.style.display = 'none';
            } else {
                link.style.display = 'flex';
            }
        });
        
        // Default to first teacher section if current section is student-only
        const currentSection = document.querySelector('.content-section.active');
        if (currentSection && currentSection.classList.contains('student-only')) {
            showSection('overview');
        }
    } else {
        // Show student sections and hide teacher sections
        teacherSections.forEach(section => section.style.display = 'none');
        studentSections.forEach(section => section.style.display = 'block');
        
        // Update active navigation
        sidebarLinks.forEach(link => {
            if (link.dataset.role === 'teacher') {
                link.style.display = 'none';
            } else {
                link.style.display = 'flex';
            }
        });
        
        // Default to first student section if current section is teacher-only
        const currentSection = document.querySelector('.content-section.active');
        if (currentSection && currentSection.classList.contains('teacher-only')) {
            showSection('my-tests');
        }
    }
    
    // Update UI based on screen size
    updateResponsiveUI();
}

// Update UI based on screen size
function updateResponsiveUI() {
    const isMobile = window.innerWidth < 768;
    document.body.classList.toggle('mobile-view', isMobile);
    
    if (isMobile) {
        // Close sidebar by default on mobile
        document.body.classList.remove('sidebar-open');
    } else {
        // Show sidebar by default on desktop
        document.body.classList.add('sidebar-open');
    }
}

// Load teacher-specific data
async function loadTeacherData() {
    try {
        // Load students
        const studentsSnapshot = await firebase.firestore()
            .collection('users')
            .where('role', '==', 'student')
            .get();
            
        updateStudentsTable(studentsSnapshot.docs);
        
        // Update dashboard stats
        document.getElementById('total-students').textContent = studentsSnapshot.size;
        
        // Load tests
        const testsSnapshot = await firebase.firestore()
            .collection('tests')
            .where('teacherId', '==', currentUser.uid)
            .get();
            
        const activeTests = testsSnapshot.docs.filter(doc => doc.data().status === 'active');
        document.getElementById('active-tests').textContent = activeTests.length;
        
    } catch (error) {
        console.error('Error loading teacher data:', error);
        showNotification('Error loading teacher data', 'error');
    }
}

// Load student-specific data
async function loadStudentData() {
    try {
        // Load available tests
        const testsSnapshot = await firebase.firestore()
            .collection('tests')
            .where('status', '==', 'active')
            .get();
            
        updateAvailableTests(testsSnapshot.docs);
        
        // Load test history
        const testHistory = await firebase.firestore()
            .collection('testAttempts')
            .where('studentId', '==', currentUser.uid)
            .orderBy('submittedAt', 'desc')
            .get();
            
        updateTestHistory(testHistory.docs);
        
        // Update dashboard stats
        const pendingTests = testsSnapshot.docs.filter(doc => {
            // Check if student hasn't taken this test yet
            return !testHistory.docs.some(attempt => attempt.data().testId === doc.id);
        });
        
        document.getElementById('pending-tests').textContent = pendingTests.length;
        document.getElementById('completed-tests').textContent = testHistory.size;
        
    } catch (error) {
        console.error('Error loading student data:', error);
        showNotification('Error loading student data', 'error');
    }
}

// Update students table
function updateStudentsTable(students) {
    studentsTableBody.innerHTML = '';
    
    students.forEach(doc => {
        const student = doc.data();
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${student.displayName || 'No Name'}</td>
            <td>${student.email || 'No Email'}</td>
            <td>${student.class || 'N/A'}</td>
            <td><span class="status-badge ${student.active ? 'active' : 'inactive'}">
                ${student.active ? 'Active' : 'Inactive'}
            </span></td>
            <td class="actions">
                <button class="btn-icon" data-action="message" data-id="${doc.id}" title="Message">
                    <i class="fas fa-envelope"></i>
                </button>
                <button class="btn-icon" data-action="deactivate" data-id="${doc.id}" title="Deactivate">
                    <i class="fas fa-user-slash"></i>
                </button>
            </td>
        `;
        
        studentsTableBody.appendChild(row);
    });
}

// Update available tests for students
function updateAvailableTests(tests) {
    availableTestsGrid.innerHTML = '';
    
    if (tests.length === 0) {
        availableTestsGrid.innerHTML = '<p>No tests available at the moment.</p>';
        return;
    }
    
    tests.forEach(doc => {
        const test = doc.data();
        const testCard = document.createElement('div');
        testCard.className = 'test-card';
        testCard.innerHTML = `
            <div class="test-card-header">
                <h3 class="test-card-title">${test.title}</h3>
                <div class="test-card-meta">
                    <span><i class="far fa-clock"></i> ${test.duration} min</span>
                    <span><i class="far fa-question-circle"></i> ${test.questions?.length || 0} questions</span>
                </div>
            </div>
            <div class="test-card-body">
                <p>${test.description || 'No description provided.'}</p>
            </div>
            <div class="test-card-actions">
                <button class="btn btn-primary start-test" data-test-id="${doc.id}">
                    Start Test
                </button>
            </div>
        `;
        
        availableTestsGrid.appendChild(testCard);
    });
}

// Update test history
function updateTestHistory(attempts) {
    testHistoryGrid.innerHTML = '';
    
    if (attempts.length === 0) {
        testHistoryGrid.innerHTML = '<p>No test history available.</p>';
        return;
    }
    
    // We'll implement this after setting up test functionality
    // For now, just show a message
    testHistoryGrid.innerHTML = `
        <div class="info-message">
            <i class="fas fa-info-circle"></i>
            <p>Your test history will appear here after you complete tests.</p>
        </div>
    `;
}

// Load recent activity
async function loadRecentActivity() {
    try {
        let activityQuery;
        
        if (isTeacher) {
            // For teachers, show recent student submissions and announcements
            activityQuery = firebase.firestore()
                .collection('activity')
                .where('teacherId', '==', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(5);
        } else {
            // For students, show their recent activity and announcements
            activityQuery = firebase.firestore()
                .collection('activity')
                .where('studentId', '==', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(5);
        }
        
        const activitySnapshot = await activityQuery.get();
        updateActivityList(activitySnapshot.docs);
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Update activity list
function updateActivityList(activities) {
    recentActivityList.innerHTML = '';
    
    if (activities.length === 0) {
        recentActivityList.innerHTML = '<p>No recent activity.</p>';
        return;
    }
    
    activities.forEach(doc => {
        const activity = doc.data();
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        let icon = '';
        let text = '';
        
        switch(activity.type) {
            case 'test_submission':
                icon = '<i class="fas fa-check-circle"></i>';
                text = `Test "${activity.testTitle}" submitted`;
                break;
            case 'test_created':
                icon = '<i class="fas fa-plus-circle"></i>';
                text = `New test created: "${activity.testTitle}"`;
                break;
            case 'announcement':
                icon = '<i class="fas fa-bullhorn"></i>';
                text = `New announcement: "${activity.title}"`;
                break;
            default:
                icon = '<i class="fas fa-info-circle"></i>';
                text = 'New activity';
        }
        
        activityItem.innerHTML = `
            <div class="activity-icon">${icon}</div>
            <div class="activity-details">
                <p class="activity-text">${text}</p>
                <p class="activity-time">${formatTimeAgo(activity.timestamp?.toDate())}</p>
            </div>
        `;
        
        recentActivityList.appendChild(activityItem);
    });
}

// Format time as "X time ago"
function formatTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
    
    return 'just now';
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    mainNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');
            showSection(sectionId);
            
            // Update active state
            mainNavItems.forEach(navItem => navItem.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Add question
    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', addQuestionField);
    }
    
    // Add student modal
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', () => {
            addStudentModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Close modal
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            addStudentModal.classList.remove('show');
            document.body.style.overflow = '';
        });
    });
    
    // Add student form
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', handleAddStudent);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === addStudentModal) {
            addStudentModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
    
    // Start test button (delegated event)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.start-test')) {
            const testId = e.target.closest('.start-test').getAttribute('data-test-id');
            startTest(testId);
        }
    });
}

// Show section
function showSection(sectionId) {
    contentSections.forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
}

// Handle logout
function handleLogout() {
    signOut(auth).then(() => {
        // Clear local storage and session data
        localStorage.removeItem('currentUser');
        sessionStorage.clear();
        
        // Clear any ongoing operations
        cleanup();
        
        // Redirect to login page with a fresh state
        window.location.href = 'index.html?logout=true';
    }).catch((error) => {
        console.error('Error signing out:', error);
        showNotification('Error signing out. Please try again.', 'error');
    });
}

// Initialize profile picture upload
document.getElementById('profile-picture')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('profile-preview');
        if (preview) {
            preview.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
});

// Add question field
function addQuestionField() {
    const questionIndex = document.querySelectorAll('.question-item').length;
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-item';
    questionDiv.innerHTML = `
        <div class="form-group">
            <label>Question ${questionIndex + 1}</label>
            <input type="text" placeholder="Enter question" class="question-text" required>
        </div>
        <div class="form-group">
            <label>Options</label>
            <div class="options-container">
                <div class="option-item">
                    <input type="radio" name="correct-${questionIndex}" value="0" required>
                    <input type="text" placeholder="Option 1" class="option-text" required>
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionIndex}" value="1" required>
                    <input type="text" placeholder="Option 2" class="option-text" required>
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionIndex}" value="2" required>
                    <input type="text" placeholder="Option 3" class="option-text">
                </div>
                <div class="option-item">
                    <input type="radio" name="correct-${questionIndex}" value="3" required>
                    <input type="text" placeholder="Option 4" class="option-text">
                </div>
            </div>
        </div>
        <button type="button" class="btn-text remove-question">
            <i class="fas fa-trash"></i> Remove Question
        </button>
    `;
    
    questionsContainer.appendChild(questionDiv);
    
    // Add event listener for remove button
    const removeBtn = questionDiv.querySelector('.remove-question');
    removeBtn.addEventListener('click', () => {
        questionDiv.remove();
        updateQuestionNumbers();
    });
}

// Update question numbers
function updateQuestionNumbers() {
    const questionItems = document.querySelectorAll('.question-item');
    questionItems.forEach((item, index) => {
        const label = item.querySelector('label');
        if (label) {
            label.textContent = `Question ${index + 1}`;
        }
    });
}

// Handle add student
async function handleAddStudent(e) {
    e.preventDefault();
    
    const name = document.getElementById('student-name').value.trim();
    const email = document.getElementById('student-email').value.trim();
    const studentClass = document.getElementById('student-class').value.trim();
    
    if (!name || !email || !studentClass) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    try {
        // In a real app, you would send an invitation email or create a user account
        // For now, we'll just show a success message
        
        // Reset form
        addStudentForm.reset();
        addStudentModal.classList.remove('show');
        document.body.style.overflow = '';
        
        showNotification('Student added successfully!', 'success');
        
        // Refresh students list
        await loadTeacherData();
        
    } catch (error) {
        console.error('Error adding student:', error);
        showNotification('Error adding student. Please try again.', 'error');
    }
}

// Start test
function startTest(testId) {
    // In a real app, you would navigate to the test taking interface
    // For now, we'll just show a message
    showNotification('Starting test...', 'info');
    // In the actual implementation, you would redirect to the test page:
    // window.location.href = `test.html?id=${testId}`;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

// Setup mobile menu
function setupMobileMenu() {
    mobileMenuToggle.className = 'mobile-menu-toggle';
    mobileMenuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    document.querySelector('.top-bar').prepend(mobileMenuToggle);
    
    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    // Close menu when clicking on a nav item (for mobile)
    mainNavItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('active');
            }
        });
    });
}

// Update UI based on screen size
function updateUI() {
    if (window.innerWidth > 1024) {
        sidebar.classList.remove('active');
    }
}

// Handle window resize
window.addEventListener('resize', updateUI);

// Initialize UI
updateUI();
