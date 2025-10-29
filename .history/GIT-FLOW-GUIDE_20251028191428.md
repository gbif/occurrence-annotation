# Git Flow Guide for GBIF Occurrence Annotation Project

## Overview

This project uses Git Flow branching model to manage development, releases, and hotfixes in a structured way.

## Branch Structure

- **`main`** - Production-ready code, stable releases
- **`develop`** - Integration branch for features, next release preparation
- **`feature/*`** - New features and enhancements
- **`release/*`** - Release preparation and bug fixes
- **`hotfix/*`** - Critical fixes for production issues
- **`bugfix/*`** - Bug fixes for develop branch

## Git Flow Commands

### 🚀 Starting New Features

```bash
# Start a new feature
git flow feature start <feature-name>

# Examples:
git flow feature start api-authentication
git flow feature start docker-improvements
git flow feature start new-annotation-types
```

### ✅ Completing Features

```bash
# Finish a feature (merges to develop and deletes feature branch)
git flow feature finish <feature-name>

# Publish feature for collaboration
git flow feature publish <feature-name>

# Pull someone else's feature
git flow feature pull origin <feature-name>
```

### 🔧 Bug Fixes

```bash
# Start a bugfix
git flow bugfix start <bugfix-name>

# Finish a bugfix
git flow bugfix finish <bugfix-name>
```

### 📦 Releases

```bash
# Start a release
git flow release start <version>

# Examples:
git flow release start 1.1.0
git flow release start 2.0.0-beta

# Finish a release (merges to both main and develop)
git flow release finish <version>
```

### 🚨 Hotfixes

```bash
# Start a hotfix from main
git flow hotfix start <version>

# Example:
git flow hotfix start 1.0.1

# Finish a hotfix (merges to both main and develop)
git flow hotfix finish <version>
```

## Recommended Workflow

### For New Features:
1. `git flow feature start my-feature`
2. Develop your feature
3. Commit changes regularly
4. `git flow feature finish my-feature`
5. Push develop branch: `git push origin develop`

### For Releases:
1. `git flow release start 1.x.x`
2. Update version numbers, documentation
3. Test thoroughly
4. `git flow release finish 1.x.x`
5. Push all branches: `git push origin main develop --tags`

### For Hotfixes:
1. `git flow hotfix start 1.x.y`
2. Fix the critical issue
3. `git flow hotfix finish 1.x.y`
4. Push all branches: `git push origin main develop --tags`

## Branch Protection Rules (Recommended)

Set up these protection rules on GitHub:

### Main Branch:
- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
- Restrict pushes to administrators only

### Develop Branch:
- Require pull request reviews
- Require status checks to pass
- Allow merge commits

## Integration with Docker Development

### Feature Development with Docker:
```bash
# Start feature
git flow feature start docker-compose-improvements

# Make changes to Dockerfile, docker-compose.yml, etc.
# Test with Docker
docker-compose up --build

# Commit and finish
git add .
git commit -m "Improve Docker setup with health checks"
git flow feature finish docker-compose-improvements
```

## CI/CD Integration

### GitHub Actions Workflow Triggers:
- **Push to `main`**: Deploy to production
- **Push to `develop`**: Deploy to staging/development environment
- **Pull Requests**: Run tests and build checks
- **Release tags**: Create release artifacts

## Project-Specific Conventions

### Feature Naming:
- `api-<feature>` - API-related features
- `ui-<feature>` - Frontend features  
- `docker-<feature>` - Docker/infrastructure
- `db-<feature>` - Database changes
- `docs-<feature>` - Documentation

### Examples:
```bash
git flow feature start api-project-permissions
git flow feature start ui-map-improvements
git flow feature start docker-multi-stage-build
git flow feature start db-annotation-schema
```

### Commit Message Format:
```
<type>(<scope>): <description>

feat(api): add project member management endpoints
fix(docker): resolve PostgreSQL connection issues
docs(readme): add Docker setup instructions
chore(deps): update Spring Boot to 2.3.12
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `git flow init` | Initialize git flow |
| `git flow feature start <name>` | Start new feature |
| `git flow feature finish <name>` | Complete feature |
| `git flow release start <version>` | Start release |
| `git flow release finish <version>` | Complete release |
| `git flow hotfix start <version>` | Start hotfix |
| `git flow hotfix finish <version>` | Complete hotfix |

## Current Repository Status

- ✅ Git Flow initialized
- ✅ `main` branch (production)
- ✅ `develop` branch (integration)
- ✅ Docker containerization complete
- ✅ Spring Boot backend service running
- ✅ PostgreSQL database configured

## Next Steps

1. Create your first feature branch for upcoming work
2. Set up GitHub branch protection rules
3. Configure CI/CD pipelines for different branches
4. Train team members on Git Flow workflow

## Tips

- Always start features from `develop` branch
- Keep feature branches focused and small
- Use meaningful branch and commit messages
- Test thoroughly before finishing features
- Regularly merge develop into long-running features
- Use `git flow feature publish` for collaborative features

---

**Happy coding with Git Flow! 🚀**