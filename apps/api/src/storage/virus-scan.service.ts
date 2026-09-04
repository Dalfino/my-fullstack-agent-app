import { Injectable, Logger } from '@nestjs/common';

export interface ScanResult {
  clean: boolean;
  reason?: string;
  signature?: string;
}

const BLOCKED_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.scr', '.vbs', '.jar',
];

/** Deterministic malware / malicious-content signatures. */
const SIGNATURES: Array<{ name: string; test: (content: string, buf: Buffer) => boolean; reason: string }> = [
  {
    // Standard EICAR antivirus test file
    name: 'EICAR-Test-File',
    test: (_c, buf) => buf.includes(Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')),
    reason: 'EICAR antivirus test signature detected',
  },
  {
    name: 'Win32-PE-Executable',
    test: (_c, buf) => buf.length > 2 && buf[0] === 0x4d && buf[1] === 0x5a, // 'MZ'
    reason: 'Windows PE executable header detected',
  },
  {
    name: 'ELF-Binary',
    test: (_c, buf) => buf.length > 4 && buf[0] === 0x7f && buf.slice(1, 4).toString() === 'ELF',
    reason: 'ELF binary header detected',
  },
  {
    name: 'PowerShell-DownloadCradle',
    test: (c) =>
      /Invoke-Expression\s*\(\s*\(?\s*(New-Object|Invoke-WebRequest|IWR|DownloadString|DownloadData)/i.test(c) ||
      /IEX\s*\(\s*\(?\s*(New-Object|Invoke-WebRequest|IWR)\s/i.test(c),
    reason: 'PowerShell download-cradle / remote-execution pattern',
  },
  {
    name: 'Reverse-Shell-Bash',
    test: (c) => /\/dev\/tcp\/\d+\.\d+\.\d+\.\d+\/\d+/.test(c),
    reason: 'Bash /dev/tcp reverse shell pattern',
  },
  {
    name: 'PHP-Webshell',
    test: (c) =>
      /eval\s*\(\s*\$_(POST|GET|REQUEST|COOKIE)\s*\[/i.test(c) ||
      /system\s*\(\s*\$_(POST|GET|REQUEST)\s*\[/i.test(c),
    reason: 'PHP webshell pattern (eval/system on request input)',
  },
  {
    name: 'AWS-Access-Key',
    test: (c) => /AKIA[0-9A-Z]{16}/.test(c),
    reason: 'Hardcoded AWS access key detected',
  },
];

/**
 * Deterministic first-line virus / malicious-content scanner.
 * Runs synchronously on every upload before the object is persisted.
 * In production this would additionally enqueue a ClamAV job; here we provide
 * a reliable heuristic layer with zero external dependencies.
 */
@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);

  scan(filename: string, buffer: Buffer): ScanResult {
    const lower = filename.toLowerCase();

    const blocked = BLOCKED_EXTENSIONS.find((ext) => lower.endsWith(ext));
    if (blocked) {
      return { clean: false, signature: 'Blocked-Extension', reason: `File extension "${blocked}" is not allowed` };
    }

    // Decode only the first 1MB as text for signature matching (perf guard)
    const text = buffer.subarray(0, 1024 * 1024).toString('utf8');

    for (const sig of SIGNATURES) {
      try {
        if (sig.test(text, buffer)) {
          this.logger.warn(`Malicious content blocked in "${filename}": ${sig.name}`);
          return { clean: false, signature: sig.name, reason: sig.reason };
        }
      } catch {
        // signature evaluation error must never crash the scan
      }
    }

    return { clean: true };
  }
}
