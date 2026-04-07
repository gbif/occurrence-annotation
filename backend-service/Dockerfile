# Multi-stage build for Spring Boot application
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests -B && \
    ls -la target/*.jar

# Runtime stage
FROM eclipse-temurin:17-jre

WORKDIR /app

# Copy the executable jar with all dependencies
COPY --from=builder /app/target/occurrence-annotation-ws-*-exec.jar app.jar

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"]
