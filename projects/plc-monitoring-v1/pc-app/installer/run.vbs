' PLC 모니터링 서버를 숨김 창으로 실행하고, 잠시 후 기본 브라우저로 접속 페이지를 연다.
' 더블클릭 한 번으로 "서버 시작 + 화면 열기"가 끝나도록 하기 위한 런처.
Option Explicit

Dim fso, shell, appDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = appDir
shell.Run """" & appDir & "\node.exe"" ""src\server.js""", 0, False

WScript.Sleep 1500
shell.Run "http://localhost:3000/", 1, False
