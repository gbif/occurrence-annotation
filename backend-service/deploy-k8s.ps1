# Kubernetes deployment script for Occurrence Annotation
# Run this from the backend-service directory

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("deploy", "teardown", "rebuild", "status", "logs")]
    [string]$Action = "deploy"
)

$namespace = "occurrence-annotation"
$k8sDir = "k8s"

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
    
    # Check kubectl
    try {
        $null = kubectl version --client 2>$null
        Write-Success "kubectl is installed"
    } catch {
        Write-Error "kubectl is not installed or not in PATH"
        exit 1
    }
    
    # Check Docker Desktop Kubernetes
    $context = kubectl config current-context
    if ($context -ne "docker-desktop") {
        Write-Host "Current context is: $context" -ForegroundColor Yellow
        Write-Host "Switching to docker-desktop..." -ForegroundColor Yellow
        kubectl config use-context docker-desktop
    }
    Write-Success "Using docker-desktop context"
}

function Deploy-Application {
    Check-Prerequisites
    
    Write-Step "Building Docker image..."
    docker build -t occurrence-annotation-backend:latest .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        exit 1
    }
    Write-Success "Docker image built"
    
    Write-Step "Creating namespace..."
    kubectl apply -f $k8sDir/namespace.yaml
    
    Write-Step "Creating init scripts ConfigMap..."
    kubectl create configmap postgres-init-scripts `
        --from-file=schema.sql=src/main/resources/schema.sql `
        -n $namespace `
        --dry-run=client -o yaml | kubectl apply -f -
    Write-Success "ConfigMap created"
    
    Write-Step "Deploying PostgreSQL..."
    kubectl apply -f $k8sDir/postgres-secrets.yaml
    kubectl apply -f $k8sDir/postgres-pvc.yaml
    kubectl apply -f $k8sDir/postgres-deployment.yaml
    kubectl apply -f $k8sDir/postgres-service.yaml
    
    Write-Step "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $namespace --timeout=300s
    if ($LASTEXITCODE -ne 0) {
        Write-Error "PostgreSQL failed to start. Check logs with: kubectl logs -l app=postgres -n $namespace"
        exit 1
    }
    Write-Success "PostgreSQL is ready"
    
    Write-Step "Deploying backend..."
    kubectl apply -f $k8sDir/backend-configmap.yaml
    kubectl apply -f $k8sDir/backend-deployment.yaml
    kubectl apply -f $k8sDir/backend-service.yaml
    
    Write-Step "Waiting for backend to be ready..."
    kubectl wait --for=condition=ready pod -l app=backend -n $namespace --timeout=300s
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Backend failed to start. Check logs with: kubectl logs -l app=backend -n $namespace"
        exit 1
    }
    Write-Success "Backend is ready"
    
    Write-Step "Deployment complete!"
    Write-Host ""
    Write-Host "Application is available at:" -ForegroundColor Green
    Write-Host "  Swagger UI: http://localhost:8080/swagger-ui/index.html" -ForegroundColor Cyan
    Write-Host "  API Docs:   http://localhost:8080/v1/occurrence/annotation/docs" -ForegroundColor Cyan
    Write-Host "  Health:     http://localhost:8080/actuator/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Yellow
    Write-Host "  View status:  .\deploy-k8s.ps1 -Action status" -ForegroundColor Gray
    Write-Host "  View logs:    .\deploy-k8s.ps1 -Action logs" -ForegroundColor Gray
    Write-Host "  Teardown:     .\deploy-k8s.ps1 -Action teardown" -ForegroundColor Gray
}

function Teardown-Application {
    Write-Step "Tearing down application..."
    
    kubectl delete -f $k8sDir/backend-service.yaml 2>$null
    kubectl delete -f $k8sDir/backend-deployment.yaml 2>$null
    kubectl delete -f $k8sDir/backend-configmap.yaml 2>$null
    kubectl delete -f $k8sDir/postgres-service.yaml 2>$null
    kubectl delete -f $k8sDir/postgres-deployment.yaml 2>$null
    kubectl delete configmap postgres-init-scripts -n $namespace 2>$null
    kubectl delete -f $k8sDir/postgres-pvc.yaml 2>$null
    kubectl delete -f $k8sDir/postgres-secrets.yaml 2>$null
    
    Write-Host "`nDo you want to delete the namespace (This will remove all data)? (y/N): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq 'y' -or $response -eq 'Y') {
        kubectl delete namespace $namespace
        Write-Success "Namespace deleted"
    } else {
        Write-Host "Namespace kept" -ForegroundColor Gray
    }
    
    Write-Success "Teardown complete"
}

function Rebuild-Application {
    Write-Step "Rebuilding application..."
    
    Write-Step "Building new Docker image..."
    docker build -t occurrence-annotation-backend:latest .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        exit 1
    }
    Write-Success "Docker image rebuilt"
    
    Write-Step "Restarting backend deployment..."
    kubectl rollout restart deployment/backend -n $namespace
    
    Write-Step "Waiting for rollout to complete..."
    kubectl rollout status deployment/backend -n $namespace
    
    Write-Success "Backend restarted with new image"
}

function Show-Status {
    Write-Step "Application Status"
    Write-Host ""
    
    Write-Host "Pods:" -ForegroundColor Yellow
    kubectl get pods -n $namespace
    
    Write-Host "`nServices:" -ForegroundColor Yellow
    kubectl get svc -n $namespace
    
    Write-Host "`nDeployments:" -ForegroundColor Yellow
    kubectl get deployments -n $namespace
    
    Write-Host "`nPersistent Volume Claims:" -ForegroundColor Yellow
    kubectl get pvc -n $namespace
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
            kubectl logs -f deployment/backend -n $namespace
        }
        "2" {
            Write-Step "PostgreSQL logs (Ctrl+C to exit):"
            kubectl logs -f deployment/postgres -n $namespace
        }
        "3" {
            Write-Step "Opening both log streams..."
            Write-Host "Opening backend logs in new window..."
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "kubectl logs -f deployment/backend -n $namespace"
            Write-Host "Opening postgres logs in new window..."
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "kubectl logs -f deployment/postgres -n $namespace"
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
