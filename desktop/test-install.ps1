$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$installTarget=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'install-test'))
if (-not $installTarget.StartsWith($projectRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Test directory must stay inside the project'}
$registryPath='HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/DisMulekadinhaCord'
$shortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) 'DisMulekadinhaCord.lnk'
if ((Test-Path $registryPath) -or (Test-Path $shortcut)) {throw 'An existing installation or shortcut was found. Skipping isolated install test.'}
$installer=Join-Path $PSScriptRoot 'out/DisMulekadinhaCord-Setup-1.1.0.exe'
$process=Start-Process -FilePath $installer -ArgumentList '/S',"/D=$installTarget" -WindowStyle Hidden -PassThru -Wait
if($process.ExitCode -ne 0){throw 'Installer failed'}
foreach($file in @('DisMulekadinhaCord.exe','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll','Uninstall.exe')){
 if(-not(Test-Path (Join-Path $installTarget $file))){throw "Missing installed file: $file"}
}
if(-not(Test-Path $registryPath)){throw 'Uninstall registration missing'}
if(-not(Test-Path $shortcut)){throw 'Desktop shortcut missing'}
$installedHash=(Get-FileHash (Join-Path $installTarget 'DisMulekadinhaCord.exe')).Hash
$builtHash=(Get-FileHash (Join-Path $PSScriptRoot 'build/DisMulekadinhaCord.exe')).Hash
if($installedHash -ne $builtHash){throw 'Installed executable mismatch'}
Write-Output 'PASS: installer, exact executable, shared libraries, desktop shortcut and uninstall registration.'
$uninstaller=Join-Path $installTarget 'Uninstall.exe'
Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait
for($attempt=0;$attempt -lt 10 -and (Test-Path $registryPath);$attempt++){Start-Sleep -Milliseconds 500}
if(Test-Path $registryPath){throw 'Uninstall registry entry remains'}
if(Test-Path $shortcut){throw 'Desktop shortcut remains'}
if(Test-Path (Join-Path $installTarget 'DisMulekadinhaCord.exe')){throw 'Installed app remains'}
Write-Output 'PASS: uninstaller removed app files, shortcut and registry entry; shared runtime was preserved.'
