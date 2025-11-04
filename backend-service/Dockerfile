# Use Eclipse Temurin JDK 11 as base image
FROM eclipse-temurin:11-jre

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy the JAR file
COPY target/occurrence-annotation-ws-*-exec.jar app.jar

# Expose the port (Spring Boot default is 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]