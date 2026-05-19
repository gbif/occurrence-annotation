// Authentication and User Helper Functions

export interface GBIFUser {
  userName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
}

/**
 * Get the current logged-in user from sessionStorage.
 *
 * Stored in sessionStorage (not localStorage) so the profile is cleared
 * when the tab is closed, matching the lifetime of the credentials in
 * `gbifAuth`. Any legacy value left in localStorage is purged on read.
 *
 * @returns GBIFUser object or null if not logged in
 */
export const getUser = (): GBIFUser | null => {
  try {
    // Purge any legacy profile left in localStorage by older builds.
    if (localStorage.getItem('gbifUser') !== null) {
      localStorage.removeItem('gbifUser');
    }
    const userStr = sessionStorage.getItem('gbifUser');
    if (userStr) {
      return JSON.parse(userStr) as GBIFUser;
    }
  } catch (error) {
    console.error('Failed to parse user from sessionStorage:', error);
  }
  return null;
};

/**
 * Persist the GBIF user profile in sessionStorage.
 */
export const setUser = (user: GBIFUser): void => {
  try {
    sessionStorage.setItem('gbifUser', JSON.stringify(user));
    localStorage.removeItem('gbifUser');
  } catch (error) {
    console.error('Failed to store user:', error);
  }
};

/**
 * Remove the GBIF user profile from session and (legacy) local storage.
 */
export const clearUser = (): void => {
  try {
    sessionStorage.removeItem('gbifUser');
    localStorage.removeItem('gbifUser');
  } catch (error) {
    console.error('Failed to clear user:', error);
  }
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
 * Get GBIF authentication credentials from sessionStorage.
 *
 * Credentials are stored in sessionStorage (not localStorage) so they are
 * cleared when the browser tab is closed, reducing exposure if XSS occurs
 * or the device is shared. Any legacy value left in localStorage is purged
 * on read.
 *
 * @returns Base64 encoded auth string or null if not found
 */
export const getAuthCredentials = (): string | null => {
  try {
    // Purge any legacy credential left in localStorage by older builds.
    if (localStorage.getItem('gbifAuth') !== null) {
      localStorage.removeItem('gbifAuth');
    }
    return sessionStorage.getItem('gbifAuth');
  } catch (error) {
    console.error('Failed to get auth credentials:', error);
    return null;
  }
};

/**
 * Persist GBIF authentication credentials in sessionStorage.
 * Credentials never touch localStorage.
 */
export const setAuthCredentials = (credentials: string): void => {
  try {
    sessionStorage.setItem('gbifAuth', credentials);
    // Ensure no legacy copy lingers in localStorage.
    localStorage.removeItem('gbifAuth');
  } catch (error) {
    console.error('Failed to store auth credentials:', error);
  }
};

/**
 * Remove GBIF authentication credentials from session and (legacy) local storage.
 */
export const clearAuthCredentials = (): void => {
  try {
    sessionStorage.removeItem('gbifAuth');
    localStorage.removeItem('gbifAuth');
  } catch (error) {
    console.error('Failed to clear auth credentials:', error);
  }
};
