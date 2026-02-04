// Utility functions for the application

// Show notification to user
export function showNotification(message, type = 'info', duration = 5000) {
  // Create notification element if it doesn't exist
  let notificationContainer = document.getElementById('notification-container');
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.style.position = 'fixed';
    notificationContainer.style.top = '20px';
    notificationContainer.style.right = '20px';
    notificationContainer.style.zIndex = '1000';
    document.body.appendChild(notificationContainer);
  }

  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.style.padding = '12px 20px';
  notification.style.marginBottom = '10px';
  notification.style.borderRadius = '4px';
  notification.style.color = 'white';
  notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
  notification.style.animation = 'slideIn 0.3s ease-out';
  notification.style.display = 'flex';
  notification.style.justifyContent = 'space-between';
  notification.style.alignItems = 'center';
  notification.style.minWidth = '250px';
  
  // Set background color based on type
  switch(type) {
    case 'success':
      notification.style.backgroundColor = '#10B981'; // Green
      break;
    case 'error':
      notification.style.backgroundColor = '#EF4444'; // Red
      break;
    case 'warning':
      notification.style.backgroundColor = '#F59E0B'; // Yellow
      break;
    default:
      notification.style.backgroundColor = '#3B82F6'; // Blue
  }

  // Add message
  const messageEl = document.createElement('span');
  messageEl.textContent = message;
  notification.appendChild(messageEl);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = 'white';
  closeBtn.style.fontSize = '20px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.marginLeft = '10px';
  closeBtn.style.padding = '0 5px';
  closeBtn.style.borderRadius = '4px';
  closeBtn.onmouseover = () => closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent';
  
  closeBtn.addEventListener('click', () => {
    notification.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  });
  
  notification.appendChild(closeBtn);
  notificationContainer.appendChild(notification);

  // Auto-remove notification after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  return notification;
}

// Format date to readable string
export function formatDate(date) {
  if (!(date instanceof Date)) {
    date = date?.toDate ? date.toDate() : new Date(date);
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// Format time ago (e.g., "2 hours ago")
export function timeAgo(date) {
  if (!(date instanceof Date)) {
    date = date?.toDate ? date.toDate() : new Date(date);
  }
  
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} years ago`;
  if (interval === 1) return '1 year ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;
  if (interval === 1) return '1 month ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;
  if (interval === 1) return '1 day ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;
  if (interval === 1) return '1 hour ago';
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;
  if (interval === 1) return '1 minute ago';
  
  return 'just now';
}

// Debounce function to limit how often a function can be called
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Truncate text with ellipsis
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Capitalize first letter of each word
export function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

// Validate email
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// Validate password (at least 8 characters, 1 number, 1 letter)
export function isValidPassword(password) {
  const re = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return re.test(password);
}

// Get user initials for avatar
export function getInitials(name) {
  if (!name) return 'U';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Generate a random ID
export function generateId(prefix = '') {
  return `${prefix}${Math.random().toString(36).substr(2, 9)}`;
}

// Format file size
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Add CSS animations to the document
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; max-height: 100px; margin-bottom: 10px; }
    to { opacity: 0; max-height: 0; margin-bottom: 0; padding: 0; }
  }
`;
document.head.appendChild(style);

// Export all utility functions
export default {
  showNotification,
  formatDate,
  timeAgo,
  debounce,
  truncate,
  capitalizeWords,
  isValidEmail,
  isValidPassword,
  getInitials,
  generateId,
  formatFileSize
};
