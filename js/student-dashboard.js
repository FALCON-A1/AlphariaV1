// Student Dashboard JavaScript

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check authentication and role
        const user = await checkAuth();
        if (!user) {
            window.location.href = '/auth/login-fixed.html';
            return;
        }

        // Initialize the dashboard
        await initStudentDashboard(user.uid);
        
        // Initialize sidebar navigation
        initSidebar();
        
        // Show the overview section by default
        showSection('overview');
        
    } catch (error) {
        console.error('Error initializing student dashboard:', error);
        showError('Failed to initialize dashboard. Please try again.');
    }
});

// Check if user is authenticated and is a student
async function checkAuth() {
    try {
        const user = await new Promise((resolve) => {
            const unsubscribe = window.alphariaFirebase.onAuthStateChanged(
                window.alphariaFirebase.auth, 
                (user) => {
                    unsubscribe();
                    resolve(user);
                }
            );
        });

        if (!user) return null;

        // Get user profile to check role
        const userDoc = await window.alphariaFirebase.getDoc(
            window.alphariaFirebase.doc(window.alphariaFirebase.db, 'users', user.uid)
        );
        
        if (!userDoc.exists() || userDoc.data().role !== 'student') {
            window.location.href = '/dashboard.html';
            return null;
        }

        return { ...user, ...userDoc.data() };
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
}

// Initialize the student dashboard
async function initStudentDashboard(studentId) {
    try {
        // Show loading state
        document.body.classList.add('loading');
        
        // Load student data
        const studentDoc = await window.alphariaFirebase.getDoc(
            window.alphariaFirebase.doc(window.alphariaFirebase.db, 'students', studentId)
        );
        
        if (!studentDoc.exists()) {
            throw new Error('Student data not found');
        }

        const studentData = studentDoc.data();
        
        // Update UI with student data
        updateStudentProfile(studentData);
        
        // Load student's tests and progress
        await Promise.all([
            loadUpcomingTests(studentId),
            loadRecentActivity(studentId),
            loadProgressStats(studentId)
        ]);

        // Set up event listeners
        setupEventListeners();
        
        // Hide loading state
        document.body.classList.remove('loading');

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError('Failed to load dashboard. Please try again.');
    }
}

// Initialize sidebar navigation
function initSidebar() {
    const navItems = document.querySelectorAll('.main-nav li');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            navItems.forEach(navItem => navItem.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            // Show the corresponding section
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
        });
    });
    
    // Profile dropdown toggle
    const profileDropdown = document.querySelector('.profile-dropdown');
    if (profileDropdown) {
        profileDropdown.addEventListener('click', function(e) {
            this.classList.toggle('active');
            e.stopPropagation();
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        if (profileDropdown) {
            profileDropdown.classList.remove('active');
        }
    });
}

// Show a specific section and hide others
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the selected section
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
    }
}

// Update student profile section
function updateStudentProfile(studentData) {
    // Update welcome message
    const welcomeElement = document.querySelector('.welcome-content h3 .user-name');
    if (welcomeElement) {
        welcomeElement.textContent = studentData.displayName || 'Student';
    }
    
    // Update profile picture if available
    const profileImages = document.querySelectorAll('.profile-img');
    if (studentData.photoURL) {
        profileImages.forEach(img => {
            img.src = studentData.photoURL;
        });
    }
    
    // Update profile name in sidebar
    const profileName = document.querySelector('.profile-name');
    if (profileName) {
        profileName.textContent = studentData.displayName || 'Student';
    }
    
    // Update grade level if available
    if (studentData.grade) {
        const gradeSelect = document.getElementById('grade');
        if (gradeSelect) {
            gradeSelect.value = studentData.grade;
        }
    }
    
    // Update school if available
    if (studentData.school) {
        const schoolInput = document.getElementById('school');
        if (schoolInput) {
            schoolInput.value = studentData.school;
        }
    }
}

