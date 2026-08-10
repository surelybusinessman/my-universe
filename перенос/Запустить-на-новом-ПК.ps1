# Разворачивает «Мою Вселенную» на новом компьютере.
# Запуск: правой кнопкой по файлу -> «Выполнить с помощью PowerShell».
# Скрипт ничего не удаляет и не трогает системные настройки.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root 'my-universe'

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  $text" -ForegroundColor Yellow }

Write-Host @'

  МОЯ ВСЕЛЕННАЯ - установка на новом компьютере

'@ -ForegroundColor Magenta

if (-not (Test-Path $project)) {
    Write-Host "Не найдена папка my-universe рядом со скриптом." -ForegroundColor Red
    Write-Host "Скопируйте всю папку переноса целиком, а не отдельные файлы."
    Read-Host "`nEnter для выхода"
    exit 1
}

# PATH внутри этой сессии, чтобы увидеть только что установленные программы
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path','User')
}

Write-Step 'Проверяю Node.js'
Refresh-Path
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Ok "Node.js уже стоит: $(node -v)"
} else {
    Write-Warn 'Node.js не найден, устанавливаю...'
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Refresh-Path
    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Ok "Установлен: $(node -v)"
    } else {
        Write-Host 'Node.js установился, но не виден в этой сессии.' -ForegroundColor Red
        Write-Host 'Закройте это окно и запустите скрипт ещё раз.'
        Read-Host "`nEnter для выхода"
        exit 1
    }
}

Write-Step 'Ставлю зависимости проекта'
Write-Host '  Это займёт пару минут и скачает около 200 МБ.'
Set-Location $project
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host 'npm install завершился с ошибкой.' -ForegroundColor Red
    Read-Host "`nEnter для выхода"
    exit 1
}
Write-Ok 'Зависимости готовы'

# Подсказка про файл резервной копии
Write-Step 'Проверяю резервную копию данных'
$backupDir = Join-Path $root 'КОПИЯ-ДАННЫХ'
$backup = $null
if (Test-Path $backupDir) {
    $backup = Get-ChildItem -LiteralPath $backupDir -Filter '*.json' -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if ($backup) {
    Write-Ok "Найден файл копии: $($backup.Name)"
    Write-Host "  Полный путь (пригодится через минуту):" -ForegroundColor Gray
    Write-Host "  $($backup.FullName)" -ForegroundColor White
} else {
    Write-Warn 'Файл копии не найден в папке КОПИЯ-ДАННЫХ.'
    Write-Warn 'Без него запустится пустая вселенная. Данные можно будет'
    Write-Warn 'подгрузить позже кнопкой на экране входа.'
}

Write-Step 'Запускаю'
Write-Host @'

  Сейчас откроется адрес http://localhost:5173

  Что делать дальше:
    1. На экране входа внизу нажмите «Перенос с другого устройства»
    2. Выберите файл из папки КОПИЯ-ДАННЫХ
    3. Введите свой пароль — вселенная на месте

  Чтобы остановить сервер, закройте это окно или нажмите Ctrl+C.

'@ -ForegroundColor Gray

Start-Job -ScriptBlock {
    Start-Sleep -Seconds 4
    Start-Process 'http://localhost:5173'
} | Out-Null

npm run dev
