param([switch]$SkipDownload)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force -Path vendor,build,out | Out-Null
if (-not $SkipDownload) {
  if (-not (Test-Path 'vendor/webview2/lib/net462/Microsoft.Web.WebView2.Core.dll')) {
    Invoke-WebRequest 'https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/1.0.4191.47/microsoft.web.webview2.1.0.4191.47.nupkg' -OutFile vendor/webview2.zip
    Expand-Archive vendor/webview2.zip -DestinationPath vendor/webview2 -Force
  }
  if (-not (Test-Path 'vendor/nsis/nsis-3.12/makensis.exe')) {
    Invoke-WebRequest 'https://mirrors.mit.edu/macports/distfiles/nsis/nsis-3.12.zip' -OutFile vendor/nsis.zip
    if ((Get-FileHash vendor/nsis.zip -Algorithm SHA256).Hash -ne '56581F90DB321581C5381193D796FFFCF2D24B2F8FED2160A6C6A3BAA67F2C4F') {throw 'NSIS checksum mismatch'}
    Expand-Archive vendor/nsis.zip -DestinationPath vendor/nsis -Force
  }
  if (-not (Test-Path 'vendor/MicrosoftEdgeWebview2Setup.exe')) {
    Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile vendor/MicrosoftEdgeWebview2Setup.exe
  }
}
foreach ($signedFile in @('vendor/MicrosoftEdgeWebview2Setup.exe','vendor/webview2/lib/net462/Microsoft.Web.WebView2.Core.dll','vendor/webview2/lib/net462/Microsoft.Web.WebView2.WinForms.dll','vendor/webview2/runtimes/win-x64/native/WebView2Loader.dll')) {
  $signature = Get-AuthenticodeSignature $signedFile
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {throw "Invalid Microsoft signature: $signedFile"}
}
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object Drawing.Bitmap 64,64
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([Drawing.Color]::FromArgb(88,101,242))
$graphics.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$font = New-Object Drawing.Font 'Segoe UI',23,([Drawing.FontStyle]::Bold)
$format = New-Object Drawing.StringFormat
$format.Alignment = [Drawing.StringAlignment]::Center
$format.LineAlignment = [Drawing.StringAlignment]::Center
$graphics.DrawString('MK',$font,[Drawing.Brushes]::White,(New-Object Drawing.RectangleF 0,0,64,64),$format)
$icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconStream = [IO.File]::Create((Join-Path $PSScriptRoot 'app.ico'))
$icon.Save($iconStream)
$iconStream.Dispose()
$graphics.Dispose()
$font.Dispose()
$bitmap.Dispose()
Copy-Item vendor/webview2/lib/net462/Microsoft.Web.WebView2.Core.dll build/
Copy-Item vendor/webview2/lib/net462/Microsoft.Web.WebView2.WinForms.dll build/
Copy-Item vendor/webview2/runtimes/win-x64/native/WebView2Loader.dll build/
Copy-Item vendor/webview2/LICENSE.txt build/WEBVIEW2-LICENSE.txt
Copy-Item app.config build/DisMulekadinhaCord.exe.config
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /win32icon:app.ico /win32manifest:app.manifest /out:build/DisMulekadinhaCord.exe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:build/Microsoft.Web.WebView2.Core.dll /reference:build/Microsoft.Web.WebView2.WinForms.dll Program.cs
if ($LASTEXITCODE -ne 0) {throw 'Desktop compilation failed'}
& './vendor/nsis/nsis-3.12/makensis.exe' /V2 installer.nsi
if ($LASTEXITCODE -ne 0) {throw 'Installer compilation failed'}
$installer = Get-Item out/DisMulekadinhaCord-Setup-1.0.0.exe
$checksum = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'out/SHA256SUMS.txt'),"$checksum  $($installer.Name)" + [Environment]::NewLine)
Write-Output "Installer created: $($installer.FullName)"
Write-Output "Installer size: $([math]::Round($installer.Length / 1MB,2)) MiB"
Write-Output "Installed app files: $([math]::Round(((Get-ChildItem build -File | Measure-Object Length -Sum).Sum) / 1MB,2)) MiB (shared runtime and profile excluded)"
