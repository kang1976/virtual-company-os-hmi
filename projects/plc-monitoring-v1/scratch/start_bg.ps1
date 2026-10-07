$workDir = "D:\02. AI 작업\PLC monitoring_01\plc-monitoring ver1.0 - google"
Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory $workDir -WindowStyle Hidden
Start-Sleep -Seconds 2
