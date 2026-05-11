@echo off
REM MCP-Generator Release Script (Windows)
REM Usage: release.bat [patch^|minor^|major^|prerelease]

setlocal enabledelayedexpansion

set "VERSION_TYPE=%1"
if "!VERSION_TYPE!"=="" set "VERSION_TYPE=prerelease"

echo.
echo ========================================
echo MCP-Generator Release Process
echo ========================================
echo Version type: !VERSION_TYPE!
echo.

REM Check prerequisites
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js not found
    exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
    echo Error: Git not found
    exit /b 1
)

REM Check git status
for /f %%A in ('git status -s') do (
    echo Error: Working directory not clean. Commit changes first.
    git status -s
    exit /b 1
)

REM Check branch
for /f %%A in ('git rev-parse --abbrev-ref HEAD') do set "CURRENT_BRANCH=%%A"
if not "!CURRENT_BRANCH!"=="main" (
    echo Error: Not on main branch. Current branch: !CURRENT_BRANCH!
    exit /b 1
)

REM Pull latest
echo [*] Pulling latest changes...
git pull origin main
if errorlevel 1 exit /b 1

REM Install
echo [*] Installing dependencies...
call npm ci
if errorlevel 1 exit /b 1

REM Test
echo [*] Running tests...
call npm test
if errorlevel 1 exit /b 1

REM Build
echo [*] Building...
call npm run build
if errorlevel 1 exit /b 1

REM Update version
echo [*] Bumping version (!VERSION_TYPE!)...
if "!VERSION_TYPE!"=="prerelease" (
    call npm version prerelease --preid=rc
) else (
    call npm version !VERSION_TYPE!
)
if errorlevel 1 exit /b 1

REM Get new version
for /f %%A in ('node -p "require(\'./package.json\').version"') do set "NEW_VERSION=%%A"
echo [+] New version: !NEW_VERSION!

REM Push
echo [*] Pushing to GitHub...
git push origin main --tags
if errorlevel 1 exit /b 1

REM Create release
echo [*] Creating GitHub Release...
call gh release create v!NEW_VERSION! ^
    --title "MCP-Generator v!NEW_VERSION!" ^
    --notes "Automated release from release script" ^
    --generate-release-notes
if errorlevel 1 echo Warning: GitHub Release creation may have failed

echo.
echo ========================================
echo [+] Release Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Monitor GitHub Actions for npm publish
echo   2. Update Product Hunt if needed
echo   3. Share on social media
echo.
echo Release URL: https://github.com/ChristopherDond/MCP-Generator/releases/tag/v!NEW_VERSION!
echo.
