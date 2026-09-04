import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { MfaSetupResponse } from '@talentshowcase/types';

/**
 * Phase 3 MFA: TOTP (RFC 6238) via otplib v13 with authenticator-app enrolment.
 * Setup returns the base32 secret + otpauth URL + QR PNG data URL; the secret
 * only becomes effective once the user confirms a valid code (enable flow).
 */
@Injectable()
export class MfaService {
  private readonly issuer: string;

  constructor(private readonly config: ConfigService) {
    this.issuer = this.config.get<string>('MFA_ISSUER', 'TalentShowcase');
  }

  async setup(email: string): Promise<MfaSetupResponse> {
    const secret = generateSecret();
    const otpauthUrl = generateURI({ issuer: this.issuer, label: email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
    return { secret, otpauthUrl, qrDataUrl };
  }

  /** Verify a 6-digit TOTP code against a base32 secret (±1 time step). */
  verify(secret: string | undefined, code: string): boolean {
    if (!secret) return false;
    try {
      const result = verifySync({ token: code, secret });
      return result.valid === true;
    } catch {
      return false;
    }
  }

  assertValidCode(code: string): void {
    if (!/^\d{6}$/.test(code)) {
      throw new BadRequestException('MFA code must be exactly 6 digits');
    }
  }
}
