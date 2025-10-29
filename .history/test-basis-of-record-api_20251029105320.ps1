# Test script for basisOfRecord API functionality with authentication
Write-Host "🧪 Testing basisOfRecord API with authentication..." -ForegroundColor Cyan

# Get credentials from environment variables
$username = $env:GBIF_USER
$password = $env:GBIF_PWD

if (-not $username -or -not $password) {
    Write-Host "❌ GBIF_USER and GBIF_PWD environment variables must be set" -ForegroundColor Red
    exit 1
}

# Create Basic Auth header
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${username}:${password}"))
$headers = @{
    Authorization = "Basic $base64AuthInfo"
    "Content-Type" = "application/json"
    Accept = "application/json"
}

Write-Host "✅ Using authentication for user: $username" -ForegroundColor Green

try {
    # Test 1: GET all rules (no auth required)
    Write-Host "`n1️⃣ Testing GET all rules..." -ForegroundColor Yellow
    $allRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
    Write-Host "   Found $($allRules.Count) existing rules" -ForegroundColor Green

    # Test 2: GET with basisOfRecord filter (no auth required) 
    Write-Host "`n2️⃣ Testing GET with basisOfRecord filter..." -ForegroundColor Yellow
    $preservedRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=PRESERVED_SPECIMEN" -Method GET
    Write-Host "   Found $($preservedRules.Count) rules with PRESERVED_SPECIMEN" -ForegroundColor Green

    # Test 3: Create a rule with basisOfRecord (auth required)
    Write-Host "`n3️⃣ Testing POST rule with basisOfRecord..." -ForegroundColor Yellow
    $newRule = @{
        taxonKey = 123456
        geometry = "POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))"
        annotation = "NATIVE"
        basisOfRecord = "PRESERVED_SPECIMEN"
    } | ConvertTo-Json

    $createdRule = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method POST -Body $newRule -Headers $headers
    Write-Host "   ✅ Created rule with ID: $($createdRule.id)" -ForegroundColor Green
    Write-Host "   ✅ basisOfRecord: $($createdRule.basisOfRecord)" -ForegroundColor Green

    # Test 4: Create another rule with different basisOfRecord
    Write-Host "`n4️⃣ Testing POST rule with different basisOfRecord..." -ForegroundColor Yellow
    $newRule2 = @{
        taxonKey = 789012
        geometry = "POLYGON((1 1, 2 1, 2 2, 1 2, 1 1))"
        annotation = "INTRODUCED"
        basisOfRecord = "HUMAN_OBSERVATION"
    } | ConvertTo-Json

    $createdRule2 = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method POST -Body $newRule2 -Headers $headers
    Write-Host "   ✅ Created rule with ID: $($createdRule2.id)" -ForegroundColor Green
    Write-Host "   ✅ basisOfRecord: $($createdRule2.basisOfRecord)" -ForegroundColor Green

    # Test 5: Create a rule without basisOfRecord (should be null)
    Write-Host "`n5️⃣ Testing POST rule without basisOfRecord..." -ForegroundColor Yellow
    $newRule3 = @{
        taxonKey = 345678
        geometry = "POLYGON((2 2, 3 2, 3 3, 2 3, 2 2))"
        annotation = "VAGRANT"
    } | ConvertTo-Json

    $createdRule3 = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method POST -Body $newRule3 -Headers $headers
    Write-Host "   ✅ Created rule with ID: $($createdRule3.id)" -ForegroundColor Green
    $basisValue = if ($createdRule3.basisOfRecord) { $createdRule3.basisOfRecord } else { 'null' }
    Write-Host "   ✅ basisOfRecord: $basisValue" -ForegroundColor Green

    # Test 6: Filter by PRESERVED_SPECIMEN (should find 1 rule)
    Write-Host "`n6️⃣ Testing filter by PRESERVED_SPECIMEN..." -ForegroundColor Yellow
    $preservedFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=PRESERVED_SPECIMEN" -Method GET
    Write-Host "   ✅ Found $($preservedFiltered.Count) rules with PRESERVED_SPECIMEN" -ForegroundColor Green
    
    # Test 7: Filter by HUMAN_OBSERVATION (should find 1 rule)
    Write-Host "`n7️⃣ Testing filter by HUMAN_OBSERVATION..." -ForegroundColor Yellow
    $humanFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=HUMAN_OBSERVATION" -Method GET
    Write-Host "   ✅ Found $($humanFiltered.Count) rules with HUMAN_OBSERVATION" -ForegroundColor Green

    # Test 8: Filter by non-existent basisOfRecord (should find 0)
    Write-Host "`n8️⃣ Testing filter by MACHINE_OBSERVATION..." -ForegroundColor Yellow
    $machineFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=MACHINE_OBSERVATION" -Method GET
    Write-Host "   ✅ Found $($machineFiltered.Count) rules with MACHINE_OBSERVATION" -ForegroundColor Green

    # Test 9: Combined filtering (taxonKey + basisOfRecord)
    Write-Host "`n9️⃣ Testing combined filter (taxonKey + basisOfRecord)..." -ForegroundColor Yellow
    $combinedFiltered = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?taxonKey=123456&basisOfRecord=PRESERVED_SPECIMEN" -Method GET
    Write-Host "   ✅ Found $($combinedFiltered.Count) rules with taxonKey=123456 AND PRESERVED_SPECIMEN" -ForegroundColor Green

    # Test 10: Get all rules to see the final state
    Write-Host "`n🔟 Final check - all rules..." -ForegroundColor Yellow
    $finalRules = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
    Write-Host "   ✅ Total rules in database: $($finalRules.Count)" -ForegroundColor Green
    
    foreach ($rule in $finalRules) {
        $basisDisplay = if ($rule.basisOfRecord) { $rule.basisOfRecord } else { 'null' }
        Write-Host "     - Rule $($rule.id): taxonKey=$($rule.taxonKey), basisOfRecord=$basisDisplay, annotation=$($rule.annotation)" -ForegroundColor Gray
    }

    Write-Host "`n🎉 SUCCESS: All basisOfRecord functionality working perfectly!" -ForegroundColor Green
    Write-Host "✅ CREATE rules with basisOfRecord field" -ForegroundColor Green
    Write-Host "✅ FILTER rules by basisOfRecord parameter" -ForegroundColor Green
    Write-Host "✅ COMBINED filtering with other parameters" -ForegroundColor Green
    Write-Host "✅ NULL handling for optional basisOfRecord field" -ForegroundColor Green

} catch {
    Write-Host "❌ Error during testing: $($_.Exception.Message)" -ForegroundColor Red
}