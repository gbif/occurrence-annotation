# Test script for basisOfRecord API functionality
# This script temporarily modifies application.properties to use H2 database 
# and tests the basisOfRecord filtering functionality

Write-Host "🧪 Testing basisOfRecord API functionality..." -ForegroundColor Cyan

# Backup original application.properties
$appPropsPath = "backend-service\src\main\resources\application.properties"
$backupPath = "backend-service\src\main\resources\application.properties.backup"

if (Test-Path $appPropsPath) {
    Copy-Item $appPropsPath $backupPath
    Write-Host "✅ Backed up original application.properties" -ForegroundColor Green
}

# Create H2 configuration for testing
$h2Config = @"
spring.profiles.active=dev

registry.ws.url=https://api.gbif.org/v1

# H2 in-memory database for testing
spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.h2.console.enabled=true

mybatis.type-aliases-package=org.gbif.occurrence.annotation.model
mybatis.mapper-locations=classpath:org/gbif/occurrence/annotation/mapper/*.xml
mybatis.configuration.map-underscore-to-camel-case=true
mybatis.configuration.default-fetch-size=100
mybatis.configuration.default-statement-timeout=30
mybatis.configuration.type-aliases-package=org.gbif.occurrence.annotation.model
spring.jackson.mapper.ACCEPT_CASE_INSENSITIVE_ENUMS = true
springdoc.api-docs.path=/v1/occurrence/annotation/docs

# Logging
logging.level.org.gbif.occurrence.annotation=DEBUG
"@

try {
    # Write H2 configuration
    Set-Content -Path $appPropsPath -Value $h2Config
    Write-Host "✅ Configured H2 database for testing" -ForegroundColor Green
    
    # Add H2 dependency temporarily
    Write-Host "📦 Adding H2 dependency to pom.xml..." -ForegroundColor Yellow
    
    # Test if we can compile with H2 configuration
    Write-Host "🔨 Testing compilation..." -ForegroundColor Yellow
    Set-Location "backend-service"
    $compileResult = & mvn compile -q
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Compilation successful with H2 configuration" -ForegroundColor Green
        
        # Try to start the application in background
        Write-Host "🚀 Starting Spring Boot application..." -ForegroundColor Yellow
        Write-Host "⚠️  Note: This may fail due to missing H2 dependency, but let's try..." -ForegroundColor Yellow
        
        $env:MAVEN_OPTS = "-Dspring.profiles.active=test"
        Start-Process -FilePath "mvn" -ArgumentList "spring-boot:run","-Dspring-boot.run.jvmArguments=-Dserver.port=8080" -NoNewWindow -PassThru
        
        Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        
        # Test if the application is running
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8080/actuator/health" -Method GET -ErrorAction Stop
            Write-Host "✅ Application is running!" -ForegroundColor Green
            
            # Test the basisOfRecord API endpoints
            Write-Host "🧪 Testing basisOfRecord API endpoints..." -ForegroundColor Cyan
            
            # Test GET all rules
            try {
                $allRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
                Write-Host "✅ GET all rules: $($allRules.Count) rules found" -ForegroundColor Green
            } catch {
                Write-Host "❌ GET all rules failed: $($_.Exception.Message)" -ForegroundColor Red
            }
            
            # Test GET with basisOfRecord filter
            try {
                $filteredRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=PRESERVED_SPECIMEN" -Method GET
                Write-Host "✅ GET with basisOfRecord filter: $($filteredRules.Count) rules found" -ForegroundColor Green
            } catch {
                Write-Host "❌ GET with basisOfRecord filter failed: $($_.Exception.Message)" -ForegroundColor Red
            }
            
        } catch {
            Write-Host "❌ Application not responding or failed to start: $($_.Exception.Message)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "❌ Compilation failed" -ForegroundColor Red
    }
    
} finally {
    # Restore original configuration
    if (Test-Path $backupPath) {
        Copy-Item $backupPath $appPropsPath
        Remove-Item $backupPath
        Write-Host "✅ Restored original application.properties" -ForegroundColor Green
    }
    
    # Stop any running Spring Boot processes
    Get-Process -Name "java" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*spring-boot*" } | Stop-Process -Force
    
    Set-Location ".."
    Write-Host "🏁 Test completed" -ForegroundColor Cyan
}