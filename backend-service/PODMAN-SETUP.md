# Running with Podman Desktop (Docker Desktop Alternative)

This guide helps you run the backend service using **Podman Desktop** instead of Docker Desktop.

## Why Podman?

- **No Docker Desktop required** - Completely free and open source
- **Docker-compatible** - Works with existing Dockerfiles and docker-compose files
- **Better performance** - Lower resource usage than Docker Desktop
- **Rootless by default** - More secure

## Installation

### Step 1: Install Podman Desktop

1. Download from: https://podman-desktop.io/downloads
2. Install Podman Desktop (includes Podman CLI)
3. Launch Podman Desktop
4. Follow the setup wizard to initialize Podman machine

### Step 2: Install podman-compose

Open PowerShell as Administrator:

```powershell
# Install podman-compose via pip
pip install podman-compose

# Or via scoop (if you have scoop installed)
scoop install podman-compose
```

### Step 3: Verify Installation

```powershell
podman --version
podman-compose --version
```

## Running the Application

### Quick Start

From the `backend-service` directory:

```powershell
# Using podman-compose (recommended)
podman-compose up -d

# Or using podman compose (if supported)
podman compose up -d
```

### Step-by-Step

```powershell
cd backend-service

# Build the images
podman-compose build

# Start services in background
podman-compose up -d

# View logs
podman-compose logs -f

# Check status
podman-compose ps

# Stop services
podman-compose down

# Stop and remove volumes (clean slate)
podman-compose down -v
```

## Accessing the Application

Once running:
- **Swagger UI**: http://localhost:8080/swagger-ui/index.html
- **API Docs**: http://localhost:8080/v1/occurrence/annotation/docs
- **Health Check**: http://localhost:8080/actuator/health
- **PostgreSQL**: localhost:5432 (user: postgres, password: postgres, db: annotation)

## Using the PowerShell Script

We've provided a convenient script:

```powershell
# Deploy everything
.\deploy-podman.ps1

# Or with specific actions
.\deploy-podman.ps1 -Action deploy
.\deploy-podman.ps1 -Action status
.\deploy-podman.ps1 -Action logs
.\deploy-podman.ps1 -Action rebuild
.\deploy-podman.ps1 -Action teardown
```

## Useful Commands

### Container Management

```powershell
# List running containers
podman ps

# View all containers (including stopped)
podman ps -a

# View logs for specific container
podman logs occurrence-annotation-backend -f
podman logs occurrence-annotation-db -f

# Execute commands in container
podman exec -it occurrence-annotation-db psql -U postgres -d annotation
podman exec -it occurrence-annotation-backend bash

# Restart a service
podman restart occurrence-annotation-backend

# Stop all containers
podman stop $(podman ps -q)
```

### Image Management

```powershell
# List images
podman images

# Remove unused images
podman image prune

# Remove specific image
podman rmi occurrence-annotation-backend
```

### Volume Management

```powershell
# List volumes
podman volume ls

# Inspect volume
podman volume inspect backend-service_postgres-data

# Remove volume (WARNING: deletes data)
podman volume rm backend-service_postgres-data
```

### Network Management

```powershell
# List networks
podman network ls

# Inspect network
podman network inspect backend-service_occurrence-network
```

## Troubleshooting

### Podman machine not running

```powershell
# Initialize Podman machine (first time)
podman machine init

# Start Podman machine
podman machine start

# Check status
podman machine list
```

### Port conflicts

If port 8080 or 5432 is already in use:

```powershell
# Find process using port
netstat -ano | findstr :8080
netstat -ano | findstr :5432

# Change ports in docker-compose.yml
# Edit the ports section to use different ports
```

### Build failures

```powershell
# Clean build
podman-compose down -v
podman system prune -af
podman-compose up --build
```

### Cannot connect to database

```powershell
# Check if postgres is running
podman ps | grep postgres

# Check postgres logs
podman logs occurrence-annotation-db

# Verify database is initialized
podman exec -it occurrence-annotation-db psql -U postgres -c "\l"
```

### Backend not starting

```powershell
# Check backend logs
podman logs occurrence-annotation-backend --tail 100

# Common issues:
# 1. Database not ready - wait 30 seconds after postgres starts
# 2. Port in use - check if something else is on 8080
# 3. Build failed - check Docker build logs
```

## Differences from Docker Desktop

### Command Mapping

Most Docker commands work with Podman:

```powershell
# Docker → Podman
docker ps          → podman ps
docker build       → podman build
docker run         → podman run
docker-compose up  → podman-compose up
```

### Podman Desktop UI

Podman Desktop provides a GUI similar to Docker Desktop:
- View running containers
- Manage images and volumes
- Monitor resource usage
- Access container logs and shell

## Migration from Docker Desktop

If you had Docker Desktop previously:

```powershell
# Export Docker containers (if needed)
docker save -o image.tar image-name

# Import to Podman
podman load -i image.tar

# Switch aliases (optional)
Set-Alias docker podman
Set-Alias docker-compose podman-compose
```

## Performance Tips

1. **Allocate sufficient resources** in Podman Desktop settings
2. **Use volumes** for persistent data (already configured)
3. **Clean up regularly**:
   ```powershell
   podman system prune -af --volumes
   ```

## Alternative: Native Docker in WSL2

If you prefer not to use Podman Desktop, you can install Docker directly in WSL2:

```bash
# In WSL2 terminal
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo service docker start
sudo usermod -aG docker $USER

# Then use the start-docker-wsl.sh script
chmod +x start-docker-wsl.sh
./start-docker-wsl.sh
```

## Getting Help

- Podman documentation: https://docs.podman.io/
- Podman Desktop: https://podman-desktop.io/docs
- GitHub Issues: https://github.com/containers/podman/issues
