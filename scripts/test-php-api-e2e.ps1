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
$onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
$incidentBody = @{
  reporterName = 'ผู้ทดสอบระบบ'
  reporterPhone = '0812345678'
  type = 'AIRCRAFT_ACCIDENT'
  description = 'ทดสอบเส้นทางการแจ้งเหตุจาก PHP API แบบครบวงจร'
  latitude = 13.7563
  longitude = 100.5018
  address = 'กรุงเทพมหานคร'
  priority = 'NORMAL'
  images = @(@{ fileName = 'incident.png'; contentBase64 = $onePixelPng })
}
$created = Invoke-JsonPost "$BaseUrl/incidents" $incidentBody $citizenHeaders
$replayed = Invoke-JsonPost "$BaseUrl/incidents" $incidentBody $citizenHeaders
if ($created.data.id -ne $replayed.data.id) { throw 'Idempotency contract failed.' }
if ($created.data.images.Count -ne 1) { throw 'Inline image contract failed.' }
$imageUrl = [string]$created.data.images[0].imageUrl
$mediaUri = [Uri]::new([Uri]$BaseUrl, $imageUrl)
$download = Invoke-WebRequest -UseBasicParsing -Uri $mediaUri
if ($download.StatusCode -ne 200) { throw "Uploaded image returned HTTP $($download.StatusCode)." }
if ($download.Headers['Content-Type'] -notlike 'image/*') { throw 'Uploaded image has an invalid content type.' }
if ($download.RawContentLength -le 0) { throw 'Uploaded image response is empty.' }

$adminLogin = Invoke-JsonPost "$BaseUrl/admin/auth/login" @{
  username = 'integration-admin'
  password = 'Integration-Password-123'
}
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.accessToken)" }
$mapBeforeCompletion = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/incidents/map-points" -Headers $adminHeaders
if ($mapBeforeCompletion.data.id -notcontains $created.data.id) { throw 'Active incident is missing from map points.' }
$accepted = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/admin/incidents/$($created.data.id)/accept" -Headers $adminHeaders
if ($accepted.data.status -ne 'IN_PROGRESS') { throw 'Incident accept workflow failed.' }
$completed = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/admin/incidents/$($created.data.id)/complete" -Headers $adminHeaders
if ($completed.data.status -ne 'COMPLETED') { throw 'Incident complete workflow failed.' }
$mapAfterCompletion = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/incidents/map-points" -Headers $adminHeaders
if ($mapAfterCompletion.data.id -contains $created.data.id) { throw 'Completed incident is still present in map points.' }

$deleted = Invoke-RestMethod -Method Delete -Uri "$BaseUrl/admin/incidents/$($created.data.id)" -Headers $adminHeaders
if (-not $deleted.data.deleted) { throw 'Incident deletion response contract failed.' }
try {
  Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/incidents/$($created.data.id)" -Headers $adminHeaders | Out-Null
  throw 'Deleted incident is still available.'
} catch {
  if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
}
try {
  Invoke-WebRequest -UseBasicParsing -Uri $mediaUri | Out-Null
  throw 'Deleted incident image is still available.'
} catch {
  if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
}

Write-Output "PHP API E2E create, workflow, map visibility, image, and deletion checks passed for $($created.data.caseCode)."
