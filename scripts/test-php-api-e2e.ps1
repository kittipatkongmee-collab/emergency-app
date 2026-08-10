param(
  [string]$BaseUrl = 'http://localhost:8085/api/v1'
)

$ErrorActionPreference = 'Stop'

function Invoke-JsonPost([string]$Uri, [hashtable]$Body, [hashtable]$Headers = @{}) {
  $json = $Body | ConvertTo-Json -Depth 10 -Compress
  Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

$citizenLogin = Invoke-JsonPost "$BaseUrl/auth/development-login" @{ profileId = 'test1' }
$citizenHeaders = @{
  Authorization = "Bearer $($citizenLogin.data.accessToken)"
  'Idempotency-Key' = "e2e-$([guid]::NewGuid().ToString('N'))"
}
$incidentBody = @{
  reporterName = 'ผู้ทดสอบระบบ'
  reporterPhone = '0812345678'
  type = 'AIRCRAFT_ACCIDENT'
  description = 'ทดสอบเส้นทางการแจ้งเหตุจาก PHP API แบบครบวงจร'
  latitude = 13.7563
  longitude = 100.5018
  address = 'กรุงเทพมหานคร'
  priority = 'NORMAL'
}
$created = Invoke-JsonPost "$BaseUrl/incidents" $incidentBody $citizenHeaders
$replayed = Invoke-JsonPost "$BaseUrl/incidents" $incidentBody $citizenHeaders
if ($created.data.id -ne $replayed.data.id) { throw 'Idempotency contract failed.' }

$imagePath = Join-Path ([IO.Path]::GetTempPath()) "police-e2e-$([guid]::NewGuid().ToString('N')).png"
$onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
[IO.File]::WriteAllBytes($imagePath, [Convert]::FromBase64String($onePixelPng))
try {
  $uploadJson = & curl.exe --silent --show-error --request POST --header "Authorization: $($citizenHeaders.Authorization)" --form "files=@$imagePath;type=image/png" "$BaseUrl/incidents/$($created.data.id)/images"
  if ($LASTEXITCODE -ne 0) { throw 'Image upload request failed.' }
  $upload = $uploadJson | ConvertFrom-Json
  if (-not $upload.success) { throw "Image upload API failed: $uploadJson" }
  if ($upload.data.Count -ne 1) { throw 'Image upload contract failed.' }
  $imageUrl = [string]$upload.data[0].imageUrl
  $mediaUri = [Uri]::new([Uri]$BaseUrl, $imageUrl)
  $download = Invoke-WebRequest -UseBasicParsing -Uri $mediaUri
  if ($download.StatusCode -ne 200) { throw "Uploaded image returned HTTP $($download.StatusCode)." }
  if ($download.Headers['Content-Type'] -notlike 'image/*') { throw 'Uploaded image has an invalid content type.' }
  if ($download.RawContentLength -le 0) { throw 'Uploaded image response is empty.' }
} finally {
  Remove-Item -LiteralPath $imagePath -Force -ErrorAction SilentlyContinue
}

$adminLogin = Invoke-JsonPost "$BaseUrl/admin/auth/login" @{
  username = 'integration-admin'
  password = 'Integration-Password-123'
}
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.accessToken)" }
$accepted = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/admin/incidents/$($created.data.id)/accept" -Headers $adminHeaders
if ($accepted.data.status -ne 'IN_PROGRESS') { throw 'Incident accept workflow failed.' }
$completed = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/admin/incidents/$($created.data.id)/complete" -Headers $adminHeaders
if ($completed.data.status -ne 'COMPLETED') { throw 'Incident complete workflow failed.' }

Write-Output "PHP API E2E passed for $($created.data.caseCode)."