// Load upcoming tests
async function loadUpcomingTests(studentId) {
    try {
        const testsRef = window.alphariaFirebase.collection(window.alphariaFirebase.db, 'tests');
        const q = window.alphariaFirebase.query(
            testsRef,
            window.alphariaFirebase.where('assignedStudents', 'array-contains', studentId),
            window.alphariaFirebase.where('dueDate', '>=', new Date()),
            window.alphariaFirebase.orderBy('dueDate'),
            window.alphariaFirebase.limit(5)
        );

        const querySnapshot = await window.alphariaFirebase.getDocs(q);
        const container = document.getElementById('upcoming-tests');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<div class="no-tests">No upcoming tests. Check back later!</div>';
            return;
        }

        container.innerHTML = ''; // Clear existing
        
        querySnapshot.forEach(doc => {
            const test = { id: doc.id, ...doc.data() };
            const testElement = createTestCard(test);
            container.appendChild(testElement);
        });
    } catch (error) {
        console.error('Error loading upcoming tests:', error);
        showError('Failed to load upcoming tests');
    }
}

// Load recent activity
async function loadRecentActivity(studentId) {
    try {
        const activityRef = window.alphariaFirebase.collection('testAttempts');
        const q = window.alphariaFirebase.query(
            activityRef,
            window.alphariaFirebase.where('studentId', '==', studentId),
            window.alphariaFirebase.orderBy('completedAt', 'desc'),
            window.alphariaFirebase.limit(5)
        );

        const querySnapshot = await window.alphariaFirebase.getDocs(q);
        const container = document.getElementById('recent-activity');
        
        if (querySnapshot.empty) {
            container.innerHTML = '<div class="no-activity">No recent activity</div>';
            return;
        }

        container.innerHTML = ''; // Clear existing
        
        for (const doc of querySnapshot.docs) {
            const attempt = { id: doc.id, ...doc.data() };
            // Get test details
            const testDoc = await window.alphariaFirebase.getDoc(
                window.alphariaFirebase.doc(window.alphariaFirebase.db, 'tests', attempt.testId)
            );
            
            if (testDoc.exists()) {
                const testData = testDoc.data();
                const activityItem = createActivityItem(attempt, testData);
                container.appendChild(activityItem);
            }
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
        showError('Failed to load recent activity');
    }
}

// Load progress statistics
async function loadProgressStats(studentId) {
    try {
        const progressRef = window.alphariaFirebase.doc(
            window.alphariaFirebase.db, 'studentProgress', studentId
        );
        
        const progressDoc = await window.alphariaFirebase.getDoc(progressRef);
        
        if (progressDoc.exists()) {
            const progressData = progressDoc.data();
            updateProgressCharts(progressData);
        }
    } catch (error) {
        console.error('Error loading progress stats:', error);
    }
function createTestCard(test) {
    const dueDate = test.dueDate?.toDate ? test.dueDate.toDate() : new Date(test.dueDate);
    const formattedDate = formatDate(dueDate);
    
    const card = document.createElement('div');
    card.className = 'test-card';
    card.innerHTML = `
        <div class="test-card-header">
            <h4>${test.title || 'Untitled Test'}</h4>
            <span class="test-due">Due: ${formattedDate}</span>
        </div>
        <div class="test-card-body">
            <div class="test-info">
                <span class="test-subject">${test.subject || 'General'}</span>
                <span class="test-questions">${test.questions?.length || 0} questions</span>
            </div>
            <button class="btn btn-primary btn-sm start-test" data-test-id="${test.id}">
                Start Test
            </button>
        </div>
    `;
    
    return card;
}

// Update progress charts with student data
function updateProgressCharts(progressData) {
    // Update the progress circle
    const progressCircle = document.querySelector('.progress-circle-fill');
    if (progressCircle) {
        const progress = Math.min(100, Math.max(0, progressData.averageScore || 0));
        progressCircle.style.setProperty('--progress', progress);
        progressCircle.innerHTML = `<span>${Math.round(progress)}%</span>`;
    }
    
    // Update the progress stats
    updateProgressStatsUI(progressData);
    
    // Initialize or update the test history chart if the element exists
    const ctx = document.getElementById('progressChart');
    if (ctx && progressData.scores.length > 0) {
        updateTestHistoryChart(progressData);
    }
}

// Update progress statistics in the UI
function updateProgressStatsUI(progressData) {
    // Update completed tests
    const completedEl = document.querySelector('.progress-stat:nth-child(1) .stat-value');
    if (completedEl) {
        completedEl.textContent = progressData.completed || '0';
    }
    
    // Update in-progress tests
    const inProgressEl = document.querySelector('.progress-stat:nth-child(2) .stat-value');
    if (inProgressEl) {
        inProgressEl.textContent = progressData.inProgress || '0';
    }
    
    // Update upcoming tests
    const upcomingEl = document.querySelector('.progress-stat:nth-child(3) .stat-value');
    if (upcomingEl) {
        upcomingEl.textContent = progressData.upcoming || '0';
    }
    
    // Update progress bars in the progress section
    const progressBars = {
        'tests-completed': (progressData.completed / (progressData.completed + progressData.upcoming)) * 100 || 0,
        'average-score': progressData.averageScore || 0,
        'improvement': progressData.improvement || 0
    };
    
    Object.entries(progressBars).forEach(([id, value]) => {
        const progressBar = document.querySelector(`#${id} .progress-bar`);
        if (progressBar) {
            progressBar.style.width = `${value}%`;
            progressBar.setAttribute('aria-valuenow', value);
        }
    });
}

// Update test history chart
function updateTestHistoryChart(progressData) {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (window.progressChart) {
        window.progressChart.destroy();
    }
    
    // Prepare data for the chart
    const labels = progressData.testNames.map((_, index) => `Test ${index + 1}`);
    const scores = progressData.scores.map(score => Math.round(score));
    
    // Create the chart
    window.progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Test Scores',
                data: scores,
                borderColor: '#10b981', // Green color for student dashboard
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true,
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#fff',
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#10b981',
                pointHoverBorderColor: '#fff',
                pointHitRadius: 10,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1f2937',
                    titleFont: { size: 14, family: '"Poppins", sans-serif' },
                    bodyFont: { size: 14, family: '"Poppins", sans-serif', weight: '500' },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Score: ${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Create activity item element for recent activity
function createActivityItem(attempt) {
    const item = document.createElement('div');
    item.className = 'activity-item d-flex align-items-start mb-3';
    
    const testName = attempt.test?.title || 'a test';
    const score = attempt.score !== undefined ? `${Math.round(attempt.score)}%` : 'Not graded';
    const date = attempt.completedAt ? formatDate(attempt.completedAt.toDate(), { month: 'short', day: 'numeric' }) : 'Today';
    
    // Determine icon and color based on score
    let iconClass = 'fa-question-circle';
    let iconColor = 'text-primary';
    
    if (attempt.status === 'completed') {
        iconClass = attempt.score >= 70 ? 'fa-check-circle' : 'fa-exclamation-circle';
        iconColor = attempt.score >= 70 ? 'text-success' : 'text-warning';
    } else if (attempt.status === 'in-progress') {
        iconClass = 'fa-sync-alt fa-spin';
        iconColor = 'text-info';
    }
    
    item.innerHTML = `
        <div class="flex-shrink-0 me-3">
            <div class="activity-icon ${iconColor}">
                <i class="fas ${iconClass}"></i>
            </div>
        </div>
        <div class="flex-grow-1">
            <div class="d-flex justify-content-between">
                <h6 class="mb-1">${testName}</h6>
                <small class="text-muted">${date}</small>
            </div>
            <p class="mb-1">${attempt.status === 'completed' ? 'Completed' : 'In Progress'}</p>
            <div class="d-flex justify-content-between align-items-center">
                <div class="progress" style="width: 100%; max-width: 200px; height: 6px;">
                    <div class="progress-bar ${attempt.status === 'completed' ? 'bg-success' : 'bg-info'}" 
                         role="progressbar" 
                         style="width: ${attempt.status === 'completed' ? '100' : '50'}%" 
                         aria-valuenow="${attempt.status === 'completed' ? '100' : '50'}" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                    </div>
                </div>
                <small class="ms-2">${attempt.status === 'completed' ? score : 'In Progress'}</small>
            </div>
        </div>
    `;
    
    return item;
}

// Format date
function formatDate(date, options = {}) {
    if (!date) return 'N/A';
    
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    
    if (options.time) {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        if (date.toDate) {
            date = date.toDate();
        } else if (typeof date === 'string') {
            date = new Date(date);
        }
        
        return date.toLocaleDateString('en-US', mergedOptions);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
}

// Set up event listeners
function setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await window.alphariaFirebase.signOut(window.alphariaFirebase.auth);
                window.location.href = '/auth/login-fixed.html';
            } catch (error) {
                console.error('Error signing out:', error);
                showError('Failed to sign out. Please try again.');
            }
        });
    }
    
    // Settings form submission
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const user = window.alphariaFirebase.auth.currentUser;
            if (!user) return;
            
            try {
                const displayName = document.getElementById('displayName')?.value;
                const grade = document.getElementById('grade')?.value;
                const school = document.getElementById('school')?.value;
                
                // Update user profile in Firestore
                await window.alphariaFirebase.updateDoc(
                    window.alphariaFirebase.doc(window.alphariaFirebase.db, 'students', user.uid),
                    {
                        displayName,
                        grade,
                        school,
                        updatedAt: window.alphariaFirebase.serverTimestamp()
                    }
                );
                
                // Show success message
                showToast('Profile updated successfully!', 'success');
                
                // Update the UI
                const profileName = document.querySelector('.profile-name');
                if (profileName && displayName) {
                    profileName.textContent = displayName;
                }
                
                const welcomeName = document.querySelector('.welcome-content h3 .user-name');
                if (welcomeName && displayName) {
                    welcomeName.textContent = displayName;
                }
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showError('Failed to update profile. Please try again.');
            }
        });
    }
    
    // Quick action buttons
    document.addEventListener('click', (e) => {
        // Start test button
        if (e.target.closest('.start-test')) {
            const testId = e.target.closest('.start-test').getAttribute('data-test-id');
            if (testId) {
                startTest(testId);
            }
        }
        
        // View resources button
        if (e.target.closest('#view-resources-btn')) {
            // Navigate to resources section
            const resourcesNav = document.querySelector('.main-nav li[data-section="resources"]');
            if (resourcesNav) {
                resourcesNav.click();
            }
        }
        
        // Ask question button
        if (e.target.closest('#ask-question-btn')) {
            // Implement ask question functionality
            showToast('Feature coming soon!', 'info');
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.profile-dropdown')) {
            const dropdown = document.querySelector('.profile-dropdown');
            if (dropdown) {
                dropdown.classList.remove('active');
            }
        }
    });
}

// Start a test
function startTest(testId) {
    if (!testId) {
        showError('Invalid test. Please try again.');
        return;
    }
    window.location.href = `/test.html?id=${testId}`;
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast show align-items-center text-white bg-${type} border-0`;
    toast.role = 'alert';
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    const toastBody = document.createElement('div');
    toastBody.className = 'd-flex align-items-center';
    
    const toastContent = document.createElement('div');
    toastContent.className = 'toast-body';
    toastContent.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn-close btn-close-white me-2 m-auto';
    closeButton.setAttribute('data-bs-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    
    toastBody.appendChild(toastContent);
    toastBody.appendChild(closeButton);
    toast.appendChild(toastBody);
    
    // Add toast to container
    toastContainer.appendChild(toast);
    
    // Auto-remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
    
    // Close button functionality
    closeButton.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
}

// Show error message
function showError(message) {
    console.error(message);
    showToast(message, 'danger');
}

// Make functions available globally for testing
window.studentDashboard = {
    init: initStudentDashboard,
    loadUpcomingTests,
    loadRecentActivity,
    loadProgressStats,
    updateProgressCharts,
    showToast,
    showError
};
