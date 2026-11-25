import { createRemoteJWKSet, jwtVerify } from "jose";

// Google Identity Services: verify the ID token server-side. Google sign-in grants Explorer access only;
// it never grants application privileges (those require phone OTP verification).

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured");
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}
