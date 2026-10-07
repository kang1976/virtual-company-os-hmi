/// Represents the FINS 2-byte End Code (MRES, SRES)
class FinsEndCode {
  final int mres;
  final int sres;

  const FinsEndCode(this.mres, this.sres);

  /// 0x0000 indicates normal completion
  bool get isSuccess => mres == 0x00 && sres == 0x00;

  int get code => (mres << 8) | sres;

  String get description {
    if (isSuccess) return 'Normal Completion (0000)';
    switch (mres) {
      case 0x01:
        return 'Local Node Error (01 $sres)';
      case 0x02:
        return 'Destination Node Error (02 $sres)';
      case 0x03:
        return 'Controller Error (03 $sres)';
      case 0x04:
        return 'Service Unsupported (04 $sres)';
      case 0x05:
        return 'Routing Table Error (05 $sres)';
      case 0x10:
        return 'Command Format Error (10 $sres)';
      case 0x11:
        return 'Parameter Error (11 $sres)';
      case 0x20:
        return 'Read Not Possible (20 $sres)';
      case 0x21:
        return 'Write Not Possible (21 $sres)';
      case 0x22:
        return 'Not Executable in Current Mode (22 $sres)';
      case 0x23:
        return 'No Such Device (23 $sres)';
      case 0x24:
        return 'Cannot Start/Reset (24 $sres)';
      case 0x25:
        return 'Unit Error (25 $sres)';
      case 0x26:
        return 'Command Error (26 $sres)';
      default:
        return 'Error (${mres.toRadixString(16).padLeft(2, '0')}${sres.toRadixString(16).padLeft(2, '0')})';
    }
  }

  @override
  String toString() => 'FinsEndCode(0x${mres.toRadixString(16).padLeft(2, '0')}, 0x${sres.toRadixString(16).padLeft(2, '0')}: $description)';
}
