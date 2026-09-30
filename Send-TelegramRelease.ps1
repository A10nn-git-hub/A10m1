# Send-TelegramRelease.ps1
param (
    [string]$Version = "1.45.0",
    [int]$Build = 45,
    [string]$BotToken = "8448302190:AAFMMayMW91ZpbmzdB7ZyhmcVNj4QAPBQBE",
    [string]$UserApkOnly = "8092533566",
    [string]$UserBoth = "6278269178"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\UnityProjects\UniversalGame3D"
$OtaDir = "C:\Users\Артемий\Documents\Проекты\A10m1\ota"

$ApkFile = "C:\UnityProjects\UniversalGame3D\Builds\Android\A10m1_Game_v${Version}_b${Build}.apk"
if (-not (Test-Path $ApkFile)) {
    $ApkFile = Join-Path $OtaDir "A10m1_Game.apk"
}

$ExeFile = "C:\UnityProjects\UniversalGame3D\Builds\Windows_Release\A10m1_UniversalGame.exe"
if (-not (Test-Path $ExeFile)) {
    $ExeFile = "C:\UnityProjects\UniversalGame3D\Builds\Windows\A10m1_UniversalGame.exe"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Отправка сборки v$Version (Build #$Build) в Telegram" -ForegroundColor Cyan
Write-Host "Бот: Mini games (@Smallllll_games_BOT)" -ForegroundColor Cyan
Write-Host "APK: $ApkFile" -ForegroundColor Yellow
Write-Host "EXE: $ExeFile" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

function Send-TelegramMessage {
    param (
        [string]$ChatId,
        [string]$Text
    )
    $url = "https://api.telegram.org/bot$BotToken/sendMessage"
    $body = @{
        chat_id = $ChatId
        text = $Text
        parse_mode = "HTML"
        disable_web_page_preview = $false
    }
    $res = Invoke-RestMethod -Uri $url -Method Post -Body $body
    return $res
}

function Send-TelegramDocument {
    param (
        [string]$ChatId,
        [string]$FilePath,
        [string]$Caption
    )
    Write-Host "📤 Отправка документа $FilePath (Размер: $([math]::Round((Get-Item $FilePath).Length / 1MB, 2)) MB) -> Chat ID $ChatId..." -ForegroundColor Magenta
    
    $args = @(
        "-s",
        "-F", "chat_id=$ChatId",
        "-F", "document=@$FilePath",
        "-F", "caption=$Caption",
        "-F", "parse_mode=HTML",
        "https://api.telegram.org/bot$BotToken/sendDocument"
    )
    
    $rawRes = & curl.exe @args
    try {
        $json = $rawRes | ConvertFrom-Json
        if ($json.ok) {
            Write-Host "✅ Успешно доставлен файл: $(Split-Path $FilePath -Leaf)!" -ForegroundColor Green
            return $json
        } else {
            Write-Host "❌ Ошибка отправки: $($json.description)" -ForegroundColor Red
            return $json
        }
    } catch {
        Write-Host "⚠️ Ответ: $rawRes" -ForegroundColor Yellow
        return $null
    }
}

function Prepare-ApkParts {
    param ([string]$SourceApk)
    $fileInfo = Get-Item $SourceApk
    $length = $fileInfo.Length
    $limit = 48 * 1024 * 1024 # 48 MB per part
    
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "A10m1_Release_v${Version}"
    if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Path $tempDir -Force | Out-Null }
    
    if ($length -le $limit) {
        return @($SourceApk)
    }
    
    $part1 = Join-Path $tempDir "A10m1_Game_v${Version}_b${Build}_part1.apk"
    $part2 = Join-Path $tempDir "A10m1_Game_v${Version}_b${Build}_part2.apk"
    
    $bytes = [System.IO.File]::ReadAllBytes($SourceApk)
    $splitPoint = [int]($bytes.Length / 2)
    
    $part1Bytes = New-Object byte[] $splitPoint
    [Array]::Copy($bytes, 0, $part1Bytes, 0, $splitPoint)
    [System.IO.File]::WriteAllBytes($part1, $part1Bytes)
    
    $part2Bytes = New-Object byte[] ($bytes.Length - $splitPoint)
    [Array]::Copy($bytes, $splitPoint, $part2Bytes, 0, $bytes.Length - $splitPoint)
    [System.IO.File]::WriteAllBytes($part2, $part2Bytes)
    
    Write-Host "📦 APK разделен на 2 части по ~$([math]::Round($splitPoint / 1MB, 1)) MB для преодоления лимита Telegram Bot API (50 MB)" -ForegroundColor Yellow
    return @($part1, $part2)
}

$apkParts = Prepare-ApkParts -SourceApk $ApkFile
$cdnApkUrl = "https://media.githubusercontent.com/media/A10nn-git-hub/A10m1/main/ota/A10m1_Game.apk"

# ==========================================
# 1. Отправка пользователю 8092533566 (ТОЛЬКО APK)
# ==========================================
Write-Host "`n>>> [ЭТАП 1/2] Доставка ПОЛЬЗОВАТЕЛЮ 1 ($UserApkOnly) — ТОЛЬКО APK файл..." -ForegroundColor Cyan

$apkMsg = "🎮 <b>UniversalGame3D / A10m1 — Новая версия v${Version} (Сборка #${Build})</b>`n`n" +
          "✨ <b>Что нового в v${Version}:</b>`n" +
          "• Режим «Ветряные трубы» (Wind_3D): вертикальная шахта, аэродинамические потоки, интерактивные клапаны и батутная сетка`n" +
          "• Режим «Портальный куб» (Cube_3D): квантовые врата, гравитационный переход и бесконечный цикл`n" +
          "• Режим «Плитки» (Tiles_3D): 3x20 островков, обрушение ложных плит и финишная черта`n" +
          "• Режим «Испытания» (Trials_3D): «Импульсный сборщик» и «Резонансный путь»`n`n" +
          "📲 <b>Прямая ссылка для установки APK в 1 клик (без объединения):</b>`n" +
          "👉 <a href=""$cdnApkUrl"">Скачать A10m1_Game.apk (полная версия)</a>`n`n" +
          "Ниже прикреплены части APK файла:"

Send-TelegramMessage -ChatId $UserApkOnly -Text $apkMsg

for ($i = 0; $i -lt $apkParts.Count; $i++) {
    $partNum = $i + 1
    $caption = "📱 <b>A10m1 Game v${Version} (Сборка #${Build}) — Часть $partNum из $($apkParts.Count)</b>`nПрямая ссылка на полный APK: $cdnApkUrl"
    Send-TelegramDocument -ChatId $UserApkOnly -FilePath $apkParts[$i] -Caption $caption
    Start-Sleep -Seconds 1
}

# ==========================================
# 2. Отправка пользователю 6278269178 (APK И EXE ОДНОВРЕМЕННО)
# ==========================================
Write-Host "`n>>> [ЭТАП 2/2] Доставка ПОЛЬЗОВАТЕЛЮ 2 ($UserBoth) — APK И EXE ОДНОВРЕМЕННО..." -ForegroundColor Cyan

$bothMsg = "🎮 <b>UniversalGame3D / A10m1 — Новая версия v${Version} (Сборка #${Build})</b>`n`n" +
           "✨ <b>В релиз включены оба пакета: Windows Standalone (.EXE) и Android (.APK)!</b>`n`n" +
           "• Режим «Ветряные трубы» (Wind_3D)`n" +
           "• Режим «Портальный куб» (Cube_3D)`n" +
           "• Режим «Плитки» (Tiles_3D)`n" +
           "• Режим «Испытания» (Trials_3D)`n`n" +
           "📲 <b>Прямая ссылка на установку APK целиком:</b>`n" +
           "👉 <a href=""$cdnApkUrl"">Скачать A10m1_Game.apk (Android)</a>`n`n" +
           "Отправляем файлы прямо в чат..."

Send-TelegramMessage -ChatId $UserBoth -Text $bothMsg

# Отправляем EXE файл
$exeCaption = "💻 <b>A10m1 UniversalGame v${Version} (#${Build}) — Windows Standalone (.EXE)</b>`nЗапускаемый исполняемый файл для ПК."
Send-TelegramDocument -ChatId $UserBoth -FilePath $ExeFile -Caption $exeCaption

# Отправляем APK файлы
for ($i = 0; $i -lt $apkParts.Count; $i++) {
    $partNum = $i + 1
    $caption = "📱 <b>A10m1 Game v${Version} (Сборка #${Build}) — Android APK (Часть $partNum из $($apkParts.Count))</b>`nПрямая ссылка: $cdnApkUrl"
    Send-TelegramDocument -ChatId $UserBoth -FilePath $apkParts[$i] -Caption $caption
    Start-Sleep -Seconds 1
}

Write-Host "`n🎉 Рассылка версии $Version (#$Build) успешно выполнена обоим пользователям!" -ForegroundColor Green
