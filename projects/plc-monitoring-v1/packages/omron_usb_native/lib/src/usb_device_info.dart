class UsbDeviceInfo {
  final String name;
  final int deviceId;
  final int vendorId;
  final int productId;
  final bool isOmron;
  final bool hasPermission;

  const UsbDeviceInfo({
    required this.name,
    required this.deviceId,
    required this.vendorId,
    required this.productId,
    required this.isOmron,
    required this.hasPermission,
  });

  factory UsbDeviceInfo.fromMap(Map<dynamic, dynamic> map) {
    return UsbDeviceInfo(
      name: map['name'] as String? ?? 'Unknown USB Device',
      deviceId: map['deviceId'] as int? ?? 0,
      vendorId: map['vendorId'] as int? ?? 0,
      productId: map['productId'] as int? ?? 0,
      isOmron: map['isOmron'] as bool? ?? false,
      hasPermission: map['hasPermission'] as bool? ?? false,
    );
  }

  @override
  String toString() =>
      'UsbDeviceInfo($name, VID:0x${vendorId.toRadixString(16)}, PID:0x${productId.toRadixString(16)}, Omron:$isOmron, Perm:$hasPermission)';
}

class UsbLifecycleEvent {
  final String event; // ATTACHED, DETACHED, PERMISSION_GRANTED, PERMISSION_DENIED, CONNECTED, DISCONNECTED
  final int deviceId;
  final int vendorId;
  final int productId;
  final String message;

  const UsbLifecycleEvent({
    required this.event,
    required this.deviceId,
    required this.vendorId,
    required this.productId,
    this.message = '',
  });

  factory UsbLifecycleEvent.fromMap(Map<dynamic, dynamic> map) {
    return UsbLifecycleEvent(
      event: map['event'] as String? ?? 'UNKNOWN',
      deviceId: map['deviceId'] as int? ?? 0,
      vendorId: map['vendorId'] as int? ?? 0,
      productId: map['productId'] as int? ?? 0,
      message: map['message'] as String? ?? '',
    );
  }

  @override
  String toString() => 'UsbLifecycleEvent($event, deviceId: $deviceId, message: $message)';
}
