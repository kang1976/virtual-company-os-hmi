/// Omron CJ2 / CS1 / CP1 PLC Memory Areas
enum FinsMemoryArea {
  /// Core I/O Area (CIO)
  cio,

  /// Work Area (WR)
  work,

  /// Holding Relay Area (HR)
  holding,

  /// Auxiliary Relay Area (AR)
  auxiliary,

  /// Data Memory Area (DM)
  dm,

  /// Extended Memory Area (EM) Bank 0
  emBank0,
}

extension FinsMemoryAreaExtension on FinsMemoryArea {
  /// Returns the FINS 1-byte code for Word access
  int get wordCode {
    switch (this) {
      case FinsMemoryArea.cio:
        return 0xB0;
      case FinsMemoryArea.work:
        return 0xB1;
      case FinsMemoryArea.holding:
        return 0xB2;
      case FinsMemoryArea.auxiliary:
        return 0xB3;
      case FinsMemoryArea.dm:
        return 0x82;
      case FinsMemoryArea.emBank0:
        return 0xA0;
    }
  }

  /// Returns the FINS 1-byte code for Bit access
  int get bitCode {
    switch (this) {
      case FinsMemoryArea.cio:
        return 0x30;
      case FinsMemoryArea.work:
        return 0x31;
      case FinsMemoryArea.holding:
        return 0x32;
      case FinsMemoryArea.auxiliary:
        return 0x33;
      case FinsMemoryArea.dm:
        return 0x02;
      case FinsMemoryArea.emBank0:
        return 0x20;
    }
  }

  /// Short display prefix (e.g. "DM", "CIO", "W")
  String get prefix {
    switch (this) {
      case FinsMemoryArea.cio:
        return 'CIO';
      case FinsMemoryArea.work:
        return 'W';
      case FinsMemoryArea.holding:
        return 'H';
      case FinsMemoryArea.auxiliary:
        return 'A';
      case FinsMemoryArea.dm:
        return 'DM';
      case FinsMemoryArea.emBank0:
        return 'E0';
    }
  }

  /// Parse from string prefix
  static FinsMemoryArea fromPrefix(String prefix) {
    final upper = prefix.toUpperCase().trim();
    if (upper.startsWith('DM') || upper.startsWith('D')) return FinsMemoryArea.dm;
    if (upper.startsWith('CIO') || upper.startsWith('C')) return FinsMemoryArea.cio;
    if (upper.startsWith('W') || upper.startsWith('WR')) return FinsMemoryArea.work;
    if (upper.startsWith('H') || upper.startsWith('HR')) return FinsMemoryArea.holding;
    if (upper.startsWith('A') || upper.startsWith('AR')) return FinsMemoryArea.auxiliary;
    if (upper.startsWith('E')) return FinsMemoryArea.emBank0;
    return FinsMemoryArea.dm; // default fallback
  }
}
