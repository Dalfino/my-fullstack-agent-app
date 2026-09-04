import { Injectable, Logger } from '@nestjs/common';
import {
  SecurityFinding,
  SecurityScanReport,
  SecurityScanReportSchema,
  Severity,
} from '@talentshowcase/types';
import { LlmClient } from '../llm.client';

interface ScanRule {
  id: string;
  severity: Severity;
  category: string;
  pattern: RegExp;
  description: string;
  remediation: string;
  maxPerFile?: number;
}

const RULES: ScanRule[] = [
  {
    id: 'SEC-001',
    severity: 'CRITICAL',
    category: 'hardcoded-secret',
    pattern: /(password|passwd|secret|api[_-]?key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    description: 'Potential hardcoded credential in source code',
    remediation: 'Move secrets to environment variables or a secrets manager; rotate the exposed value.',
    maxPerFile: 5,
  },
  {
    id: 'SEC-002',
    severity: 'CRITICAL',
    category: 'private-key',
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    description: 'Private key material embedded in the repository',
    remediation: 'Remove the key immediately and rotate it; store keys in a vault.',
    maxPerFile: 1,
  },
  {
    id: 'SEC-003',
    severity: 'HIGH',
    category: 'sql-injection',
    pattern: /(query|execute|raw)\s*\(\s*[`'"]SELECT[\s\S]{0,80}(\$\{|\+\s*\w+\s*\+|%\s*\w+\s*%|'"\s*\+\s*\w+)/gi,
    description: 'String-concatenated SQL query — SQL injection risk',
    remediation: 'Use parameterized queries or an ORM query builder with bound parameters.',
    maxPerFile: 5,
  },
  {
    id: 'SEC-004',
    severity: 'HIGH',
    category: 'code-execution',
    pattern: /\beval\s*\(|new\s+Function\s*\(|exec\s*\(\s*['"`]/g,
    description: 'Dynamic code execution (eval / new Function)',
    remediation: 'Replace eval with safe parsing (JSON.parse) or an explicit dispatch table.',
    maxPerFile: 5,
  },
  {
    id: 'SEC-005',
    severity: 'HIGH',
    category: 'xss',
    pattern: /innerHTML\s*=\s*[^'"\s]|\bdangerouslySetInnerHTML\b|document\.write\s*\(/g,
    description: 'Direct DOM injection — cross-site scripting risk',
    remediation: 'Sanitize content (DOMPurify) or build DOM nodes via framework bindings.',
    maxPerFile: 5,
  },
  {
    id: 'SEC-006',
    severity: 'MEDIUM',
    category: 'weak-crypto',
    pattern: /\b(md5|sha1)\b|\bMath\.random\(\)[^;]*(password|token|secret|key)/gi,
    description: 'Weak hash algorithm or insecure randomness used in a security context',
    remediation: 'Use bcrypt/argon2 for passwords and crypto.randomUUID()/crypto.randomBytes for tokens.',
    maxPerFile: 5,
  },
  {
    id: 'SEC-007',
    severity: 'MEDIUM',
    category: 'insecure-transport',
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/gi,
    description: 'Plain-text HTTP endpoint — traffic can be intercepted',
    remediation: 'Use HTTPS endpoints everywhere outside local development.',
    maxPerFile: 3,
  },
  {
    id: 'SEC-008',
    severity: 'LOW',
    category: 'debug-artifact',
    pattern: /console\.(log|debug)\s*\(|debugger\b/g,
    description: 'Debug statement left in code',
    remediation: 'Remove debug statements before production release.',
    maxPerFile: 3,
  },
];

/**
 * AGENT: SECURITY SCANNER (Phase 2)
 * Deterministic rule engine (8 vulnerability classes with line tracking)
 * followed by an LLM-written executive narrative. The findings themselves are
 * ALWAYS deterministic — the LLM only summarizes what the rules detected.
 */
@Injectable()
export class SecurityScannerAgent {
  private readonly logger = new Logger(SecurityScannerAgent.name);
  private static readonly MAX_LINES_PER_FILE = 5000;

  constructor(private readonly llm: LlmClient) {}

  async scan(files: Array<{ path: string; content: string; language: string }>): Promise<SecurityScanReport> {
    const findings: SecurityFinding[] = [];
    let scannedLines = 0;

    for (const file of files.slice(0, 60)) {
      const lines = file.content.split('\n').slice(0, SecurityScannerAgent.MAX_LINES_PER_FILE);
      scannedLines += lines.length;

      for (const rule of RULES) {
        const counter = new Map<string, number>();
        lines.forEach((line, idx) => {
          // Reset regex state before each line
          rule.pattern.lastIndex = 0;
          if (rule.pattern.test(line)) {
            const count = counter.get(rule.id) ?? 0;
            if (rule.maxPerFile && count >= rule.maxPerFile) return;
            counter.set(rule.id, count + 1);
            findings.push({
              id: `${rule.id}-${file.path}-${idx + 1}`,
              severity: rule.severity,
              category: rule.category,
              filePath: file.path,
              lineNumber: idx + 1,
              snippet: line.trim().slice(0, 200),
              description: rule.description,
              remediation: rule.remediation,
            });
          }
        });
      }
    }

    const riskRating = this.riskRating(findings);
    const executiveSummary = await this.narrative(findings, files.length, scannedLines, riskRating);

    return SecurityScanReportSchema.parse({
      executiveSummary,
      riskRating,
      totalFindings: findings.length,
      findings: findings.slice(0, 100), // cap payload size
      scannedFiles: Math.min(files.length, 60),
      scannedLines,
      confidenceScore: 90,
    });
  }

  private riskRating(findings: SecurityFinding[]): SecurityScanReport['riskRating'] {
    if (findings.some((f) => f.severity === 'CRITICAL')) return 'CRITICAL';
    const high = findings.filter((f) => f.severity === 'HIGH').length;
    const medium = findings.filter((f) => f.severity === 'MEDIUM').length;
    if (high > 0) return 'HIGH';
    if (medium >= 3) return 'MEDIUM';
    if (findings.length > 0) return 'LOW';
    return 'CLEAN';
  }

  private async narrative(
    findings: SecurityFinding[],
    fileCount: number,
    lineCount: number,
    rating: SecurityScanReport['riskRating'],
  ): Promise<string> {
    const bySeverity = (s: Severity) => findings.filter((f) => f.severity === s).length;
    const digest =
      `CRITICAL=${bySeverity('CRITICAL')} HIGH=${bySeverity('HIGH')} MEDIUM=${bySeverity('MEDIUM')} ` +
      `LOW=${bySeverity('LOW')} INFO=${bySeverity('INFO')} — categories: ` +
      [...new Set(findings.map((f) => f.category))].join(', ');

    const response = await this.llm.complete([
      {
        role: 'system',
        content:
          'You are the Security Scanner Agent for an enterprise talent showcase platform. ' +
          'You write concise executive summaries of security scans. Respond ONLY with JSON ' +
          'matching: {"executiveSummary": string}. Base your summary strictly on the provided findings digest.',
      },
      {
        role: 'user',
        content:
          `Scanned ${fileCount} files / ${lineCount} lines. Risk rating: ${rating}. ` +
          `Findings digest: ${digest || 'no findings'}. ` +
          'Write a 2-4 sentence executive summary covering the overall risk, the most important finding categories, and the top remediation priority.',
      },
    ]);

    try {
      const cleaned = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.executiveSummary === 'string' && parsed.executiveSummary.length > 20) {
        return parsed.executiveSummary;
      }
      throw new Error('weak summary');
    } catch {
      // Deterministic fallback narrative
      if (rating === 'CLEAN') {
        return `The scan covered ${fileCount} files and ${lineCount} lines and found no issues across the rule set (hardcoded secrets, injection, XSS, weak crypto, debug artifacts). This codebase presents a low security risk and follows secure-by-default patterns.`;
      }
      const critical = bySeverity('CRITICAL');
      const high = bySeverity('HIGH');
      return (
        `The scan of ${fileCount} files (${lineCount} lines) produced ${findings.length} findings with an overall risk rating of ${rating}` +
        (critical ? `, including ${critical} critical issue(s) that require immediate remediation` : '') +
        (high ? ` and ${high} high-severity issue(s)` : '') +
        `. The dominant categories are ${[...new Set(findings.map((f) => f.category))].slice(0, 3).join(', ')}. ` +
        `Priority action: ${findings[0]?.remediation ?? 'review the findings list'}`
      );
    }
  }
}
