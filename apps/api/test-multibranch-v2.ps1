# test-multibranch-v2.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$BASE_URL = "http://localhost:4000"
$ADMIN_EMAIL = "admin@dronefood.com"
$ADMIN_PASSWORD = "admin123"

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    Write-Host "`n[$Name]" -ForegroundColor Yellow
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
        }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        $resp = Invoke-RestMethod @params
        $resp | ConvertTo-Json -Depth 3 | Select-Object -First 20
        Write-Host "    ✅ PASS" -ForegroundColor Green
        return $resp
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "    ❌ FAIL (HTTP $status): $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TEST MULTI-BRANCH API v2" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# === 1. LOGIN ===
Write-Host "`n[1] Login admin..." -ForegroundColor Yellow
$loginBody = @{ email = $ADMIN_EMAIL; password = $ADMIN_PASSWORD } | ConvertTo-Json
$loginResp = Invoke-RestMethod -Uri "$BASE_URL/api/user/login" `
    -Method POST -ContentType "application/json" -Body $loginBody

$ADMIN_TOKEN = $loginResp.token
if (-not $ADMIN_TOKEN) {
    Write-Host "    ❌ Không có token trong response!" -ForegroundColor Red
    $loginResp | ConvertTo-Json -Depth 5
    exit 1
}
Write-Host "    ✅ Login OK (role: $($loginResp.role))" -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $ADMIN_TOKEN"
    "Content-Type" = "application/json"
}

# === 2. HEALTH ===
$health = Test-Endpoint -Name "2. Health check" -Url "$BASE_URL/api/health"

# === 3. MERCHANTS ===
$merchants = Test-Endpoint -Name "3. List merchants (admin)" -Url "$BASE_URL/api/merchant/list" -Headers $headers
if ($merchants) {
    $count = if ($merchants.data) { $merchants.data.Count } else { 0 }
    Write-Host "    → Tìm thấy $count merchants" -ForegroundColor Cyan
}

# === 4. NEARBY BRANCHES ===
$nearby = Test-Endpoint -Name "4. Nearby branches (public)" -Url "$BASE_URL/api/branch/nearby?lat=10.7769&lng=106.7009&radius=15"

# === 5. HUBS ===
$hubs = Test-Endpoint -Name "5. List hubs (admin)" -Url "$BASE_URL/api/hub" -Headers $headers

# === 6. DRONES ===
$drones = Test-Endpoint -Name "6. List drones (admin)" -Url "$BASE_URL/api/drone" -Headers $headers

# === 7. LEGACY ===
$legacy = Test-Endpoint -Name "7. Legacy /api/restaurant/list" -Url "$BASE_URL/api/restaurant/list"

# === 8. PERMISSION ===
Write-Host "`n[8. Test phân quyền - không token]" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE_URL/api/drone" -Method GET
    Write-Host "    ❌ FAIL: Không token mà vào được!" -ForegroundColor Red
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 401) {
        Write-Host "    ✅ PASS: Chặn 401" -ForegroundColor Green
    } else {
        Write-Host "    ⚠️  Status: $status" -ForegroundColor Yellow
    }
}

# === 9. AUDIT ===
$audit = Test-Endpoint -Name "9. Audit log (admin)" -Url "$BASE_URL/api/audit" -Headers $headers

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  HOÀN TẤT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan