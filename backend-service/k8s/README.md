# Kubernetes Setup for Occurrence Annotation (Windows Local Development)

This directory contains Kubernetes manifests for running the occurrence-annotation backend and PostgreSQL database locally on Windows.

## Prerequisites

### 1. Enable Kubernetes in Docker Desktop
- Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- Open Docker Desktop Settings
- Go to **Kubernetes** tab
- Check **Enable Kubernetes**
- Click **Apply & Restart**
- Wait for Kubernetes to start (green indicator in bottom-left)

### 2. Verify kubectl is installed
```powershell
kubectl version --client
```

### 3. Set Docker Desktop Kubernetes as current context
```powershell
kubectl config use-context docker-desktop
```

## Setup Steps

### Step 1: Build the Backend Docker Image

From the `backend-service` directory:

```powershell
# Build the Spring Boot application Docker image
docker build -t occurrence-annotation-backend:latest .
```

This creates a local Docker image that Kubernetes will use.

### Step 2: Create ConfigMap for PostgreSQL Initialization Scripts

First, create a ConfigMap with the database schema:

```powershell
kubectl create configmap postgres-init-scripts `
  --from-file=schema.sql=../src/main/resources/schema.sql `
  --namespace=occurrence-annotation `
  --dry-run=client -o yaml | kubectl apply -f -
```

If the namespace doesn't exist yet, create it first:
```powershell
kubectl apply -f k8s/namespace.yaml
```

Then create the ConfigMap:
```powershell
kubectl create configmap postgres-init-scripts `
  --from-file=schema.sql=../src/main/resources/schema.sql `
  -n occurrence-annotation
```

### Step 3: Deploy to Kubernetes

Apply all manifests in order:

```powershell
cd k8s

# Create namespace
kubectl apply -f namespace.yaml

# Create secrets and persistent storage
kubectl apply -f postgres-secrets.yaml
kubectl apply -f postgres-pvc.yaml

# Deploy PostgreSQL
kubectl apply -f postgres-deployment.yaml
kubectl apply -f postgres-service.yaml

# Wait for PostgreSQL to be ready (this may take 1-2 minutes)
kubectl wait --for=condition=ready pod -l app=postgres -n occurrence-annotation --timeout=300s

# Deploy backend
kubectl apply -f backend-configmap.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml

# Wait for backend to be ready
kubectl wait --for=condition=ready pod -l app=backend -n occurrence-annotation --timeout=300s
```

### Step 4: Access the Application

The backend service uses LoadBalancer type, which Docker Desktop makes available on localhost:

```powershell
# Get the service URL (should show localhost:8080)
kubectl get svc backend -n occurrence-annotation
```

Access the application at:
- **Swagger UI**: http://localhost:8080/swagger-ui/index.html
- **API Docs**: http://localhost:8080/v1/occurrence/annotation/docs
- **Health Check**: http://localhost:8080/actuator/health

## Useful Commands

### View all resources
```powershell
kubectl get all -n occurrence-annotation
```

### Check pod status
```powershell
kubectl get pods -n occurrence-annotation
```

### View logs
```powershell
# Backend logs
kubectl logs -f deployment/backend -n occurrence-annotation

# PostgreSQL logs
kubectl logs -f deployment/postgres -n occurrence-annotation
```

### Exec into pods
```powershell
# Access PostgreSQL
kubectl exec -it deployment/postgres -n occurrence-annotation -- psql -U postgres -d annotation

# Access backend container
kubectl exec -it deployment/backend -n occurrence-annotation -- /bin/bash
```

### Restart deployments
```powershell
kubectl rollout restart deployment/backend -n occurrence-annotation
kubectl rollout restart deployment/postgres -n occurrence-annotation
```

### Delete specific resources
```powershell
kubectl delete deployment backend -n occurrence-annotation
kubectl delete deployment postgres -n occurrence-annotation
```

### Complete teardown
```powershell
# Delete everything (keeps namespace)
kubectl delete -f backend-service.yaml
kubectl delete -f backend-deployment.yaml
kubectl delete -f backend-configmap.yaml
kubectl delete -f postgres-service.yaml
kubectl delete -f postgres-deployment.yaml
kubectl delete -f postgres-pvc.yaml
kubectl delete -f postgres-secrets.yaml

# Or delete entire namespace (removes everything)
kubectl delete namespace occurrence-annotation
```

## Rebuilding After Code Changes

When you make changes to the backend code:

```powershell
# 1. Rebuild the Docker image
cd ..
docker build -t occurrence-annotation-backend:latest .

# 2. Restart the backend deployment
kubectl rollout restart deployment/backend -n occurrence-annotation

# 3. Watch the rollout
kubectl rollout status deployment/backend -n occurrence-annotation
```

## Troubleshooting

### Pods not starting
```powershell
# Check pod status
kubectl describe pod -l app=backend -n occurrence-annotation
kubectl describe pod -l app=postgres -n occurrence-annotation

# Check events
kubectl get events -n occurrence-annotation --sort-by='.lastTimestamp'
```

### Database connection issues
```powershell
# Verify postgres is running
kubectl get pods -l app=postgres -n occurrence-annotation

# Check if database is initialized
kubectl exec -it deployment/postgres -n occurrence-annotation -- psql -U postgres -d annotation -c "\dt"
```

### Image pull errors
If you see `ImagePullBackOff`, ensure:
1. The Docker image is built locally: `docker images | grep occurrence-annotation-backend`
2. The deployment uses `imagePullPolicy: Never`

### Port conflicts
If port 8080 is already in use:
1. Stop other services using port 8080
2. Or edit `backend-service.yaml` to use a different port

## Comparison with Docker Compose

### Docker Compose (previous setup)
- Simple YAML file
- Direct volume mounts
- Automatic networking between services
- Good for simple local development

### Kubernetes (this setup)
- Production-like environment
- Better resource management
- Health checks and auto-restart
- Scalability options
- ConfigMaps and Secrets for configuration
- Closer to production deployment

## Next Steps

- Add Ingress for path-based routing
- Set up Horizontal Pod Autoscaling
- Add resource quotas
- Configure monitoring with Prometheus
- Add Helm charts for easier deployment
