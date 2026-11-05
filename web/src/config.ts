/**
 * URL of the deployed Apps Script web app, injected at build time (VITE_API_URL).
 * It is not a secret: every request still needs a household device token.
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? ''
