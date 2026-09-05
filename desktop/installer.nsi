Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
Name "DisMulekadinhaCord"
OutFile "out\DisMulekadinhaCord-Setup-1.0.0.exe"
InstallDir "$LOCALAPPDATA\Programs\DisMulekadinhaCord"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 16
BrandingText "DisMulekadinhaCord"
Icon "app.ico"
UninstallIcon "app.ico"
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "DisMulekadinhaCord"
VIAddVersionKey "FileDescription" "Instalador do DisMulekadinhaCord"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "DisMulekadinhaCord"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao DisMulekadinhaCord"
!define MUI_WELCOMEPAGE_TEXT "Seu lugar para conversar com a mulekadinha.$\r$\n$\r$\nEste instalador cria o aplicativo e seus atalhos. O Microsoft Edge WebView2 é compartilhado com o Windows e será instalado se estiver ausente.$\r$\n$\r$\nRequer Windows 10/11 de 64 bits e conexão com a internet."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\DisMulekadinhaCord.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir DisMulekadinhaCord"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Este aplicativo requer Windows de 64 bits."
    Abort
  ${EndIf}
FunctionEnd
Section "Aplicativo" SEC_APP
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "build\DisMulekadinhaCord.exe"
  File "build\DisMulekadinhaCord.exe.config"
  File "build\Microsoft.Web.WebView2.Core.dll"
  File "build\Microsoft.Web.WebView2.WinForms.dll"
  File "build\WebView2Loader.dll"
  File "build\WEBVIEW2-LICENSE.txt"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\DisMulekadinhaCord"
  CreateShortcut "$SMPROGRAMS\DisMulekadinhaCord\DisMulekadinhaCord.lnk" "$INSTDIR\DisMulekadinhaCord.exe"
  CreateShortcut "$DESKTOP\DisMulekadinhaCord.lnk" "$INSTDIR\DisMulekadinhaCord.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "DisplayName" "DisMulekadinhaCord"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "DisplayIcon" "$INSTDIR\DisMulekadinhaCord.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "Publisher" "DisMulekadinhaCord"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord" "EstimatedSize" 3500
  ; Runtime detection follows Microsoft's documented Evergreen registration.
  SetRegView 32
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $0 == ""
    ReadRegStr $0 HKCU "SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    DetailPrint "Instalando Microsoft Edge WebView2…"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File "vendor\MicrosoftEdgeWebview2Setup.exe"
    ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
    ${If} $1 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "O aplicativo foi instalado, mas o WebView2 não pôde ser preparado. Verifique sua internet e execute este instalador novamente."
    ${EndIf}
  ${EndIf}
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\DisMulekadinhaCord.lnk"
  Delete "$SMPROGRAMS\DisMulekadinhaCord\DisMulekadinhaCord.lnk"
  RMDir "$SMPROGRAMS\DisMulekadinhaCord"
  Delete "$INSTDIR\DisMulekadinhaCord.exe"
  Delete "$INSTDIR\DisMulekadinhaCord.exe.config"
  Delete "$INSTDIR\Microsoft.Web.WebView2.Core.dll"
  Delete "$INSTDIR\Microsoft.Web.WebView2.WinForms.dll"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\WEBVIEW2-LICENSE.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DisMulekadinhaCord"
  ; Preserve the user's login/profile and the shared Microsoft runtime.
SectionEnd
