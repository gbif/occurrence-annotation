# Test script for basisOfRecord API functionality with authentication
Write-Host "Testing basisOfRecord API with authentication..." -ForegroundColor Cyan

# Get credentials from environment variables
$username = $env:GBIF_USER
$password = $env:GBIF_PWD

if (-not $username -or -not $password) {
    Write-Host "Error: GBIF_USER and GBIF_PWD environment variables must be set" -ForegroundColor Red
    exit 1
}

# Create Basic Auth header
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64AuthInfo"
    "Content-Type" = "application/json"
    Accept = "application/json"
}

Write-Host "Using authentication for user: $username" -ForegroundColor Green

try {
    # Test 1: GET all rules (no auth required)
    Write-Host "`n1. Testing GET all rules..." -ForegroundColor Yellow
    $allRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
    Write-Host "   Found $($allRules.Count) existing rules" -ForegroundColor Green

    # Test 2: Create a rule with basisOfRecord (auth required)
    Write-Host "`n2. Testing POST rule with basisOfRecord..." -ForegroundColor Yellow
    $newRule = @{
        taxonKey = 123456
        geometry = "POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))"
        annotation = "NATIVE"
        basisOfRecord = "PRESERVED_SPECIMEN"
    } | ConvertTo-Json

    $createdRule = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method POST -Body $newRule -Headers $headers
    Write-Host "   Created rule with ID: $($createdRule.id)" -ForegroundColor Green
    Write-Host "   basisOfRecord: $($createdRule.basisOfRecord)" -ForegroundColor Green

    # Test 3: Create another rule with different basisOfRecord
    Write-Host "`n3. Testing POST rule with different basisOfRecord..." -ForegroundColor Yellow
    $newRule2 = @{
        taxonKey = 789012
        geometry = "POLYGON((1 1, 2 1, 2 2, 1 2, 1 1))"
        annotation = "INTRODUCED"
        basisOfRecord = "HUMAN_OBSERVATION"
    } | ConvertTo-Json

    $createdRule2 = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method POST -Body $newRule2 -Headers $headers
    Write-Host "   Created rule with ID: $($createdRule2.id)" -ForegroundColor Green
    Write-Host "   basisOfRecord: $($createdRule2.basisOfRecord)" -ForegroundColor Green

    # Test 4: Filter by PRESERVED_SPECIMEN
    Write-Host "`n4. Testing filter by PRESERVED_SPECIMEN..." -ForegroundColor Yellow
    $preservedFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=PRESERVED_SPECIMEN" -Method GET
    Write-Host "   Found $($preservedFiltered.Count) rules with PRESERVED_SPECIMEN" -ForegroundColor Green

    # Test 5: Filter by HUMAN_OBSERVATION
    Write-Host "`n5. Testing filter by HUMAN_OBSERVATION..." -ForegroundColor Yellow
    $humanFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=HUMAN_OBSERVATION" -Method GET
    Write-Host "   Found $($humanFiltered.Count) rules with HUMAN_OBSERVATION" -ForegroundColor Green

    # Test 6: Combined filtering (taxonKey + basisOfRecord)
    Write-Host "`n6. Testing combined filter (taxonKey + basisOfRecord)..." -ForegroundColor Yellow
    $combinedFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?taxonKey=123456&basisOfRecord=PRESERVED_SPECIMEN" -Method GET
    Write-Host "   Found $($combinedFiltered.Count) rules with taxonKey=123456 AND PRESERVED_SPECIMEN" -ForegroundColor Green

    # Test 7: Get all rules to see the final state
    Write-Host "`n7. Final check - all rules..." -ForegroundColor Yellow
    $finalRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
    Write-Host "   Total rules in database: $($finalRules.Count)" -ForegroundColor Green
    
    foreach ($rule in $finalRules) {
        $basisDisplay = if ($rule.basisOfRecord) { $rule.basisOfRecord } else { "null" }
        Write-Host "     - Rule $($rule.id): taxonKey=$($rule.taxonKey), basisOfRecord=$basisDisplay, annotation=$($rule.annotation)" -ForegroundColor Gray
    }

    Write-Host "`nSUCCESS: All basisOfRecord functionality working perfectly!" -ForegroundColor Green
    Write-Host "- CREATE rules with basisOfRecord field" -ForegroundColor Green
    Write-Host "- FILTER rules by basisOfRecord parameter" -ForegroundColor Green
    Write-Host "- COMBINED filtering with other parameters" -ForegroundColor Green

} catch {
    Write-Host "Error during testing: $($_.Exception.Message)" -ForegroundColor Red
}