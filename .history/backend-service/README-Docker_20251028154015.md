# Running the Occurrence Annotation Backend with Docker

This guide explains how to run the GBIF Occurrence Annotation backend service using Docker.

## Prerequisites

- Docker and Docker Compose installed
- Java 11+ and Maven (for building the JAR file)

## Quick Start

1. **Build the application**:
   ```bash
   mvn clean package -DskipTests
   ```

2. **Start the services**:
   ```bash
   docker-compose up --build
   ```

## What's Included

The Docker setup includes:

- **PostgreSQL 13 database** (`occurrence-annotation-db`)
  - Database: `annotation`
  - User: `postgres`
  - Password: `password`
  - Port: 5432
  - Automatically initializes with schema from `src/main/resources/schema.sql`

- **Spring Boot Application** (`occurrence-annotation-backend`)
  - Java 11 runtime
  - Port: 8080
  - Health checks enabled
  - Auto-restart on dependency ready

## Database Schema

The application uses PostgreSQL with the following tables:
- `project` - Projects containing annotation rules
- `ruleset` - Collections of rules within projects  
- `rule` - Individual annotation rules with geometry and metadata
- `comment` - Comments on rules

## Environment Variables

The following environment variables are configured for Docker:

- `SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/annotation`
- `SPRING_DATASOURCE_USERNAME=postgres`
- `SPRING_DATASOURCE_PASSWORD=password`
- `SPRING_PROFILES_ACTIVE=dev`
- `SPRING_CLOUD_ZOOKEEPER_ENABLED=false`

## API Documentation

Once running, the API documentation is available at:
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI docs: http://localhost:8080/v1/occurrence/annotation/docs

## Health Check

The application includes health checks accessible at:
- http://localhost:8080/actuator/health

## Stopping the Services

To stop all services:
```bash
docker-compose down
```

To stop and remove volumes (will delete database data):
```bash
docker-compose down -v
```

## Troubleshooting

1. **Port conflicts**: If port 8080 or 5432 are in use, modify the ports in `docker-compose.yml`

2. **Build fails**: Ensure you've run `mvn clean package -DskipTests` successfully first

3. **Database connection issues**: Check that PostgreSQL container is healthy before the backend starts

4. **Logs**: View logs with:
   ```bash
   docker-compose logs backend
   docker-compose logs postgres
   ```