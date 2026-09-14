/**
 * Centralized AI SDK wrapper.
 * z-ai-web-dev-sdk is only available in sandbox environments.
 * In production (Vercel), it gracefully returns null.
 */

let _sdkClient: any = null;
let _sdkChecked = false;

export async function getAiClient() {
  if (_sdkChecked) return _sdkClient;
  _sdkChecked = true;

  try {
    // Dynamic require — bypasses Turbopack/webpack bundling entirely
    const mod = await import(/* webpackIgnore: true */ 'z-ai-web-dev-sdk').catch(() => null);
    if (mod?.default && typeof mod.default.create === 'function') {
      _sdkClient = await mod.default.create();
    }
  } catch {
    // SDK not available
  }

  return _sdkClient;
}
