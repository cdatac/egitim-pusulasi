@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo HATA: Node.js 24 veya üzeri bulunamadı.
  echo Resmi indirme adresi: https://nodejs.org/en/download
  pause
  exit /b 1
)

node scripts\open-k12-browser.mjs
if errorlevel 1 pause
