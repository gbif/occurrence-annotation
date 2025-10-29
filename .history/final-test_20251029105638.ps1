# Final comprehensive test of basisOfRecord functionality
Write-Host "=== FINAL BASISOFRECORD API TEST ===" -ForegroundColor Green

# Test individual filters
Write-Host "`n1. Testing PRESERVED_SPECIMEN filter..." -ForegroundColor Yellow
$preserved = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=PRESERVED_SPECIMEN" -Method GET
Write-Host "   Found: $($preserved.Count) rules" -ForegroundColor Green
foreach ($rule in $preserved) {
    Write-Host "   - Rule $($rule.id): basisOfRecord='$($rule.basisOfRecord)'" -ForegroundColor Gray
}

Write-Host "`n2. Testing HUMAN_OBSERVATION filter..." -ForegroundColor Yellow
$human = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=HUMAN_OBSERVATION" -Method GET
Write-Host "   Found: $($human.Count) rules" -ForegroundColor Green
foreach ($rule in $human) {
    Write-Host "   - Rule $($rule.id): basisOfRecord='$($rule.basisOfRecord)'" -ForegroundColor Gray
}

Write-Host "`n3. Testing MACHINE_OBSERVATION filter (should be 0)..." -ForegroundColor Yellow
$machine = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=MACHINE_OBSERVATION" -Method GET
Write-Host "   Found: $($machine.Count) rules" -ForegroundColor Green

Write-Host "`n4. Testing combined filter (taxonKey + basisOfRecord)..." -ForegroundColor Yellow
$combined = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?taxonKey=123456&basisOfRecord=PRESERVED_SPECIMEN" -Method GET
Write-Host "   Found: $($combined.Count) rules with taxonKey=123456 AND basisOfRecord=PRESERVED_SPECIMEN" -ForegroundColor Green

Write-Host "`n5. All rules summary..." -ForegroundColor Yellow
$all = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
Write-Host "   Total rules: $($all.Count)" -ForegroundColor Green
foreach ($rule in $all) {
    Write-Host "   - Rule $($rule.id): taxonKey=$($rule.taxonKey), basisOfRecord='$($rule.basisOfRecord)', annotation=$($rule.annotation)" -ForegroundColor Gray
}

Write-Host "`n=== RESULTS SUMMARY ===" -ForegroundColor Green
Write-Host "✅ PRESERVED_SPECIMEN filter: $($preserved.Count) rule(s)" -ForegroundColor Green
Write-Host "✅ HUMAN_OBSERVATION filter: $($human.Count) rule(s)" -ForegroundColor Green  
Write-Host "✅ MACHINE_OBSERVATION filter: $($machine.Count) rule(s)" -ForegroundColor Green
Write-Host "✅ Combined filter: $($combined.Count) rule(s)" -ForegroundColor Green
Write-Host "✅ Total rules: $($all.Count) rule(s)" -ForegroundColor Green

if ($preserved.Count -eq 1 -and $human.Count -eq 1 -and $machine.Count -eq 0 -and $combined.Count -eq 1 -and $all.Count -eq 2) {
    Write-Host "`n🎉 SUCCESS: All basisOfRecord functionality working perfectly!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Unexpected results - please review" -ForegroundColor Red
}