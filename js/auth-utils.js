// Authentication and Authorization Utilities

import { db } from './firebase.js';
import { 
    doc, 
    getDoc,
    collection,
    query,
    where,
    getDocs
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

// Cache for user roles and permissions
const userPermissionsCache = new Map();

/**
 * Check if the current user has the specified permission
 * @param {string} userId - The user's UID
 * @param {string} permission - The permission to check
 * @returns {Promise<boolean>} - Whether the user has the permission
 */
export async function hasPermission(userId, permission) {
    if (!userId) return false;
    
    // Check cache first
    if (userPermissionsCache.has(userId)) {
        const cached = userPermissionsCache.get(userId);
        if (cached.permissions.includes(permission)) {
            return true;
        }
        return cached.role === 'SUPER_ADMIN'; // Super admins have all permissions
    }
    
    try {
        // Get user document
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return false;
        
        const userData = userDoc.data();
        const roleId = userData.role;
        
        if (!roleId) return false;
        
        // For super admins, check cache and return true for any permission
        if (roleId === 'SUPER_ADMIN') {
            userPermissionsCache.set(userId, {
                role: 'SUPER_ADMIN',
                permissions: ['*']
            });
            return true;
        }
        
        // Get role document
        const roleDoc = await getDoc(doc(db, 'roles', roleId));
        if (!roleDoc.exists()) return false;
        
        const roleData = roleDoc.data();
        const hasPerm = roleData.permissions && 
                       (roleData.permissions.includes(permission) || 
                        roleData.permissions.includes('*'));
        
        // Update cache
        userPermissionsCache.set(userId, {
            role: roleId,
            permissions: roleData.permissions || []
        });
        
        return hasPerm;
        
    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
}

/**
 * Get all available roles
 * @returns {Promise<Array>} - List of roles with their permissions
 */
export async function getAllRoles() {
    try {
        const rolesSnapshot = await getDocs(collection(db, 'roles'));
        return rolesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting roles:', error);
        return [];
    }
}

/**
 * Get a user's role information
 * @param {string} userId - The user's UID
 * @returns {Promise<Object|null>} - The user's role information or null if not found
 */
export async function getUserRole(userId) {
    if (!userId) return null;
    
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return null;
        
        const userData = userDoc.data();
        const roleId = userData.role;
        
        if (!roleId) return null;
        
        const roleDoc = await getDoc(doc(db, 'roles', roleId));
        if (!roleDoc.exists()) return null;
        
        return {
            id: roleId,
            ...roleDoc.data()
        };
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
}

/**
 * Check if a user has any of the specified permissions
 * @param {string} userId - The user's UID
 * @param {Array<string>} permissions - Array of permissions to check
 * @returns {Promise<boolean>} - Whether the user has any of the permissions
 */
export async function hasAnyPermission(userId, permissions) {
    if (!userId || !permissions || !permissions.length) return false;
    
    // Check cache first for super admin
    if (userPermissionsCache.has(userId) && userPermissionsCache.get(userId).role === 'SUPER_ADMIN') {
        return true;
    }
    
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return false;
        
        const userData = userDoc.data();
        const roleId = userData.role;
        
        if (!roleId) return false;
        
        // Super admin has all permissions
        if (roleId === 'SUPER_ADMIN') {
            userPermissionsCache.set(userId, {
                role: 'SUPER_ADMIN',
                permissions: ['*']
            });
            return true;
        }
        
        // Get role document
        const roleDoc = await getDoc(doc(db, 'roles', roleId));
        if (!roleDoc.exists()) return false;
        
        const roleData = roleDoc.data();
        const hasAny = permissions.some(permission => 
            roleData.permissions && 
            (roleData.permissions.includes(permission) || 
             roleData.permissions.includes('*'))
        );
        
        // Update cache
        userPermissionsCache.set(userId, {
            role: roleId,
            permissions: roleData.permissions || []
        });
        
        return hasAny;
        
    } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
    }
}

/**
 * Clear the permissions cache for a user
 * @param {string} userId - The user's UID
 */
export function clearPermissionsCache(userId) {
    if (userId) {
        userPermissionsCache.delete(userId);
    } else {
        userPermissionsCache.clear();
    }
}

// Export permission constants
export const PERMISSIONS = {
    // User Management
    MANAGE_USERS: 'manage_users',
    VIEW_USERS: 'view_users',
    
    // Test Management
    MANAGE_TESTS: 'manage_tests',
    VIEW_TESTS: 'view_tests',
    
    // Class Management
    MANAGE_CLASSES: 'manage_classes',
    VIEW_CLASSES: 'view_classes',
    
    // Settings
    MANAGE_SETTINGS: 'manage_settings',
    
    // Analytics
    VIEW_ANALYTICS: 'view_analytics'
};

// Default roles
export const DEFAULT_ROLES = {
    SUPER_ADMIN: {
        name: 'Super Administrator',
        permissions: Object.values(PERMISSIONS)
    },
    ADMIN: {
        name: 'Administrator',
        permissions: [
            PERMISSIONS.VIEW_USERS,
            PERMISSIONS.MANAGE_USERS,
            PERMISSIONS.VIEW_TESTS,
            PERMISSIONS.VIEW_CLASSES,
            PERMISSIONS.VIEW_ANALYTICS
        ]
    },
    TEACHER: {
        name: 'Teacher',
        permissions: [
            PERMISSIONS.VIEW_TESTS,
            PERMISSIONS.VIEW_CLASSES,
            PERMISSIONS.VIEW_ANALYTICS
        ]
    },
    LIMITED_TEACHER: {
        name: 'Limited Teacher',
        permissions: [
            PERMISSIONS.VIEW_TESTS
        ]
    }
};
