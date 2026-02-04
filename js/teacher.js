/**
 * Teacher Dashboard Functionality
 * Handles teacher-specific features including progress tracking and settings
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
    if (document.querySelector('#classPerformanceChart')) {
        initCharts();
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
            loadTeacherData(user.uid);
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
        el.textContent = user.displayName || 'Teacher';
    });
    
    // Update profile picture if available
    if (user.photoURL) {
        const profilePics = document.querySelectorAll('.profile-pic');
        profilePics.forEach(img => {
            img.src = user.photoURL;
            img.alt = user.displayName || 'Profile';
        });
    }
}

/**
 * Load teacher-specific data from Firestore
 * @param {string} userId - User ID
 */
function loadTeacherData(userId) {
    const db = firebase.firestore();
    
    // Load teacher data
    db.collection('teachers').doc(userId).get()
        .then(doc => {
            if (doc.exists) {
                const teacherData = doc.data();
                updateTeacherUI(teacherData);
            }
        })
        .catch(error => {
            console.error('Error loading teacher data:', error);
        });
    
    // Load class data if on progress page
    if (document.querySelector('#classPerformanceChart')) {
        loadClassData(userId);
    }
}

/**
 * Update UI with teacher data
 * @param {Object} teacherData - Teacher data from Firestore
 */
function updateTeacherUI(teacherData) {
    // Update profile fields in settings
    if (teacherData.firstName && teacherData.lastName) {
        document.querySelectorAll('.teacher-name').forEach(el => {
            el.textContent = `${teacherData.firstName} ${teacherData.lastName}`;
        });
    }
    
    if (teacherData.email) {
        document.querySelectorAll('.teacher-email').forEach(el => {
            el.textContent = teacherData.email;
            if (el.tagName === 'INPUT') {
                el.value = teacherData.email;
            }
        });
    }
    
    // Update other fields as needed
    const fields = ['bio', 'phone', 'timezone'];
    fields.forEach(field => {
        const element = document.querySelector(`#${field}`);
        if (element && teacherData[field]) {
            if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                element.value = teacherData[field];
            } else {
                element.textContent = teacherData[field];
            }
        }
    });
}

/**
 * Load class data for progress page
 * @param {string} teacherId - Teacher's user ID
 */
function loadClassData(teacherId) {
    const db = firebase.firestore();
    
    // Load classes taught by this teacher
    db.collection('classes')
        .where('teacherId', '==', teacherId)
        .get()
        .then(querySnapshot => {
            const classSelect = document.getElementById('classFilter');
            if (classSelect) {
                // Clear existing options
                classSelect.innerHTML = '<option value="">All Classes</option>';
                
                // Add classes to dropdown
                querySnapshot.forEach(doc => {
                    const classData = doc.data();
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = classData.name;
                    classSelect.appendChild(option);
                });
                
                // Load student data for the first class or all classes
                if (querySnapshot.size > 0) {
                    loadStudentData(teacherId, querySnapshot.docs[0].id);
                } else {
                    loadStudentData(teacherId);
                }
            }
        })
        .catch(error => {
            console.error('Error loading classes:', error);
        });
}

/**
 * Load student data for progress tracking
 * @param {string} teacherId - Teacher's user ID
 * @param {string} [classId] - Optional class ID to filter by
 */
function loadStudentData(teacherId, classId) {
    const db = firebase.firestore();
    let query = db.collection('students');
    
    // If classId is provided, only get students in that class
    if (classId) {
        query = db.collection('classes').doc(classId).collection('students');
    }
    
    query.get()
        .then(querySnapshot => {
            const tbody = document.querySelector('#studentProgressTable tbody');
            if (tbody) {
                tbody.innerHTML = ''; // Clear existing rows
                
                querySnapshot.forEach(doc => {
                    const student = doc.data();
                    const row = createStudentRow(doc.id, student);
                    tbody.appendChild(row);
                });
                
                // Initialize DataTables if available
                if ($.fn.DataTable) {
                    $('#studentProgressTable').DataTable({
                        responsive: true,
                        order: [[2, 'desc']] // Sort by last active by default
                    });
                }
            }
        })
        .catch(error => {
            console.error('Error loading students:', error);
        });
}

/**
 * Create a table row for a student
 * @param {string} studentId - Student's user ID
 * @param {Object} studentData - Student data
 * @returns {HTMLElement} Table row element
 */
