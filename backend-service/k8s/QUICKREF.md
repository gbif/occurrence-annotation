# Kubernetes Quick Reference for Occurrence Annotation

## Quick Start (One Command)
```powershell
cd backend-service
.\deploy-k8s.ps1
```

## Script Commands
```powershell
.\deploy-k8s.ps1 -Action deploy     # Full deployment
.\deploy-k8s.ps1 -Action status     # Check status
.\deploy-k8s.ps1 -Action logs       # View logs
.\deploy-k8s.ps1 -Action rebuild    # Rebuild after code changes
.\deploy-k8s.ps1 -Action teardown   # Remove everything
```

## Manual Commands

### Deploy
```powershell
cd backend-service

# Build and deploy
docker build -t occurrence-annotation-backend:latest .
kubectl apply -k k8s/

# Wait for ready
kubectl wait --for=condition=ready pod -l app=postgres -n occurrence-annotation --timeout=300s
kubectl wait --for=condition=ready pod -l app=backend -n occurrence-annotation --timeout=300s
```

### Check Status
```powershell
kubectl get all -n occurrence-annotation
kubectl get pods -n occurrence-annotation -w  # Watch mode
```

### View Logs
```powershell
kubectl logs -f deployment/backend -n occurrence-annotation
kubectl logs -f deployment/postgres -n occurrence-annotation
kubectl logs --tail=50 -l app=backend -n occurrence-annotation  # Last 50 lines
```

### Access Pods
```powershell
# PostgreSQL shell
kubectl exec -it deployment/postgres -n occurrence-annotation -- psql -U postgres -d annotation

# Backend container shell
kubectl exec -it deployment/backend -n occurrence-annotation -- /bin/bash
```

### Restart Services
```powershell
kubectl rollout restart deployment/backend -n occurrence-annotation
kubectl rollout restart deployment/postgres -n occurrence-annotation
```

### Port Forwarding (Alternative to LoadBalancer)
```powershell
# Forward backend to localhost:8080
kubectl port-forward -n occurrence-annotation svc/backend 8080:8080

# Forward postgres to localhost:5432
kubectl port-forward -n occurrence-annotation svc/postgres 5432:5432
```

### Scale Deployments
```powershell
kubectl scale deployment/backend --replicas=2 -n occurrence-annotation
kubectl scale deployment/backend --replicas=1 -n occurrence-annotation
```

### Debug
```powershell
# Describe resources
kubectl describe pod -l app=backend -n occurrence-annotation
kubectl describe deployment backend -n occurrence-annotation

# Get events
kubectl get events -n occurrence-annotation --sort-by='.lastTimestamp'

# Get previous container logs (if crashed)
kubectl logs -l app=backend -n occurrence-annotation --previous
```

### Clean Up
```powershell
# Delete specific resources
kubectl delete deployment backend -n occurrence-annotation
kubectl delete pvc postgres-pvc -n occurrence-annotation

# Delete everything
kubectl delete namespace occurrence-annotation
```

## Application URLs

After deployment:
- **Swagger UI**: http://localhost:8080/swagger-ui/index.html
- **API Docs**: http://localhost:8080/v1/occurrence/annotation/docs
- **Health Check**: http://localhost:8080/actuator/health

## Database Connection

From outside cluster (using port-forward):
```bash
psql -h localhost -p 5432 -U postgres -d annotation
# Password: postgres
```

From inside cluster:
```
Host: postgres
Port: 5432
Database: annotation
Username: postgres
Password: postgres
```

## Common Issues

### Image not found
```powershell
# Ensure image is built locally
docker images | grep occurrence-annotation-backend
docker build -t occurrence-annotation-backend:latest .
```

### Port already in use
```powershell
# Check what's using port 8080
netstat -ano | findstr :8080

# Change service type or use port-forward instead
```

### Database won't start
```powershell
# Check logs
kubectl logs -f deployment/postgres -n occurrence-annotation

# Delete PVC and redeploy (WARNING: loses data)
kubectl delete pvc postgres-pvc -n occurrence-annotation
```

### Backend can't connect to database
```powershell
# Verify postgres is running
kubectl get pods -n occurrence-annotation

# Check backend logs for connection errors
kubectl logs -f deployment/backend -n occurrence-annotation
```

## Configuration Changes

### Update backend configuration
1. Edit `k8s/backend-configmap.yaml`
2. Apply changes:
```powershell
kubectl apply -f k8s/backend-configmap.yaml
kubectl rollout restart deployment/backend -n occurrence-annotation
```

### Update database credentials
1. Edit `k8s/postgres-secrets.yaml`
2. Apply changes:
```powershell
kubectl apply -f k8s/postgres-secrets.yaml
kubectl rollout restart deployment/postgres -n occurrence-annotation
kubectl rollout restart deployment/backend -n occurrence-annotation
```

## Monitoring

### Resource usage
```powershell
kubectl top pods -n occurrence-annotation
kubectl top nodes
```

### Live watch
```powershell
kubectl get pods -n occurrence-annotation -w
```

### Dashboard (if installed)
```powershell
kubectl proxy
# Then open: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```
