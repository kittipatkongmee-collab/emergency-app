param(
  [string]$OutputDirectory = "artifacts"
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root 'apps/api-php'
$staging = Join-Path $root '.directadmin-package'
$output = Join-Path $root $OutputDirectory
$zip = Join-Path $output 'police-incident-directadmin.zip'

if (-not (Test-Path (Join-Path $api 'vendor/autoload.php'))) {
  throw 'Run composer install --working-dir=apps/api-php --no-dev --optimize-autoloader first.'
}

Push-Location $root
try {
  pnpm --filter @police/admin-web exec ng build --configuration production --base-href /backoffice/
  if ($LASTEXITCODE -ne 0) { throw 'Angular production build failed.' }
} finally {
  Pop-Location
}

if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging, $output | Out-Null

$publicApi = Join-Path $staging 'public_html/api/v1'
$publicBackoffice = Join-Path $staging 'public_html/backoffice'
$publicImages = Join-Path $staging 'public_html/image_emer'
$private = Join-Path $staging 'private/police-api'
New-Item -ItemType Directory -Force -Path $publicApi, $publicBackoffice, $publicImages, $private | Out-Null

Copy-Item (Join-Path $api 'deploy/api-index.php') (Join-Path $publicApi 'index.php')
Copy-Item (Join-Path $api 'deploy/api.htaccess') (Join-Path $publicApi '.htaccess')
Copy-Item (Join-Path $api 'deploy/api.user.ini') (Join-Path $publicApi '.user.ini')
Copy-Item (Join-Path $api 'deploy/image.htaccess') (Join-Path $publicImages '.htaccess')

$webDist = Join-Path $root 'apps/admin-web/dist/admin-web/browser'
if (-not (Test-Path $webDist)) { $webDist = Join-Path $root 'apps/admin-web/dist/admin-web' }
Copy-Item (Join-Path $webDist '*') $publicBackoffice -Recurse
Copy-Item (Join-Path $api 'deploy/backoffice.htaccess') (Join-Path $publicBackoffice '.htaccess')

foreach ($name in @('src', 'bin', 'database', 'firebase', 'vendor')) {
  Copy-Item (Join-Path $api $name) (Join-Path $private $name) -Recurse
}
Copy-Item (Join-Path $api 'composer.json'), (Join-Path $api 'composer.lock'), (Join-Path $api '.env.example') $private
Copy-Item (Join-Path $root 'docs/directadmin-php-deployment.md') $staging

if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $staging -Recurse -File -Force | ForEach-Object {
    $entryName = $_.FullName.Substring($staging.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive,
      $_.FullName,
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Output $zip
