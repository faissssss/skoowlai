$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($process) {
    $pid_to_kill = $process.OwningProcess
    Write-Host "Killing process $pid_to_kill on port $port..."
    Stop-Process -Id $pid_to_kill -Force
    Write-Host "Process killed."
} else {
    Write-Host "No process found on port $port."
}

$lockFile = ".next\dev\lock"
if (Test-Path $lockFile) {
    Write-Host "Removing lock file..."
    Remove-Item $lockFile -Force
    Write-Host "Lock file removed."
}

Write-Host "Port $port is now free. You can run 'npm run dev' now."
