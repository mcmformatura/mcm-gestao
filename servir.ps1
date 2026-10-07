# Servidor local simples para testar o site: powershell -File servir.ps1  ->  http://localhost:5173
$raiz = $PSScriptRoot
# Gera config.js a partir do .env (o mesmo que o build da Vercel faz com as variáveis de ambiente)
$cfg = @{}
if (Test-Path "$raiz\.env") {
  foreach ($linha in Get-Content "$raiz\.env" -Encoding UTF8) { if ($linha -match '^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim('"', "'") } }
}
$js = 'window.MCM_CONFIG = {"supabaseUrl":"' + $cfg['SUPABASE_URL'] + '","supabaseKey":"' + $cfg['SUPABASE_PUBLISHABLE_KEY'] + '"};'
[IO.File]::WriteAllText("$raiz\config.js", $js, (New-Object Text.UTF8Encoding $false))
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:5173/')
$l.Start()
Write-Host 'Servindo em http://localhost:5173'
$tipos = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json' }
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  if ($p -eq '') { $p = 'index.html' }
  $f = Join-Path $raiz $p
  if ((Test-Path $f -PathType Leaf) -and ([IO.Path]::GetFullPath($f).StartsWith($raiz))) {
    $b = [IO.File]::ReadAllBytes($f)
    $ext = [IO.Path]::GetExtension($f)
    $c.Response.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
