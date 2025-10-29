# Final verification of basisOfRecord filtering fix
Write-Host "=== FINAL BASISOFRECORD FILTERING TEST ===" -ForegroundColor Cyan

# Test 1: Filter by PRESERVED_SPECIMEN (should return only rules with that value)
Write-Host "`n1. Testing PRESERVED_SPECIMEN filter..." -ForegroundColor Yellow
$preserved = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=PRESERVED_SPECIMEN" -Method GET
Write-Host "   Found: $($preserved.Count) rules" -ForegroundColor Green
foreach ($rule in $preserved) {
    if ($rule.basisOfRecord -eq "PRESERVED_SPECIMEN") {
        Write-Host "   ✅ Rule $($rule.id): basisOfRecord='$($rule.basisOfRecord)'" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Rule $($rule.id): basisOfRecord='$($rule.basisOfRecord)' (UNEXPECTED!)" -ForegroundColor Red
    }
}

# Test 2: Filter by HUMAN_OBSERVATION (should return only rules with that value)
Write-Host "`n2. Testing HUMAN_OBSERVATION filter..." -ForegroundColor Yellow
$human = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=HUMAN_OBSERVATION" -Method GET
Write-Host "   Found: $($human.Count) rules" -ForegroundColor Green
foreach ($rule in $human) {
    if ($rule.basisOfRecord -eq "HUMAN_OBSERVATION") {
        Write-Host "   ✅ Rule $($rule.id): basisOfRecord='$($rule.basisOfRecord)'" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Rule $($rule.id): basisOfRecord='$($rule.basisOfRecord)' (UNEXPECTED!)" -ForegroundColor Red
    }
}

# Test 3: Filter by non-existent value (should return 0 rules)
Write-Host "`n3. Testing MACHINE_OBSERVATION filter (should be 0)..." -ForegroundColor Yellow
$machine = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule?basisOfRecord=MACHINE_OBSERVATION" -Method GET
Write-Host "   Found: $($machine.Count) rules" -ForegroundColor Green
if ($machine.Count -eq 0) {
    Write-Host "   ✅ Correctly returned 0 rules for non-existent value" -ForegroundColor Green
} else {
    Write-Host "   ❌ Should have returned 0 rules but got $($machine.Count)" -ForegroundColor Red
}

# Test 4: No filter (should return all rules)
Write-Host "`n4. Testing no filter (all rules)..." -ForegroundColor Yellow
$all = Invoke-RestMethod -Uri "http://localhost:8080/occurrence/experimental/annotation/rule" -Method GET
Write-Host "   Found: $($all.Count) total rules" -ForegroundColor Green

# Summary
Write-Host "`n=== RESULTS SUMMARY ===" -ForegroundColor Cyan
$preservedCorrect = ($preserved | Where-Object { $_.basisOfRecord -eq "PRESERVED_SPECIMEN" }).Count -eq $preserved.Count
$humanCorrect = ($human | Where-Object { $_.basisOfRecord -eq "HUMAN_OBSERVATION" }).Count -eq $human.Count
$machineCorrect = $machine.Count -eq 0

if ($preservedCorrect) { Write-Host "✅ PRESERVED_SPECIMEN filter: WORKING" -ForegroundColor Green } else { Write-Host "❌ PRESERVED_SPECIMEN filter: BROKEN" -ForegroundColor Red }
if ($humanCorrect) { Write-Host "✅ HUMAN_OBSERVATION filter: WORKING" -ForegroundColor Green } else { Write-Host "❌ HUMAN_OBSERVATION filter: BROKEN" -ForegroundColor Red }
if ($machineCorrect) { Write-Host "✅ Non-existent filter: WORKING" -ForegroundColor Green } else { Write-Host "❌ Non-existent filter: BROKEN" -ForegroundColor Red }

if ($preservedCorrect -and $humanCorrect -and $machineCorrect) {
    Write-Host "`n🎉 SUCCESS: All basisOfRecord filtering is working correctly!" -ForegroundColor Green
} else {
    Write-Host "`n❌ FAILURE: Some filtering issues remain" -ForegroundColor Red
}