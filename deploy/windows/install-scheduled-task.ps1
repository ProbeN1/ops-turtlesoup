param(
  [string]$TaskName = "OpsTurtleSoup",
  [string]$ProjectPath = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$NodeCommand = "npm",
  [string]$StartArguments = "start",
  [string]$LogDirectory = "logs",
  [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$resolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).Path
$envPath = Join-Path $resolvedProjectPath ".env"
if (-not (Test-Path -LiteralPath $envPath)) {
  throw ".env was not found at $envPath"
}

$resolvedLogDirectory = Join-Path $resolvedProjectPath $LogDirectory
New-Item -ItemType Directory -Force -Path $resolvedLogDirectory | Out-Null

$stdoutPath = Join-Path $resolvedLogDirectory "ops-turtle-soup.out.log"
$stderrPath = Join-Path $resolvedLogDirectory "ops-turtle-soup.err.log"

$escapedProjectPath = $resolvedProjectPath.Replace("'", "''")
$escapedNodeCommand = $NodeCommand.Replace("'", "''")
$escapedStdoutPath = $stdoutPath.Replace("'", "''")
$escapedStderrPath = $stderrPath.Replace("'", "''")

$powershellArguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command",
  "Set-Location -LiteralPath '$escapedProjectPath'; & '$escapedNodeCommand' $StartArguments 1>> '$escapedStdoutPath' 2>> '$escapedStderrPath'"
) -join " "

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $powershellArguments -WorkingDirectory $resolvedProjectPath
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Days 0) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Runs the Ops Turtle Soup intranet game service on startup." `
  -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

Write-Host "Registered scheduled task: $TaskName"
Write-Host "Project path: $resolvedProjectPath"
Write-Host "Stdout log: $stdoutPath"
Write-Host "Stderr log: $stderrPath"
Write-Host "Check status: Get-ScheduledTask -TaskName $TaskName"
