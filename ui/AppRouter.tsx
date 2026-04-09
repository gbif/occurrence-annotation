import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import App from './App';
import { UserPage } from './components/UserPage';
import { ProjectsPage } from './components/ProjectsPage';
import { ProjectPage } from './components/ProjectPage';

function AppWithNavigation() {
  const navigate = useNavigate();

  const handleNavigateToRule = (rule: any) => {
    // Navigate back to main app with species information only
    const params = new URLSearchParams();
    // Handle both taxonKey (from user rules) and taxonKeys array (from annotation rules)
    if (rule.taxonKey) {
      params.set('taxonKey', rule.taxonKey.toString());
    } else if (rule.taxonKeys && rule.taxonKeys.length > 0) {
      params.set('taxonKey', rule.taxonKeys[0].toString());
    } else {
      // If no taxonKey is available, just go to main page
      console.warn('Rule has no taxonKey, navigating to main page:', rule.id);
    }
    // Note: Removed ruleId - just navigate to species context
    navigate(`/?${params.toString()}`);
  };

  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route 
        path="/user/:username" 
        element={<UserPage onNavigateToRule={handleNavigateToRule} />} 
      />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/project/:projectId" element={<ProjectPage />} />
    </Routes>
  );
}

export default function AppRouter() {
  return (
    <Router>
      <AppWithNavigation />
    </Router>
  );
}