// Authentication and User Helper Functions

export interface GBIFUser {
  userName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
}

/**
 * Get the current logged-in user from localStorage
 * @returns GBIFUser object or null if not logged in
 */
export const getUser = (): GBIFUser | null => {
  try {
    const userStr = localStorage.getItem('gbifUser');
    if (userStr) {
      return JSON.parse(userStr) as GBIFUser;
    }
  } catch (error) {
    console.error('Failed to parse user from localStorage:', error);
  }
  return null;
};

/**
 * Check if the current user has admin (REGISTRY_ADMIN) privileges
 * @returns true if user is an admin, false otherwise
 */
export const isAdmin = (): boolean => {
  try {
    const user = getUser();
    const hasRole = user?.roles?.includes('REGISTRY_ADMIN') ?? false;
    
    return hasRole;
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
};

/**
 * Check if a user is currently logged in
 * @returns true if user is logged in, false otherwise
 */
export const isLoggedIn = (): boolean => {
  return getUser() !== null;
};

/**
 * Get GBIF authentication credentials from localStorage
 * @returns Base64 encoded auth string or null if not found
 */
export const getAuthCredentials = (): string | null => {
  try {
    return localStorage.getItem('gbifAuth');
  } catch (error) {
    console.error('Failed to get auth credentials:', error);
    return null;
  }
};
