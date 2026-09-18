; PLC 모니터링 - Windows 설치 프로그램
; 빌드: scripts\build-installer.ps1 이 먼저 dist-installer\app 폴더를 채워둔 뒤
;       "ISCC.exe installer\setup.iss" 로 이 스크립트를 컴파일한다.

#define MyAppName "PLC 모니터링"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "PLC Monitoring"
#define MyAppExeDesc "PLC 모니터링 서버 실행"

[Setup]
AppId={{E58FB1C0-00B3-48BE-877D-1AF12BEC9685}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
; 앱이 자기 설치 폴더 밑(data\, logs\)에 계속 파일을 쓰므로, 관리자 권한 없이도
; 평소 실행에 문제가 없도록 사용자별 폴더(LocalAppData)에 기본 설치한다.
DefaultDirName={localappdata}\PLC Monitoring
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; 설치 자체는 관리자 권한 없이 진행(사용자 폴더에 설치하므로). USB 드라이버 설치(zadig.exe)는
; 그 실행파일 자체 매니페스트에 requireAdministrator가 박혀있어, 실행되는 순간 별도로 UAC 창이 뜬다.
PrivilegesRequired=lowest
OutputDir=..\dist-installer\output
OutputBaseFilename=PLC-Monitoring-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
; 빌드 스크립트가 미리 준비해 둔 실행 폴더(포터블 node.exe + src/public/data 등)를 통째로 복사.
Source: "..\dist-installer\app\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; USB WinUSB 드라이버 설치 도구(Zadig, 사전설정 zadig.ini 포함)도 같이 넣어서 나중에 다시 실행할 수 있게 함.
Source: "driver\zadig.exe"; DestDir: "{app}\driver"; Flags: ignoreversion
Source: "driver\zadig.ini"; DestDir: "{app}\driver"; Flags: ignoreversion

[Dirs]
; 실행 중 서버가 계속 쓰는 폴더 - 일반 사용자 권한으로도 항상 쓸 수 있도록 미리 만들어둠.
Name: "{app}\logs"
Name: "{app}\logs\csv"
Name: "{app}\logs\trend"

[Icons]
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\run.vbs"; WorkingDir: "{app}"; Comment: "{#MyAppExeDesc}"
Name: "{group}\{#MyAppName}"; Filename: "{app}\run.vbs"; WorkingDir: "{app}"; Comment: "{#MyAppExeDesc}"
Name: "{group}\PLC USB 드라이버 설정 (Zadig)"; Filename: "{app}\driver\zadig.exe"; WorkingDir: "{app}\driver"; Comment: "PLC를 USB로 연결할 때 한 번 실행해서 WinUSB 드라이버로 교체하세요"
Name: "{group}\제거"; Filename: "{uninstallexe}"

[Run]
; 설치 마지막 단계에서 USB 드라이버 설정(Zadig)을 바로 띄워준다 - 목록에서
; "OMRON SYSMAC PLC Device"를 선택하고 [Install Driver]만 누르면 됨(WinUSB는 이미 기본 선택되어 있음).
Filename: "{app}\driver\zadig.exe"; WorkingDir: "{app}\driver"; Description: "지금 PLC USB 드라이버 설정 열기 (USB로 연결할 계획이면 실행)"; Flags: postinstall skipifsilent nowait unchecked
Filename: "{app}\run.vbs"; WorkingDir: "{app}"; Description: "{#MyAppName} 시작"; Flags: postinstall skipifsilent nowait shellexec unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