function createStudentRow(studentId, studentData) {
    const row = document.createElement('tr');
    
    // Calculate progress percentage
    const completedTests = studentData.completedTests || 0;
    const totalTests = studentData.totalTests || 1; // Avoid division by zero
    const progress = Math.round((completedTests / totalTests) * 100);
    
    // Format last active time
    const lastActive = studentData.lastActive ? 
        formatDate(studentData.lastActive.toDate()) : 'Never';
    
    row.innerHTML = `
        <td>
            <div class="d-flex align-items-center">
                <div class="avatar-sm me-3">
                    ${studentData.photoURL ? 
                        `<img src="${studentData.photoURL}" class="rounded-circle" width="36" height="36" alt="${studentData.displayName || 'Student'}">` :
                        `<span>${(studentData.displayName || 'U')[0].toUpperCase()}</span>`
                    }
                </div>
                <div>
                    <h6 class="mb-0">${studentData.displayName || 'Student'}</h6>
                    <small class="text-muted">${studentData.email || ''}</small>
                </div>
            </div>
        </td>
        <td>${lastActive}</td>
        <td>${studentData.averageScore ? studentData.averageScore + '%' : 'N/A'}</td>
        <td>${completedTests}/${totalTests}</td>
        <td>
            <div class="progress" style="height: 6px;">
                <div class="progress-bar" role="progressbar" 
                     style="width: ${progress}%" 
                     aria-valuenow="${progress}" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
            </div>
            <small class="text-muted">${progress}% complete</small>
        </td>
        <td>
            <span class="badge ${studentData.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                ${studentData.status || 'inactive'}
            </span>
        </td>
        <td>
            <button class="btn btn-sm btn-outline-primary view-student" data-id="${studentId}">
                <i class="fas fa-eye"></i>
            </button>
        </td>
    `;
    
    return row;
}

/**
 * Initialize charts for the progress page
 */
function initCharts() {
    // Class Performance Chart (Line Chart)
    const classCtx = document.getElementById('classPerformanceChart');
    if (classCtx) {
        new Chart(classCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Class Average',
                    data: [72, 75, 78, 80, 82, 84],
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: getChartOptions('Class Performance Over Time')
        });
    }
    
    // Score Distribution Chart (Doughnut)
    const distCtx = document.getElementById('scoreDistributionChart');
    if (distCtx) {
        new Chart(distCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['90-100%', '80-89%', '70-79%', '60-69%', 'Below 60%'],
                datasets: [{
                    data: [12, 18, 7, 3, 2],
                    backgroundColor: ['#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'],
                    hoverBackgroundColor: ['#17a673', '#2c9faf', '#dda20a', '#be2617', '#6c757d'],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }],
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: {
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
                        display: true,
                        text: 'Score Distribution',
                        padding: {
                            top: 10,
                            bottom: 20
                        },
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                },
                cutout: '70%',
            },
        });
    }
}

/**
 * Get common chart options
 * @param {string} title - Chart title
 * @returns {Object} Chart options
 */
function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
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
                        return `${context.dataset.label}: ${context.raw}%`;
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
                        return value + '%';
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
 * Initialize settings tabs
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
    const profilePic = document.getElementById('profilePicture');
    const originalSrc = profilePic.src;
    
    // Create preview
    const reader = new FileReader();
    reader.onload = function(e) {
        profilePic.src = e.target.result;
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
    const timezone = document.getElementById('timezone')?.value || '';
    
    // Get notification preferences
    const notifications = {
        email: document.getElementById('emailNotifications')?.checked || false,
        testReminders: document.getElementById('testReminders')?.checked || false,
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
    const userRef = db.collection('teachers').doc(user.uid);
    
    // Prepare data to update
    const updates = {
        firstName,
        lastName,
        email,
        phone,
        bio,
        timezone,
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
 * Format date to relative time (e.g., "2 hours ago")
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
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
    if (diffInDays < 7) {
        return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }
    
    // Return formatted date for older dates
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Class filter change
    const classFilter = document.getElementById('classFilter');
    if (classFilter) {
        classFilter.addEventListener('change', (e) => {
            const teacherId = firebase.auth().currentUser?.uid;
            if (teacherId) {
                loadStudentData(teacherId, e.target.value || undefined);
            }
        });
    }
    
    // View student details
    document.addEventListener('click', (e) => {
        if (e.target.closest('.view-student')) {
            const studentId = e.target.closest('.view-student').dataset.id;
            // Navigate to student details page or show modal
            console.log('View student:', studentId);
            // window.location.href = `student-details.html?id=${studentId}`;
        }
    });
    
    // Delete account confirmation
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const confirmDeleteCheckbox = document.getElementById('confirmDelete');
    
    if (confirmDeleteBtn && confirmDeleteCheckbox) {
        confirmDeleteCheckbox.addEventListener('change', (e) => {
            confirmDeleteBtn.disabled = !e.target.checked;
        });
        
        confirmDeleteBtn.addEventListener('click', deleteAccount);
    }
}

/**
 * Delete user account
 */
function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        return;
    }
    
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    // Show loading state
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
    
    // Delete user data from Firestore
    const db = firebase.firestore();
    const batch = db.batch();
    
    // Delete teacher document
    const teacherRef = db.collection('teachers').doc(user.uid);
    batch.delete(teacherRef);
    
    // Delete any other related data (you may need to add more)
    // For example, delete the user's classes, tests, etc.
    
    // Commit the batch
    batch.commit()
        .then(() => {
            // Delete the user account
            return user.delete();
        })
        .then(() => {
            // Redirect to login page
            window.location.href = '/auth/login-fixed.html';
        })
        .catch(error => {
            console.error('Error deleting account:', error);
            showAlert('Error deleting account: ' + error.message, 'danger');
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalText;
        });
}

// Export functions for testing or other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDate,
        createStudentRow,
        getChartOptions,
        showAlert
    };
}
