Get-Process -Name "*docker*" -ErrorAction SilentlyContinue
Stop-Process -Id 20784 -Force
& "C:\Program Files\Docker\Docker\Docker Desktop.exe" --factory-reset