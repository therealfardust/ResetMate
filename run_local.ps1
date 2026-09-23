Set-Location "$PSScriptRoot\web"
Write-Host "Reset Mate Lab: http://localhost:8123"
python -m http.server 8123
