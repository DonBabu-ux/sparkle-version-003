# fix-mysql.ps1
# One‑stop script to clear MySQL `lilbee` connections,
# kill stray Node processes, and delete the stale .instance.lock file.

Write-Host "`n🔧 Starting MySQL fix script..." -ForegroundColor Cyan

# ---------- 1️⃣ Locate mysql.exe ----------
$possiblePaths = @(
    "C:\xampp\mysql\bin\mysql.exe",                         # XAMPP
    "C:\wamp64\bin\mysql\*\bin\mysql.exe",                # WAMP (wildcard)
    "C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe", # Standalone 64‑bit
    "C:\Program Files (x86)\MySQL\MySQL Server*\bin\mysql.exe" # Standalone 32‑bit
)

$mysqlPath = $null
foreach ($p in $possiblePaths) {
    $found = Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $mysqlPath = $found.FullName; break }
}

if (-not $mysqlPath) {
    Write-Host "❌ MySQL client not found in common locations." -ForegroundColor Red
    $mysqlPath = Read-Host "Please enter the full path to mysql.exe"
}
Write-Host "✅ Using MySQL client at: $mysqlPath" -ForegroundColor Green

# ---------- 2️⃣ Kill all `lilbee` connections ----------
Write-Host "`n🔪 Killing all connections for MySQL user `lilbee`..." -ForegroundColor Yellow
& "$mysqlPath" -u root -p -e "SELECT CONCAT('KILL ', id, ';') FROM information_schema.processlist WHERE user='lilbee'" |
    & "$mysqlPath" -u root -p

# ---------- 3️⃣ Show current connection counts ----------
Write-Host "`n📊 Current MySQL connection counts (per user):" -ForegroundColor Cyan
& "$mysqlPath" -u root -p -e "SELECT user, COUNT(*) AS cnt FROM information_schema.processlist GROUP BY user ORDER BY cnt DESC;"

# ---------- 4️⃣ Kill stray Node processes ----------
Write-Host "`n🔪 Killing any leftover Node processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null

# ---------- 5️⃣ Delete stale .instance.lock ----------
$lockFile = ".instance.lock"
if (Test-Path $lockFile) {
    Write-Host "`n🗑️ Deleting stale lock file ($lockFile)..." -ForegroundColor Yellow
    Remove-Item $lockFile -Force
} else {
    Write-Host "`n✅ No .instance.lock file found."
}

Write-Host "`n✅ All done! 🎉" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1️⃣ Edit MySQL config (my.ini) and raise limits:" -ForegroundColor White
Write-Host "     max_connections = 200" -ForegroundColor White
Write-Host "     max_user_connections = 100" -ForegroundColor White
Write-Host "  2️⃣ Restart MySQL: net stop mysql && net start mysql" -ForegroundColor White
Write-Host "  3️⃣ Restart the server: npm run dev" -ForegroundColor White
Write-Host "After restart, verify DB health: curl http://localhost:3000/health/db" -ForegroundColor Cyan
