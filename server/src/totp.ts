import * as OTPAuth from 'otpauth';

const ISSUER = 'anvil-server';

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpUri(username: string, secret: string): string {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    secret: OTPAuth.Secret.fromBase32(secret),
  }).toString();
}

export function verifyTotp(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.validate({ token: code.trim(), window: 1 }) !== null;
}
