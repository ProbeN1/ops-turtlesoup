# Worklog: Windows Scheduled Task Deployment

Date: 2026-07-01

## Work Completed

- Added `deploy/windows/install-scheduled-task.ps1` for Windows intranet hosts where Docker is not available.
- The script registers an at-startup scheduled task, runs from the project directory, verifies `.env` exists, and redirects stdout/stderr to `logs/`.
- Updated deployment docs, process management runbook, release checklist, release record template, changelog, and regression checks.

## Files Changed

- `deploy/windows/install-scheduled-task.ps1`
- `docs/deployment.md`
- `docs/runbook/process-management.md`
- `docs/runbook/release-checklist.md`
- `docs/runbook/release-record-template.md`
- `docs/changelog.md`

## Test Results

```text
npm test
All tests passed
```

```text
PowerShell parser check
PowerShell syntax OK
```

## Risks

- The script must be run from an elevated PowerShell session on the target Windows host.
- Task account policy and local execution policy may vary by intranet environment.

## Next Steps

- Run the script on the target Windows host if Docker is unavailable, then capture `Get-ScheduledTask -TaskName OpsTurtleSoup` in the release record.
