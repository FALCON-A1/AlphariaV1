// Import the Firebase functions we need
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    doc,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { db } from '../firebase.js'; // Import the initialized Firestore instance

// Export the init function to be called after Firebase is initialized
export function initTestCreator() {
    // Get current user
    const user = window.auth.currentUser;
    if (!user) {
        // Redirect to login if not authenticated
        window.location.href = '/auth/login-fixed.html';
        return;
    }
    // DOM Elements
    const sectionsContainer = document.getElementById('sections-container');
    const addSectionBtn = document.getElementById('add-section-btn');
    const saveDraftBtn = document.getElementById('save-draft-btn');
    const previewTestBtn = document.getElementById('preview-test-btn');
    const publishTestBtn = document.getElementById('publish-test-btn');
    const sectionTemplate = document.getElementById('section-template');
    const wordItemTemplate = document.getElementById('word-item-template');
    
    // State
    let sectionCount = 0;
    let itemCount = 0;
    
    // Initialize the test creator
    function init() {
        // Add event listeners
        if (addSectionBtn) addSectionBtn.addEventListener('click', addNewSection);
        if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveAsDraft);
        if (previewTestBtn) previewTestBtn.addEventListener('click', previewTest);
        if (publishTestBtn) publishTestBtn.addEventListener('click', publishTest);
        
        // Add the first section by default
        addNewSection();
    }
    
    // Initialize the test creator
    init();
    
    // Add a new section to the test
    function addNewSection() {
        sectionCount++;
        const sectionId = `section-${sectionCount}`;
        
        // Clone the section template
        const sectionElement = sectionTemplate.content.cloneNode(true);
        const sectionCard = sectionElement.querySelector('.section-card');
        sectionCard.dataset.sectionId = sectionId;
        
        // Update section title
        const titleInput = sectionElement.querySelector('.section-title-input');
        titleInput.value = `Section ${sectionCount}`;
        titleInput.addEventListener('input', (e) => {
            const title = e.target.value || `Section ${sectionCount}`;
            sectionCard.querySelector('.section-title').textContent = title;
        });
        
        // Add event listeners for section actions
        const addItemBtn = sectionElement.querySelector('.add-item-btn');
        const deleteSectionBtn = sectionElement.querySelector('.delete-section');
        const moveSectionUpBtn = sectionElement.querySelector('.move-section-up');
        const moveSectionDownBtn = sectionElement.querySelector('.move-section-down');
        const sectionTypeSelect = sectionElement.querySelector('.section-type');
        const itemsContainer = sectionElement.querySelector('.items-container');
        
        addItemBtn.addEventListener('click', () => addNewItem(itemsContainer, sectionTypeSelect.value));
        deleteSectionBtn.addEventListener('click', () => sectionCard.remove());
        
        moveSectionUpBtn.addEventListener('click', () => {
            const prevSibling = sectionCard.previousElementSibling;
            if (prevSibling) {
                sectionCard.parentNode.insertBefore(sectionCard, prevSibling);
            }
        });
        
        moveSectionDownBtn.addEventListener('click', () => {
            const nextSibling = sectionCard.nextElementSibling;
            if (nextSibling) {
                sectionCard.parentNode.insertBefore(nextSibling, sectionCard);
            }
        });
        
        // Handle section type change
        sectionTypeSelect.addEventListener('change', (e) => {
            // Clear existing items
            itemsContainer.innerHTML = '';
            // Add a new item of the selected type
            addNewItem(itemsContainer, e.target.value);
        });
        
        // Add the section to the container
        sectionsContainer.appendChild(sectionElement);
        
        // Initialize sortable for items
        initSortable(itemsContainer);
        
        // Add the first item to the section
        addNewItem(itemsContainer, sectionTypeSelect.value);
    }
    
    // Add a new item to a section
    function addNewItem(container, type) {
        itemCount++;
        const itemId = `item-${itemCount}`;
        
        // Clone the appropriate template based on item type
        let itemElement;
        
        switch (type) {
            case 'words':
            case 'sentences':
                itemElement = wordItemTemplate.content.cloneNode(true);
                const itemCard = itemElement.querySelector('.item-card');
                itemCard.dataset.itemId = itemId;
                
                // Set appropriate placeholder based on type
                const textInput = itemElement.querySelector('.item-text');
                textInput.placeholder = type === 'words' ? 'Enter word' : 'Enter sentence';
                
                // Add event listeners for item actions
                const deleteItemBtn = itemElement.querySelector('.delete-item');
                const moveItemUpBtn = itemElement.querySelector('.move-item-up');
                const moveItemDownBtn = itemElement.querySelector('.move-item-down');
                
                deleteItemBtn.addEventListener('click', () => itemCard.remove());
                
                moveItemUpBtn.addEventListener('click', () => {
                    const prevSibling = itemCard.previousElementSibling;
                    if (prevSibling) {
                        itemCard.parentNode.insertBefore(itemCard, prevSibling);
                    }
                });
                
                moveItemDownBtn.addEventListener('click', () => {
                    const nextSibling = itemCard.nextElementSibling;
                    if (nextSibling) {
                        itemCard.parentNode.insertBefore(nextSibling, itemCard);
                    }
                });
                
                break;
                
            case 'passage':
                // For passages, we'll use a different template
                // This is a simplified version - you can expand this
                itemElement = document.createElement('div');
                itemElement.className = 'item-card';
                itemElement.dataset.itemId = itemId;
                itemElement.innerHTML = `
                    <div class="form-group">
                        <label>Passage Title</label>
                        <input type="text" class="form-control" placeholder="Enter passage title" required>
                    </div>
                    <div class="form-group">
                        <label>Passage Text</label>
                        <textarea class="form-control" rows="4" placeholder="Enter the reading passage" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Comprehension Question (Optional)</label>
                        <input type="text" class="form-control" placeholder="Enter a question about the passage">
                    </div>
                    <div class="form-group">
                        <label>Points</label>
                        <input type="number" class="form-control item-points" min="1" value="5" required>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-sm btn-icon delete-item" title="Delete">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                
                // Add event listener for delete button
                const deleteBtn = itemElement.querySelector('.delete-item');
                deleteBtn.addEventListener('click', () => itemElement.remove());
                
                break;
        }
        
        // Add the item to the container
        container.appendChild(itemElement);
    }
    
    // Initialize sortable functionality for items
    function initSortable(container) {
        new Sortable(container, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.move-item',
            onEnd: function(evt) {
                // Update any necessary data after reordering
            }
        });
    }
    
    // Save the test as a draft
    async function saveAsDraft() {
        if (!validateTest(true)) {
            return;
        }
        
        try {
            const testData = getTestData();
            testData.status = 'draft';
            testData.createdAt = serverTimestamp();
            testData.updatedAt = serverTimestamp();
            
            const db = getFirestore();
            const user = getAuth().currentUser;
            
            if (!user) {
                throw new Error('User not authenticated');
            }
            
            // Add the user ID to the test data
            testData.teacherId = user.uid;
            
            // Save to Firestore
            const docRef = await addDoc(collection(db, 'tests'), testData);
            showNotification('Draft saved successfully!', 'success');
            return docRef.id;
        } catch (error) {
            console.error('Error saving draft:', error);
            showNotification('Failed to save draft: ' + error.message, 'error');
            throw error;
        }
    }
    
    // Preview the test
    function previewTest() {
        const testData = getTestData();
        
        // Here you would typically open a preview window/modal
        console.log('Previewing test:', testData);
        alert('Opening test preview...');
    }
    
    // Publish the test
    async function publishTest() {
        if (!validateTest(false)) {
            showNotification('Please fix validation errors before publishing', 'error');
            return;
        }
        
        const publishBtn = document.getElementById('publish-test-btn');
        const originalBtnText = publishBtn.innerHTML;
        
        try {
            // Show loading state
            publishBtn.disabled = true;
            publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
            
            // Get test data
            let testData = getTestData();
            
            const user = getAuth().currentUser;
            if (!user) {
                throw new Error('User not authenticated. Please log in again.');
            }
            
            // Prepare test data for Firestore
            const testDoc = {
                ...testData,
                teacherId: user.uid, // Must be set before any other operations
                status: 'published',
                publishedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdAt: testData.createdAt || serverTimestamp(),
                // Ensure all required fields have default values
                title: testData.title || 'Untitled Test',
                grade: testData.grade || '',
                timeLimit: testData.timeLimit || 30,
                instructions: testData.instructions || '',
                sections: Array.isArray(testData.sections) ? testData.sections : []
            };
            
            // Make sure sections and items are properly formatted
            if (!Array.isArray(testDoc.sections)) {
                testDoc.sections = [];
            }
            
            // Save to Firestore
            let docRef;
            try {
                if (testDoc.id) {
                    // Update existing test
                    const testRef = doc(db, 'tests', testDoc.id);
                    // Create update object without teacherId to prevent overwriting the original creator
                    const { teacherId, ...updateData } = testDoc;
                    await updateDoc(testRef, {
                        ...updateData,
                        updatedAt: serverTimestamp()
                    });
                    docRef = testDoc.id;
                } else {
                    // Create new test - ensure teacherId is set for security rule validation
                    const newTestRef = await addDoc(collection(db, 'tests'), testDoc);
                    testDoc.id = newTestRef.id; // Store the generated ID
                    docRef = newTestRef;
                }
                
                showNotification('Test published successfully!', 'success');
                
                // Redirect to dashboard after a short delay
                setTimeout(() => {
                    window.location.href = 'teacher-dashboard.html';
                }, 1500);
                
                return testDoc.id || (docRef?.id || '');
            } catch (firestoreError) {
                console.error('Firestore error:', firestoreError);
                throw firestoreError; // Re-throw to be caught by the outer catch
            }
            
        } catch (error) {
            console.error('Error publishing test:', error);
            let errorMessage = 'Failed to publish test';
            
            // Provide more specific error messages
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied. You may not have the necessary permissions.';
            } else if (error.code === 'unauthenticated') {
                errorMessage = 'You need to be logged in to publish tests.';
            } else if (error.message) {
                errorMessage += ': ' + error.message;
            }
            
            showNotification(errorMessage, 'error');
            throw error;
            
        } finally {
            // Reset button state
            if (publishBtn) {
                publishBtn.disabled = false;
                publishBtn.innerHTML = originalBtnText;
            }
        }
    }
    
    // Get all test data as an object
    function getTestData() {
        try {
            const testData = {
                title: document.getElementById('test-title')?.value || 'Untitled Test',
                grade: document.getElementById('test-grade')?.value || '',
                timeLimit: parseInt(document.getElementById('test-time-limit')?.value) || 30,
                instructions: document.getElementById('test-instructions')?.value || '',
                sections: []
            };
            
            // Ensure timeLimit is a valid number
            if (isNaN(testData.timeLimit) || testData.timeLimit < 1) {
                testData.timeLimit = 30;
            }
            
            // Get data from each section
            const sectionElements = document.querySelectorAll('.section-card');
            sectionElements.forEach((sectionEl) => {
                try {
                    const sectionData = {
                        id: sectionEl.dataset.sectionId || `section-${Date.now()}`,
                        title: sectionEl.querySelector('.section-title-input')?.value || 'Untitled Section',
                        instructions: sectionEl.querySelector('.section-instructions')?.value || '',
                        type: sectionEl.querySelector('.section-type')?.value || 'words',
                        items: []
                    };
                    
                    // Get items for this section
                    const itemElements = sectionEl.querySelectorAll('.item-card');
                    itemElements.forEach(itemEl => {
                        try {
                            const itemId = itemEl.dataset.itemId || `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                            const points = parseInt(itemEl.querySelector('.item-points')?.value) || 1;
                            
                            const itemText = itemEl.querySelector('.item-text')?.value.trim() || '';
                            
                            if (sectionData.type === 'passage') {
                                const inputs = itemEl.querySelectorAll('input[type="text"]');
                                sectionData.items.push({
                                    id: itemId,
                                    title: (inputs[0]?.value || 'Untitled Passage').trim(),
                                    content: (itemEl.querySelector('textarea')?.value || '').trim(),
                                    question: (inputs[1]?.value || '').trim(),
                                    points: points > 0 ? points : 1
                                });
                            } else if (sectionData.type === 'letters') {
                                // For letter items, ensure we have a single character
                                if (itemText.length === 1) {
                                    sectionData.items.push({
                                        id: itemId,
                                        text: itemText,
                                        points: points > 0 ? points : 1
                                    });
                                }
                            } else {
                                // For words and sentences
                                if (itemText) {
                                    sectionData.items.push({
                                        id: itemId,
                                        text: itemText,
                                        points: points > 0 ? points : 1
                                    });
                                }
                            }
                        } catch (itemError) {
                            console.error('Error processing item:', itemError);
                            // Skip invalid items
                        }
                    });
                    
                    // Only add section if it has items
                    if (sectionData.items.length > 0) {
                        testData.sections.push(sectionData);
                    }
                    
                } catch (sectionError) {
                    console.error('Error processing section:', sectionError);
                    // Skip invalid sections
                }
            });
            
            return testData;
            
        } catch (error) {
            console.error('Error getting test data:', error);
            throw new Error('Failed to prepare test data: ' + (error.message || 'Unknown error'));
        }
    }
    
    // Show notification to the user
    function showNotification(message, type = 'info') {
        try {
            // Remove any existing notifications
            const existingNotifications = document.querySelectorAll('.notification');
            existingNotifications.forEach(notif => notif.remove());
            
            // Create notification element
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                border-radius: 4px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: center;
                justify-content: space-between;
                z-index: 1000;
                max-width: 350px;
                transform: translateX(120%);
                transition: transform 0.3s ease-in-out;
                opacity: 0.95;
            `;
            
            const icon = type === 'success' ? 'fa-check-circle' : 
                        type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <i class="fas ${icon}" style="margin-right: 10px; font-size: 1.2em;"></i>
                    <span>${message}</span>
                </div>
                <button class="notification-close" style="background: none; border: none; color: white; cursor: pointer; margin-left: 15px; font-size: 1.2em;">
                    &times;
                </button>
            `;
            
            // Add close button functionality
            const closeButton = notification.querySelector('.notification-close');
            closeButton.addEventListener('click', () => {
                notification.style.transform = 'translateX(120%)';
                setTimeout(() => notification.remove(), 300);
            });
            
            // Add to DOM
            document.body.appendChild(notification);
            
            // Trigger animation
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 10);
            
            // Auto-remove after 5 seconds
            const autoRemove = setTimeout(() => {
                notification.style.transform = 'translateX(120%)';
                setTimeout(() => notification.remove(), 300);
            }, 5000);
            
            // Pause auto-remove on hover
            notification.addEventListener('mouseenter', () => {
                clearTimeout(autoRemove);
            });
            
            notification.addEventListener('mouseleave', () => {
                setTimeout(() => {
                    notification.style.transform = 'translateX(120%)';
                    setTimeout(() => notification.remove(), 300);
                }, 1000);
            });
            
        } catch (error) {
            console.error('Error showing notification:', error);
            // Fallback to alert if there's an error with the custom notification
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Validate the test before saving or publishing
    function validateTest(isDraft = false) {
        const title = document.getElementById('test-title').value.trim();
        if (!title) {
            alert('Please enter a test title');
            return false;
        }
        
        const grade = document.getElementById('test-grade').value;
        if (!grade) {
            alert('Please select a grade level');
            return false;
        }
        
        const sections = document.querySelectorAll('.section-card');
        if (sections.length === 0) {
            alert('Please add at least one section to the test');
            return false;
        }
        
        // Check each section has at least one item
        for (const section of sections) {
            const items = section.querySelectorAll('.item-card');
            if (items.length === 0) {
                alert(`Section "${section.querySelector('.section-title-input').value}" has no items. Please add at least one item or remove the section.`);
                return false;
            }
            
            // Check all required fields are filled
            const inputs = section.querySelectorAll('input[required], textarea[required]');
            for (const input of inputs) {
                if (!input.value.trim()) {
                    alert(`Please fill in all required fields in section "${section.querySelector('.section-title-input').value}"`);
                    input.focus();
                    return false;
                }
            }
        }
        
        return true;
    }
    
    // Initialize the test creator
    init();
}

// Speech Recognition Setup (for student view)
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    
    return recognition;
}

// Function to check pronunciation (for student view)
function checkPronunciation(spokenText, expectedText) {
    // Simple comparison - you might want to implement more sophisticated comparison
    // This is a basic implementation that can be enhanced with NLP libraries
    const cleanSpoken = spokenText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const cleanExpected = expectedText.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    return cleanSpoken === cleanExpected;
}
