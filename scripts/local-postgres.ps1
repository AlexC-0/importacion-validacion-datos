param([ValidateSet('Initialize', 'Start', 'Stop', 'Status')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localRoot = Join-Path $projectRoot '.local'
$bin = Join-Path $localRoot 'postgresql\pgsql\bin'
$data = Join-Path $localRoot 'data'
$marker = Join-Path $localRoot 'instance.json'
$envFile = Join-Path $projectRoot '.env'
$port = 55432
$utf8 = [Text.UTF8Encoding]::new($false)

function Run-Pg([string]$Executable, [string[]]$Arguments) {
  & (Join-Path $bin $Executable) @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Fallo de $Executable (codigo $LASTEXITCODE)." }
}
function New-Password {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
function Assert-Owned {
  if (!(Test-Path -LiteralPath $marker)) { throw 'No existe el marcador de esta instancia. No se modifica.' }
  $info = [IO.File]::ReadAllText($marker) | ConvertFrom-Json
  if ($info.projectRoot -ne $projectRoot -or $info.port -ne $port) {
    throw 'El marcador no corresponde a este proyecto y puerto.'
  }
}

if ($Action -eq 'Initialize') {
  if ((Test-Path -LiteralPath $data) -or (Test-Path -LiteralPath $marker) -or (Test-Path -LiteralPath $envFile)) {
    throw 'Ya hay datos, marcador o .env. No se sobrescriben. Usa Start si la instancia ya esta preparada.'
  }
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
  try { $listener.Start() } finally { $listener.Stop() }
  New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
  if (!(Test-Path -LiteralPath (Join-Path $bin 'initdb.exe'))) {
    $archive = Join-Path $localRoot 'postgresql.zip'
    if (!(Test-Path -LiteralPath $archive)) {
      # Enlace Windows x64 de PostgreSQL 18.6 publicado por EDB.
      & curl.exe --fail --location --silent --show-error --output $archive 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609'
      if ($LASTEXITCODE -ne 0) { throw 'Descarga PostgreSQL fallida.' }
    }
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $localRoot 'postgresql')
  }
  Run-Pg 'postgres.exe' @('--version')
  $adminPassword = New-Password
  $appPassword = New-Password
  $passwordFile = Join-Path $localRoot 'init-password'
  [IO.File]::WriteAllText($passwordFile, $adminPassword, $utf8)
  try {
    Run-Pg 'initdb.exe' @('-D', $data, '--encoding=UTF8', '--locale=C',
      '--username=csv_admin', '--auth=scram-sha-256', "--pwfile=$passwordFile")
  } finally {
    Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue
  }
  $configuration = @"

listen_addresses = '127.0.0.1'
port = 55432
password_encryption = 'scram-sha-256'
log_min_error_statement = 'panic'
"@
  [IO.File]::AppendAllText((Join-Path $data 'postgresql.conf'), $configuration, $utf8)
  [IO.File]::WriteAllText($marker, (@{ projectRoot = $projectRoot; port = $port } | ConvertTo-Json), $utf8)
  $adminPassfile = Join-Path $localRoot 'admin.pgpass'
  [IO.File]::WriteAllText($adminPassfile, "127.0.0.1:55432:*:csv_admin:$adminPassword", $utf8)
  Run-Pg 'pg_ctl.exe' @('-D', $data, '-l', (Join-Path $localRoot 'postgresql.log'), '-w', '-t', '30', 'start')
  $previousPassfile = $env:PGPASSFILE
  $env:PGPASSFILE = $adminPassfile
  try {
    # Solo en el cluster recien creado; no borra ni reutiliza bases.
    $sql = "CREATE ROLE csv_app LOGIN PASSWORD '$appPassword';" +
      'CREATE DATABASE importacion_validacion_datos OWNER csv_app;' +
      'CREATE DATABASE importacion_validacion_datos_test OWNER csv_app;'
    $sql | & (Join-Path $bin 'psql.exe') -X -w -h 127.0.0.1 -p $port -U csv_admin -d postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Fallo al crear el usuario o las bases locales.' }
  } finally {
    $env:PGPASSFILE = $previousPassfile
  }
  $environment = @(
    'PORT=3000'
    "DATABASE_URL=postgresql://csv_app:$appPassword@127.0.0.1:55432/importacion_validacion_datos"
    "TEST_DATABASE_URL=postgresql://csv_app:$appPassword@127.0.0.1:55432/importacion_validacion_datos_test"
    ''
  ) -join [Environment]::NewLine
  [IO.File]::WriteAllText($envFile, $environment, $utf8)
  Write-Output 'PostgreSQL local preparado. Credenciales en .env y .local/admin.pgpass, excluidos de Git.'
  exit 0
}

Assert-Owned
switch ($Action) {
  'Start' { Run-Pg 'pg_ctl.exe' @('-D', $data, '-l', (Join-Path $localRoot 'postgresql.log'), '-w', '-t', '30', 'start') }
  'Stop' { Run-Pg 'pg_ctl.exe' @('-D', $data, '-w', '-t', '30', '-m', 'fast', 'stop') }
  'Status' { Run-Pg 'pg_ctl.exe' @('-D', $data, 'status') }
}
