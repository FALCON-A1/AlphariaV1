/**
 * Student Dashboard Functionality
 * Handles student-specific features including progress tracking and settings
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize components based on current page
    initPage();
    
    // Load user data and initialize UI
    loadUserData();
    
    // Set up event listeners
    setupEventListeners();
});

/**
 * Initialize page-specific components
 */
function initPage() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize charts if on progress page
    if (document.querySelector('#progressChart')) {
        initProgressCharts();
    }
    
    // Initialize settings tabs if on settings page
    if (document.querySelector('#profileTab')) {
        initSettingsTabs();
    }
}

/**
 * Load user data from Firebase
 */
function loadUserData() {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // Update UI with user data
            updateUserUI(user);
            
            // Load additional user data from Firestore
            loadStudentData(user.uid);
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/auth/login-fixed.html';
        }
    });
}

/**
 * Update UI with user data
 * @param {Object} user - Firebase user object
 */
function updateUserUI(user) {
    // Update username in top bar
    const usernameElements = document.querySelectorAll('.username');
    usernameElements.forEach(el => {
        el.textContent = user.displayName || 'Student';
    });
    
    // Update profile picture if available
    if (user.photoURL) {
        const profilePics = document.querySelectorAll('.profile-pic, .profile-picture');
        profilePics.forEach(img => {
            img.src = user.photoURL;
            img.alt = user.displayName || 'Profile';
        });
    }
}

/**
 * Load student-specific data from Firestore
 * @param {string} userId - Student's user ID
 */
function loadStudentData(userId) {
    const db = firebase.firestore();
    
    // Load student data
    db.collection('students').doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                const studentData = doc.data();
                updateStudentUI(studentData);
                
                // Load progress data if on progress page
                if (document.querySelector('#progressChart')) {
                    loadProgressData(userId);
                }
            }
        })
        .catch(error => {
            console.error('Error loading student data:', error);
        });
}

/**
 * Update UI with student data
 * @param {Object} studentData - Student data from Firestore
 */
function updateStudentUI(studentData) {
    // Update profile fields in settings
    if (studentData.firstName && studentData.lastName) {
        document.querySelectorAll('.student-name').forEach(el => {
            el.textContent = `${studentData.firstName} ${studentData.lastName}`;
        });
    }
    
    if (studentData.grade) {
        const gradeElement = document.getElementById('studentGrade');
        if (gradeElement) {
            gradeElement.textContent = `Grade ${studentData.grade}`;
        }
    }
    
    if (studentData.level) {
        const levelElement = document.getElementById('studentLevel');
        if (levelElement) {
            levelElement.textContent = studentData.level;
        }
    }
    
    // Update other fields as needed
    const fields = ['email', 'phone', 'bio'];
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element && studentData[field]) {
            if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                element.value = studentData[field];
            } else {
                element.textContent = studentData[field];
            }
        }
    });
}

/**
 * Load progress data for the student
 * @param {string} studentId - Student's user ID
 */
function loadProgressData(studentId) {
    const db = firebase.firestore();
    
    // Load student's test results
    db.collection('testResults')
        .where('studentId', '==', studentId)
        .orderBy('completedAt', 'desc')
        .limit(5)
        .get()
        .then(querySnapshot => {
            const activityFeed = document.querySelector('.activity-feed');
            if (activityFeed) {
                activityFeed.innerHTML = ''; // Clear existing items
                
                if (querySnapshot.empty) {
                    activityFeed.innerHTML = `
                        <div class="text-center py-4 text-muted">
                            <i class="fas fa-inbox fa-3x mb-2"></i>
                            <p>No test results found. Complete a test to see your progress.</p>
                        </div>
                    `;
                    return;
                }
                
                querySnapshot.forEach(doc => {
                    const testData = doc.data();
                    const activityItem = createActivityItem(testData);
                    activityFeed.appendChild(activityItem);
                });
            }
            
            // Load progress stats
            return db.collection('students').doc(studentId).get();
        })
        .then(studentDoc => {
            if (studentDoc.exists) {
                updateProgressStats(studentDoc.data());
            }
        })
        .catch(error => {
            console.error('Error loading progress data:', error);
        });
}

/**
 * Create an activity item for the progress feed
 * @param {Object} testData - Test result data
 * @returns {HTMLElement} Activity item element
 */
function createActivityItem(testData) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    
    const testDate = testData.completedAt ? testData.completedAt.toDate() : new Date();
    const score = testData.score || 0;
    const maxScore = testData.maxScore || 100;
    const percentage = Math.round((score / maxScore) * 100);
    
    // Determine icon and color based on score
    let icon = 'fa-question-circle';
    let colorClass = 'bg-primary';
    
    if (percentage >= 80) {
        icon = 'fa-check-circle';
        colorClass = 'bg-success';
    } else if (percentage >= 50) {
        icon = 'fa-exclamation-circle';
        colorClass = 'bg-warning';
    } else {
        icon = 'fa-times-circle';
        colorClass = 'bg-danger';
    }
    
    item.innerHTML = `
        <div class="activity-icon ${colorClass}">
            <i class="fas ${icon} text-white"></i>
        </div>
        <div class="activity-content">
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="activity-title mb-0">${testData.testName || 'Test'}</h6>
                <span class="badge ${getScoreBadgeClass(percentage)}">${percentage}%</span>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <span class="activity-meta">
                    <i class="far fa-calendar-alt me-1"></i> ${formatDate(testDate)}
                </span>
                <a href="#" class="btn btn-sm btn-outline-primary view-details" data-id="${testData.testId}">
                    View Details
                </a>
            </div>
        </div>
    `;
    
    return item;
}

/**
 * Update progress statistics on the page
 * @param {Object} studentData - Student data from Firestore
 */
function updateProgressStats(studentData) {
    // Update overall progress
    const overallProgress = studentData.overallProgress || 0;
    const progressBar = document.querySelector('#overallProgress .progress-bar');
    if (progressBar) {
        progressBar.style.width = `${overallProgress}%`;
        progressBar.setAttribute('aria-valuenow', overallProgress);
        progressBar.textContent = `${overallProgress}%`;
    }
    
    // Update stats cards
    const stats = {
        testsCompleted: studentData.testsCompleted || 0,
        averageScore: studentData.averageScore ? Math.round(studentData.averageScore) : 0,
        streakDays: studentData.streakDays || 0,
        wordsLearned: studentData.wordsLearned || 0
    };
    
    // Update each stat card
    document.querySelectorAll('.stat-item').forEach(item => {
        const statType = item.dataset.stat;
        if (stats.hasOwnProperty(statType)) {
            const valueElement = item.querySelector('h3');
            if (valueElement) {
                valueElement.textContent = statType === 'averageScore' ? 
                    `${stats[statType]}%` : stats[statType];
            }
        }
    });
    
    // Initialize or update charts
    updateProgressCharts(studentData);
}

/**
 * Initialize progress charts
 */
function initProgressCharts() {
    // Overall Progress Chart (Doughnut)
    const progressCtx = document.getElementById('progressChart');
    if (progressCtx) {
        window.progressChart = new Chart(progressCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [{
                    data: [0, 100], // Will be updated with real data
                    backgroundColor: ['#4e73df', '#e3e6f0'],
                    hoverBackgroundColor: ['#2e59d9', '#d1d3e2'],
                    hoverBorderColor: 'rgba(234, 236, 244, 1)',
                }],
            },
            options: getChartOptions('Overall Progress')
        });
    }
    
    // Performance Over Time Chart (Line)
    const performanceCtx = document.getElementById('performanceChart');
    if (performanceCtx) {
        window.performanceChart = new Chart(performanceCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [], // Will be populated with dates
                datasets: [{
                    label: 'Test Scores',
                    data: [], // Will be populated with scores
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: getChartOptions('Performance Over Time', '%')
        });
    }
}

/**
 * Update progress charts with student data
 * @param {Object} studentData - Student data from Firestore
 */
function updateProgressCharts(studentData) {
    // Update overall progress chart
    if (window.progressChart) {
        const progress = studentData.overallProgress || 0;
        window.progressChart.data.datasets[0].data = [progress, 100 - progress];
        window.progressChart.update();
    }
    
    // Update performance chart with test history
    if (window.performanceChart && studentData.testHistory) {
        const labels = [];
        const scores = [];
        
        // Sort test history by date
        const sortedHistory = [...studentData.testHistory].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        // Prepare data for the chart
        sortedHistory.forEach(test => {
            labels.push(formatDate(new Date(test.date), 'short'));
            scores.push(test.score);
        });
        
        // Update chart data
        window.performanceChart.data.labels = labels;
        window.performanceChart.data.datasets[0].data = scores;
        window.performanceChart.update();
    }
}

/**
 * Initialize settings tabs and form handling
 */
function initSettingsTabs() {
    // Show first tab by default
    const firstTab = document.querySelector('.nav-pills .nav-link');
    if (firstTab) {
        const tab = new bootstrap.Tab(firstTab);
        tab.show();
    }
    
    // Handle profile picture upload
    const profilePicUpload = document.getElementById('profilePhotoUpload');
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    
    if (changePhotoBtn && profilePicUpload) {
        changePhotoBtn.addEventListener('click', () => profilePicUpload.click());
        profilePicUpload.addEventListener('change', handleProfilePicUpload);
    }
    
    // Handle save changes button
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', saveSettings);
    }
}

/**
 * Handle profile picture upload
 * @param {Event} e - File input change event
 */
function handleProfilePicUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.match('image.*')) {
        showAlert('Please select an image file', 'danger');
        return;
    }
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showAlert('Image size should be less than 2MB', 'danger');
        return;
    }
    
    // Show loading state
    const profilePic = document.getElementById('profilePicture') || 
                      document.querySelector('.profile-picture');
    const originalSrc = profilePic?.src;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = function(e) {
        if (profilePic) {
            profilePic.src = e.target.result;
        }
    };
    reader.readAsDataURL(file);
    
    // In a real app, you would upload the file to Firebase Storage here
    // and update the user's profile with the download URL
    // For now, we'll just show a success message
    showAlert('Profile picture updated successfully', 'success');
}

/**
 * Save user settings
 */
function saveSettings() {
    // Get form data
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const phone = document.getElementById('phone')?.value || '';
    const bio = document.getElementById('bio')?.value || '';
    
    // Get notification preferences
    const notifications = {
        email: document.getElementById('emailNotifications')?.checked || false,
        reminders: document.getElementById('reminderEmails')?.checked || false,
        promotional: document.getElementById('promotionalEmails')?.checked || false
    };
    
    // Get current user
    const user = firebase.auth().currentUser;
    if (!user) {
        showAlert('You must be logged in to save settings', 'danger');
        return;
    }
    
    // Update user data in Firestore
    const db = firebase.firestore();
    const userRef = db.collection('students').doc(user.uid);
    
    // Prepare data to update
    const updates = {
        firstName,
        lastName,
        email,
        phone,
        bio,
        notifications,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Update display name if changed
    if (firstName && lastName) {
        const displayName = `${firstName} ${lastName}`.trim();
        if (displayName !== user.displayName) {
            user.updateProfile({
                displayName: displayName
            }).then(() => {
                // Update UI
                updateUserUI(user);
            }).catch(error => {
                console.error('Error updating profile:', error);
            });
        }
    }
    
    // Update email if changed
    if (email && email !== user.email) {
        user.updateEmail(email).catch(error => {
            console.error('Error updating email:', error);
            showAlert('Error updating email: ' + error.message, 'danger');
        });
    }
    
    // Save to Firestore
    userRef.set(updates, { merge: true })
        .then(() => {
            showAlert('Settings saved successfully', 'success');
        })
        .catch(error => {
            console.error('Error saving settings:', error);
            showAlert('Error saving settings: ' + error.message, 'danger');
        });
}

/**
 * Get badge class based on score percentage
 * @param {number} percentage - Score percentage
 * @returns {string} Bootstrap badge class
 */
function getScoreBadgeClass(percentage) {
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-danger';
}

/**
 * Format date to readable string
 * @param {Date} date - Date to format
 * @param {string} [format='long'] - Format type ('short' or 'long')
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'long') {
    if (!(date instanceof Date)) {
        date = date.toDate();
    }
    
    if (format === 'short') {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
        return 'Yesterday';
    }
    if (diffInDays < 7) {
        return `${diffInDays} days ago`;
    }
    
    // For older dates, return formatted date
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Get common chart options
 * @param {string} title - Chart title
 * @param {string} [suffix='%'] - Value suffix
 * @returns {Object} Chart options
 */
function getChartOptions(title, suffix = '%') {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: {
                        size: 11
                    }
                }
            },
            title: {
                display: !!title,
                text: title,
                padding: {
                    top: 10,
                    bottom: 20
                },
                font: {
                    size: 14,
                    weight: 'bold'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                    size: 12,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 12
                },
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label || ''}: ${context.raw}${suffix}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    callback: function(value) {
                        return value + suffix;
                    }
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };
}

/**
 * Show alert message
 * @param {string} message - Message to display
 * @param {string} type - Alert type (success, danger, warning, info)
 */
function showAlert(message, type = 'info') {
    // Remove any existing alerts
    const existingAlert = document.querySelector('.alert-dismissible');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    // Insert alert at the top of the main content
    const mainContent = document.querySelector('.main-content .container-fluid');
    if (mainContent) {
        mainContent.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            const alert = document.querySelector('.alert-dismissible');
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // View test details
    document.addEventListener('click', (e) => {
        if (e.target.closest('.view-details')) {
            e.preventDefault();
            const testId = e.target.closest('.view-details').dataset.id;
            // Navigate to test details page or show modal
            console.log('View test details:', testId);
            // window.location.href = `test-details.html?id=${testId}`;
        }
    });
    
    // Handle time period filter changes
    const periodFilter = document.getElementById('periodFilter');
    if (periodFilter) {
        periodFilter.addEventListener('change', (e) => {
            // Reload data with the selected time period
            const userId = firebase.auth().currentUser?.uid;
            if (userId) {
                loadProgressData(userId);
            }
        });
    }
}

// Export functions for testing or other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        getScoreBadgeClass,
        createActivityItem,
        showAlert,
        getChartOptions
    };
}
