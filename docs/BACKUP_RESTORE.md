# Backup and restore

## What is protected

The project has three copies of committed data:

1. the local Git repository;
2. the GitHub repository `Nefedorb/evgenbond-site`;
3. weekly full Git bundles stored locally and sent to Telegram through `bondfilebot`.

Pages CMS stores articles and uploaded images as Git commits, so they are included in the same history. Generated `_site`, `node_modules`, ignored local files, secrets, and uncommitted changes are not included.

## Automatic backup

Windows Scheduled Task `Evgenbond-Site-Backup` runs every Sunday at 03:00 and starts later if the computer was unavailable. It executes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\code\333\scripts\windows\backup-repository.ps1
```

The latest 30 local backups are stored in:

```text
%LOCALAPPDATA%\EvgenbondSiteBackup\archives
```

Each successful run also uploads the `.bundle` file to the private Telegram chat with `bondfilebot`. The script reads the selected `TelegramDOC` uploader from the local ShareX configuration. The bot token and chat ID remain in the ShareX profile and are not copied to this repository or backup log.

The log is stored at:

```text
%LOCALAPPDATA%\EvgenbondSiteBackup\backup.log
```

Run a backup manually:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\backup-repository.ps1
```

Reinstall or update the scheduled task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\install-backup-task.ps1
```

## Restore a file or article

Find the commit that contained the required version:

```powershell
git log -- content/blog/article-name.md
git show <commit>:content/blog/article-name.md
```

Restore the file through a new commit:

```powershell
git restore --source <commit> -- content/blog/article-name.md
git add content/blog/article-name.md
git commit -m "restore: recover article"
git push origin main
```

## Roll back a failed release

Do not rewrite shared history. Create a revert commit:

```powershell
git revert <bad-commit>
git push origin main
```

GitHub Actions will rebuild and publish the reverted version.

## Restore the complete repository from a bundle

Use a local `.bundle`, or download the required file from the chat with `bondfilebot`. The Telegram message caption contains the commit SHA and SHA-256 checksum.

Verify the checksum and bundle:

```powershell
Get-FileHash -Algorithm SHA256 .\evgenbond-site-YYYYMMDD-HHMMSS.bundle
git bundle verify .\evgenbond-site-YYYYMMDD-HHMMSS.bundle
```

Compare the SHA-256 value with the adjacent `.sha256` file or the Telegram caption, then clone:

```powershell
git clone .\evgenbond-site-YYYYMMDD-HHMMSS.bundle evgenbond-site-restored
cd evgenbond-site-restored
git remote remove origin
git remote add origin https://github.com/Nefedorb/evgenbond-site.git
npm ci
npm run check
git push -u origin main
```

If the GitHub repository was deleted, create an empty replacement first and use its URL as `origin`.

## Information stored separately

Keep access to the domain registrar, DNS configuration, GitHub account recovery codes, Telegram account, and ShareX uploader configuration outside this repository. Never add passwords, tokens, recovery codes, or private keys to Git or backup documentation.
