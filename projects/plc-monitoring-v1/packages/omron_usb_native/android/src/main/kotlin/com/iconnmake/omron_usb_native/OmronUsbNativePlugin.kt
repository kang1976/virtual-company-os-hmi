package com.iconnmake.omron_usb_native

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.*
import android.os.Build
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.*

class OmronUsbNativePlugin : FlutterPlugin, MethodChannel.MethodCallHandler {
    private lateinit var methodChannel: MethodChannel
    private lateinit var byteEventChannel: EventChannel
    private lateinit var lifecycleEventChannel: EventChannel
    private var context: Context? = null
    private var usbManager: UsbManager? = null

    private var byteSink: EventChannel.EventSink? = null
    private var lifecycleSink: EventChannel.EventSink? = null

    private var activeDevice: UsbDevice? = null
    private var activeConnection: UsbDeviceConnection? = null
    private var activeInterface: UsbInterface? = null
    private var endpointIn: UsbEndpoint? = null
    private var endpointOut: UsbEndpoint? = null

    private var readJob: Job? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        const val OMRON_VID = 0x0590 // 1424
        const val ACTION_USB_PERMISSION = "com.iconnmake.omron_usb_native.USB_PERMISSION"
    }

    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    }
                    if (device != null) {
                        notifyLifecycle("ATTACHED", device, "USB Device Attached: VID=0x${Integer.toHexString(device.vendorId)} PID=0x${Integer.toHexString(device.productId)}")
                        if (device.vendorId == OMRON_VID) {
                            if (usbManager?.hasPermission(device) == true) {
                                connectDevice(device)
                            } else {
                                requestPermissionInternal(device)
                            }
                        }
                    }
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    }
                    if (device != null && activeDevice?.deviceId == device.deviceId) {
                        disconnectInternal()
                        notifyLifecycle("DETACHED", device, "USB Device Detached")
                    }
                }
                ACTION_USB_PERMISSION -> {
                    val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    }
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    if (device != null) {
                        notifyLifecycle(
                            if (granted) "PERMISSION_GRANTED" else "PERMISSION_DENIED",
                            device,
                            if (granted) "USB Permission Granted" else "USB Permission Denied by User"
                        )
                        if (granted && device.vendorId == OMRON_VID) {
                            connectDevice(device)
                        }
                    }
                }
            }
        }
    }

    private fun requestPermissionInternal(device: UsbDevice) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val pi = PendingIntent.getBroadcast(context, 0, Intent(ACTION_USB_PERMISSION), flags)
        usbManager?.requestPermission(device, pi)
    }

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        usbManager = context?.getSystemService(Context.USB_SERVICE) as? UsbManager

        methodChannel = MethodChannel(binding.binaryMessenger, "com.iconnmake.omron_usb_native/methods")
        methodChannel.setMethodCallHandler(this)

        byteEventChannel = EventChannel(binding.binaryMessenger, "com.iconnmake.omron_usb_native/bytes")
        byteEventChannel.setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                byteSink = events
            }
            override fun onCancel(arguments: Any?) {
                byteSink = null
            }
        })

        lifecycleEventChannel = EventChannel(binding.binaryMessenger, "com.iconnmake.omron_usb_native/lifecycle")
        lifecycleEventChannel.setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                lifecycleSink = events
            }
            override fun onCancel(arguments: Any?) {
                lifecycleSink = null
            }
        })

        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            addAction(ACTION_USB_PERMISSION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context?.registerReceiver(usbReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context?.registerReceiver(usbReceiver, filter)
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        disconnectInternal()
        try {
            context?.unregisterReceiver(usbReceiver)
        } catch (_: Exception) {}
        methodChannel.setMethodCallHandler(null)
        byteEventChannel.setStreamHandler(null)
        lifecycleEventChannel.setStreamHandler(null)
        context = null
        usbManager = null
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "scanDevices" -> {
                val devices = usbManager?.deviceList?.values ?: emptyList()
                val list = devices.map { dev ->
                    mapOf(
                        "name" to dev.deviceName,
                        "deviceId" to dev.deviceId,
                        "vendorId" to dev.vendorId,
                        "productId" to dev.productId,
                        "isOmron" to (dev.vendorId == OMRON_VID),
                        "hasPermission" to (usbManager?.hasPermission(dev) == true)
                    )
                }

                // If Omron device is present but not yet connected, auto trigger permission or connection
                if (activeDevice == null) {
                    val omronDev = devices.find { it.vendorId == OMRON_VID }
                    if (omronDev != null) {
                        if (usbManager?.hasPermission(omronDev) == true) {
                            connectDevice(omronDev)
                        } else {
                            requestPermissionInternal(omronDev)
                        }
                    }
                }

                result.success(list)
            }
            "requestPermission" -> {
                val deviceId = call.argument<Int>("deviceId")
                val device = usbManager?.deviceList?.values?.find { it.deviceId == deviceId }
                if (device == null) {
                    result.error("DEVICE_NOT_FOUND", "Device not found with ID: $deviceId", null)
                    return
                }
                if (usbManager?.hasPermission(device) == true) {
                    result.success(true)
                    return
                }
                requestPermissionInternal(device)
                result.success(null)
            }
            "connect" -> {
                val deviceId = call.argument<Int>("deviceId")
                val device = usbManager?.deviceList?.values?.find { it.deviceId == deviceId }
                if (device == null) {
                    result.error("DEVICE_NOT_FOUND", "Device not found with ID: $deviceId", null)
                    return
                }
                val success = connectDevice(device)
                result.success(success)
            }
            "disconnect" -> {
                disconnectInternal()
                result.success(true)
            }
            "sendBytes" -> {
                val bytes = call.argument<ByteArray>("bytes")
                if (bytes == null || activeConnection == null || endpointOut == null) {
                    result.error("NOT_CONNECTED", "USB connection or endpoint not ready", null)
                    return
                }
                val transferred = activeConnection?.bulkTransfer(endpointOut, bytes, bytes.size, 1000) ?: -1
                if (transferred >= 0) {
                    result.success(transferred)
                } else {
                    result.error("TRANSFER_FAILED", "Failed to write bulk packet to Omron USB port", null)
                }
            }
            "isConnected" -> {
                result.success(activeConnection != null)
            }
            "initCdcLines" -> {
                val ok = initCdcLines()
                result.success(ok)
            }
            else -> result.notImplemented()
        }
    }

    private fun connectDevice(device: UsbDevice): Boolean {
        if (activeDevice?.deviceId == device.deviceId && activeConnection != null) {
            return true
        }
        disconnectInternal()
        if (usbManager?.hasPermission(device) != true) {
            notifyLifecycle("CONNECT_FAILED_NO_PERMISSION", device, "Cannot open device: USB Permission not granted")
            return false
        }

        val connection = usbManager?.openDevice(device)
        if (connection == null) {
            notifyLifecycle("CONNECT_FAILED_OPEN", device, "Failed to open UsbDeviceConnection")
            return false
        }

        var claimedIntf: UsbInterface? = null
        var epIn: UsbEndpoint? = null
        var epOut: UsbEndpoint? = null

        // Search through all interfaces for Bulk endpoints
        for (ifaceIdx in 0 until device.interfaceCount) {
            val intf = device.getInterface(ifaceIdx)
            var currentEpIn: UsbEndpoint? = null
            var currentEpOut: UsbEndpoint? = null

            for (i in 0 until intf.endpointCount) {
                val ep = intf.getEndpoint(i)
                if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    if (ep.direction == UsbConstants.USB_DIR_IN && currentEpIn == null) {
                        currentEpIn = ep
                    } else if (ep.direction == UsbConstants.USB_DIR_OUT && currentEpOut == null) {
                        currentEpOut = ep
                    }
                }
            }

            if (currentEpIn != null && currentEpOut != null) {
                if (connection.claimInterface(intf, true)) {
                    claimedIntf = intf
                    epIn = currentEpIn
                    epOut = currentEpOut
                    break
                }
            }
        }

        if (claimedIntf == null || epIn == null || epOut == null) {
            connection.close()
            notifyLifecycle("CONNECT_FAILED_NO_ENDPOINTS", device, "No Bulk IN/OUT transfer endpoints claimed")
            return false
        }

        activeDevice = device
        activeConnection = connection
        activeInterface = claimedIntf
        endpointIn = epIn
        endpointOut = epOut

        // Send USB CDC handshake (DTR=1, RTS=1, LineCoding=115200 8-N-1)
        initCdcLines(connection, claimedIntf)

        startReadLoop(connection, epIn)
        notifyLifecycle("CONNECTED", device, "Omron CJ2H USB bulk interface claimed successfully. IN=0x${Integer.toHexString(epIn.address)}, OUT=0x${Integer.toHexString(epOut.address)}")
        return true
    }

    private fun initCdcLines(conn: UsbDeviceConnection? = activeConnection, intf: UsbInterface? = activeInterface): Boolean {
        val c = conn ?: return false
        val i = intf ?: return false
        var success = false
        try {
            // 1. SET_LINE_CODING (115200 baud, 1 stop bit, no parity, 8 data bits)
            val lineCoding115200 = byteArrayOf(
                0x00.toByte(), 0xC2.toByte(), 0x01.toByte(), 0x00.toByte(), // 115200 baud
                0x00.toByte(), // 1 stop bit
                0x00.toByte(), // No parity
                0x08.toByte()  // 8 data bits
            )
            c.controlTransfer(0x21, 0x20, 0, i.id, lineCoding115200, lineCoding115200.size, 500)
            if (i.id != 0) {
                c.controlTransfer(0x21, 0x20, 0, 0, lineCoding115200, lineCoding115200.size, 500)
            }

            // 2. SET_CONTROL_LINE_STATE (DTR=1 bit 0, RTS=1 bit 1 -> 0x03)
            val r1 = c.controlTransfer(0x21, 0x22, 0x03, i.id, null, 0, 500)
            val r2 = if (i.id != 0) c.controlTransfer(0x21, 0x22, 0x03, 0, null, 0, 500) else 0

            // 3. Vendor-specific CDC / FTDI / Cypress reset & baud
            c.controlTransfer(0x40, 0x01, 0x03, i.id, null, 0, 500)
            c.controlTransfer(0x40, 0x00, 0x00, i.id, null, 0, 500)

            success = (r1 >= 0 || r2 >= 0)
            val dev = activeDevice
            if (dev != null) {
                notifyLifecycle("CDC_INITIALIZED", dev, "USB CDC DTR/RTS (0x03) asserted and line coding set (115200 8-N-1, res=$r1/$r2)")
            }
        } catch (e: Exception) {
            val dev = activeDevice
            if (dev != null) {
                notifyLifecycle("CDC_WARN", dev, "CDC handshake warning: ${e.message}")
            }
        }
        return success
    }

    private fun startReadLoop(connection: UsbDeviceConnection, epIn: UsbEndpoint) {
        readJob?.cancel()
        readJob = CoroutineScope(Dispatchers.IO).launch {
            val buffer = ByteArray(1024)
            while (isActive && activeConnection != null) {
                val bytesRead = connection.bulkTransfer(epIn, buffer, buffer.size, 200)
                if (bytesRead > 0) {
                    val slice = buffer.copyOf(bytesRead)
                    mainHandler.post {
                        byteSink?.success(slice)
                    }
                }
            }
        }
    }

    private fun disconnectInternal() {
        readJob?.cancel()
        readJob = null
        activeInterface?.let { activeConnection?.releaseInterface(it) }
        activeConnection?.close()
        activeConnection = null
        activeInterface = null
        endpointIn = null
        endpointOut = null
        val dev = activeDevice
        activeDevice = null
        if (dev != null) {
            notifyLifecycle("DISCONNECTED", dev, "USB Device Disconnected")
        }
    }

    private fun notifyLifecycle(event: String, device: UsbDevice, message: String? = null) {
        mainHandler.post {
            lifecycleSink?.success(
                mapOf(
                    "event" to event,
                    "deviceId" to device.deviceId,
                    "vendorId" to device.vendorId,
                    "productId" to device.productId,
                    "name" to device.deviceName,
                    "message" to (message ?: "")
                )
            )
        }
    }
}
