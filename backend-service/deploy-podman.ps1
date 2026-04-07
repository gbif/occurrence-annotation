# Podman deployment script for Occurrence Annotation
# Alternative to Docker Desktop

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("deploy", "teardown", "rebuild", "status", "logs")]
    [string]$Action = "deploy"
)

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Check-Prerequisites {
    Write-Step "Checking prerequisites..."
    
    # Check podman
    try {
        $null = podman --version 2>$null
        Write-Success "Podman is installed"
    } catch {
        Write-Error "Podman is not installed"
        Write-Host "`nPlease install Podman Desktop from: https://podman-desktop.io/downloads" -ForegroundColor Yellow
        exit 1
    }
    
    # Check if Podman machine is running
    try {
        $machineStatus = podman machine list 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Initializing Podman machine..." -ForegroundColor Yellow
            podman machine init
            podman machine start
        } else {
            $running = $machineStatus | Select-String "Currently running"
            if (-not $running) {
                Write-Host "Starting Podman machine..." -ForegroundColor Yellow
                podman machine start
            }
        }
        Write-Success "Podman machine is running"
    } catch {
        Write-Error "Failed to start Podman machine"
        exit 1
    }
    
    # Check for podman-compose or docker-compose
    $composeCmd = $null
    if (Get-Command podman-compose -ErrorAction SilentlyContinue) {
        $composeCmd = "podman-compose"
        Write-Success "podman-compose is installed"
    } elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        $composeCmd = "docker-compose"
        Write-Success "docker-compose is installed (will use with Podman)"
    } else {
        Write-Error "Neither podman-compose nor docker-compose is installed"
        Write-Host "`nInstall podman-compose with: pip install podman-compose" -ForegroundColor Yellow
        exit 1
    }
    
    return $composeCmd
}

function Deploy-Application {
    $composeCmd = Check-Prerequisites
    
    Write-Step "Building and starting services..."
    & $composeCmd up -d --build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to start services"
        Write-Host "`nCheck logs with: podman-compose logs" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Step "Waiting for services to be healthy..."
    Start-Sleep -Seconds 10
    
    # Check if containers are running
    $postgres = podman ps --filter "name=occurrence-annotation-db" --format "{{.Status}}"
    $backend = podman ps --filter "name=occurrence-annotation-backend" --format "{{.Status}}"
    
    if ($postgres -match "Up") {
        Write-Success "PostgreSQL is running"
    } else {
        Write-Error "PostgreSQL failed to start"
    }
    
    if ($backend -match "Up") {
        Write-Success "Backend is running"
    } else {
        Write-Host "Backend is starting... (this may take 1-2 minutes)" -ForegroundColor Yellow
    }
    
    Write-Step "Deployment complete!"
    Write-Host ""
    Write-Host "Application should be available at:" -ForegroundColor Green
    Write-Host "  Swagger UI: http://localhost:8080/swagger-ui/index.html" -ForegroundColor Cyan
    Write-Host "  API Docs:   http://localhost:8080/v1/occurrence/annotation/docs" -ForegroundColor Cyan
    Write-Host "  Health:     http://localhost:8080/actuator/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Database:" -ForegroundColor Green
    Write-Host "  Host:       localhost:5432" -ForegroundColor Cyan
    Write-Host "  Database:   annotation" -ForegroundColor Cyan
    Write-Host "  User:       postgres" -ForegroundColor Cyan
    Write-Host "  Password:   postgres" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Yellow
    Write-Host "  View status:  .\deploy-podman.ps1 -Action status" -ForegroundColor Gray
    Write-Host "  View logs:    .\deploy-podman.ps1 -Action logs" -ForegroundColor Gray
    Write-Host "  Rebuild:      .\deploy-podman.ps1 -Action rebuild" -ForegroundColor Gray
    Write-Host "  Teardown:     .\deploy-podman.ps1 -Action teardown" -ForegroundColor Gray
}

function Teardown-Application {
    $composeCmd = if (Get-Command podman-compose -ErrorAction SilentlyContinue) { "podman-compose" } else { "docker-compose" }
    
    Write-Step "Stopping services..."
    & $composeCmd down
    
    Write-Host "`nDo you want to remove volumes (This will delete all data)? (y/N): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'y' -or $response -eq 'Y') {
        & $composeCmd down -v
        Write-Success "Services and volumes removed"
    } else {
        Write-Success "Services stopped (data preserved)"
    }
}

function Rebuild-Application {
    $composeCmd = if (Get-Command podman-compose -ErrorAction SilentlyContinue) { "podman-compose" } else { "docker-compose" }
    
    Write-Step "Rebuilding backend..."
    & $composeCmd build backend
    
    Write-Step "Restarting backend..."
    & $composeCmd up -d backend
    
    Write-Success "Backend rebuilt and restarted"
}

function Show-Status {
    Write-Step "Service Status"
    Write-Host ""
    
    Write-Host "Containers:" -ForegroundColor Yellow
    podman ps -a --filter "name=occurrence-annotation"
    
    Write-Host "`nNetworks:" -ForegroundColor Yellow
    podman network ls --filter "name=backend-service"
    
    Write-Host "`nVolumes:" -ForegroundColor Yellow
    podman volume ls --filter "name=backend-service"
    
    Write-Host "`nPodman Machine:" -ForegroundColor Yellow
    podman machine list
}

function Show-Logs {
    Write-Host "Which logs do you want to see?" -ForegroundColor Yellow
    Write-Host "  1. Backend"
    Write-Host "  2. PostgreSQL"
    Write-Host "  3. Both"
    $choice = Read-Host "Enter choice (1-3)"
    
    switch ($choice) {
        "1" {
            Write-Step "Backend logs (Ctrl+C to exit):"
            podman logs -f occurrence-annotation-backend
        }
        "2" {
            Write-Step "PostgreSQL logs (Ctrl+C to exit):"
            podman logs -f occurrence-annotation-db
        }
        "3" {
            $composeCmd = if (Get-Command podman-compose -ErrorAction SilentlyContinue) { "podman-compose" } else { "docker-compose" }
            Write-Step "All logs (Ctrl+C to exit):"
            & $composeCmd logs -f
        }
        default {
            Write-Error "Invalid choice"
        }
    }
}

# Main script execution
switch ($Action) {
    "deploy" { Deploy-Application }
    "teardown" { Teardown-Application }
    "rebuild" { Rebuild-Application }
    "status" { Show-Status }
    "logs" { Show-Logs }
}
