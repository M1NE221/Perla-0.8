!macro customHeader
  !system "echo '-- Creating Windows 7 compatibility headers'"
!macroend

!macro customInit
  ; Detect Windows version
  ${If} ${AtLeastWin10}
    ; Windows 10+
    StrCpy $0 "win10+"
  ${ElseIf} ${AtLeastWin8.1}
    ; Windows 8.1
    StrCpy $0 "win8.1"
  ${ElseIf} ${AtLeastWin8}
    ; Windows 8
    StrCpy $0 "win8"
  ${ElseIf} ${AtLeastWin7}
    ; Windows 7
    StrCpy $0 "win7"
  ${Else}
    ; Older or unknown
    StrCpy $0 "older"
  ${EndIf}
  
  ; Log the OS version
  DetailPrint "Detected Windows version: $0"
!macroend

!macro customInstall
  ; Create Windows 7 compatibility files
  DetailPrint "Creating Windows 7 compatibility files..."
  
  ; Copy compatibility launcher
  File /oname=$INSTDIR\win7-launcher.exe "${BUILD_RESOURCES_DIR}\..\scripts\windows7-launcher.js"
  File /oname=$INSTDIR\win7-compat.js "${BUILD_RESOURCES_DIR}\..\electron\win7-compat.js"
  
  ; Create launcher shortcuts for Windows 7/8
  ${If} $0 == "win7"
    CreateShortCut "$DESKTOP\Perla (Win7).lnk" "$INSTDIR\win7-launcher.exe" "" "$INSTDIR\resources\app.asar.unpacked\public\icon.ico" 0
    CreateShortCut "$SMPROGRAMS\Perla\Perla (Win7).lnk" "$INSTDIR\win7-launcher.exe" "" "$INSTDIR\resources\app.asar.unpacked\public\icon.ico" 0
    
    DetailPrint "Created Windows 7 specific shortcuts"
  ${ElseIf} $0 == "win8"
    CreateShortCut "$DESKTOP\Perla (Win8).lnk" "$INSTDIR\win7-launcher.exe" "" "$INSTDIR\resources\app.asar.unpacked\public\icon.ico" 0
    CreateShortCut "$SMPROGRAMS\Perla\Perla (Win8).lnk" "$INSTDIR\win7-launcher.exe" "" "$INSTDIR\resources\app.asar.unpacked\public\icon.ico" 0
    
    DetailPrint "Created Windows 8 specific shortcuts"
  ${Else}
    ; No special handling for Windows 10+
    DetailPrint "Using standard shortcuts for modern Windows"
  ${EndIf}
!macroend

!macro customUnInstall
  ; Clean up Windows 7/8 specific files
  Delete "$INSTDIR\win7-launcher.exe"
  Delete "$INSTDIR\win7-compat.js"
  
  ; Remove Windows 7/8 specific shortcuts
  Delete "$DESKTOP\Perla (Win7).lnk"
  Delete "$DESKTOP\Perla (Win8).lnk"
  Delete "$SMPROGRAMS\Perla\Perla (Win7).lnk"
  Delete "$SMPROGRAMS\Perla\Perla (Win8).lnk"
!macroend 