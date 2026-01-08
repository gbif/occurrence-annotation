/**
 * Get the currently selected project ID from localStorage
 * This project will be automatically assigned to new annotation rules
 */
export function getSelectedProjectId(): number | null {
  try {
    const stored = localStorage.getItem('selectedProjectId');
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    console.error('Error reading selected project ID:', error);
    return null;
  }
}

/**
 * Set the selected project ID in localStorage
 */
export function setSelectedProjectId(projectId: number | null): void {
  try {
    if (projectId) {
      localStorage.setItem('selectedProjectId', projectId.toString());
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  } catch (error) {
    console.error('Error setting selected project ID:', error);
  }
}

/**
 * Get the selected project name from localStorage (if stored)
 */
export function getSelectedProjectName(): string | null {
  try {
    return localStorage.getItem('selectedProjectName');
  } catch (error) {
    console.error('Error reading selected project name:', error);
    return null;
  }
}

/**
 * Set the selected project name in localStorage
 */
export function setSelectedProjectName(name: string | null): void {
  try {
    if (name) {
      localStorage.setItem('selectedProjectName', name);
    } else {
      localStorage.removeItem('selectedProjectName');
    }
  } catch (error) {
    console.error('Error setting selected project name:', error);
  }
}
