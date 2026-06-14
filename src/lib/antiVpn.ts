const ANTI_VPN_ENDPOINT = import.meta.env.VITE_ANTI_VPN_ENDPOINT || '';

export type AntiVpnResult = { isVpnOrProxy: boolean; error?: string };

const VPN_CHECK_TIMEOUT_MS = 5000;

export async function checkVpnOrProxy(): Promise<AntiVpnResult> {
  if (!ANTI_VPN_ENDPOINT) return { isVpnOrProxy: false };
  try {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), VPN_CHECK_TIMEOUT_MS);
    const res = await fetch(ANTI_VPN_ENDPOINT, { method: 'GET', credentials: 'omit', signal: ctrl.signal });
    clearTimeout(timeoutId);
    const data = (await res.json()) as { vpn?: boolean; block?: boolean };
    const block = data.vpn === true || data.block === true;
    return { isVpnOrProxy: block };
  } catch (err) {
    console.warn('Anti-VPN check failed:', err);
    return { isVpnOrProxy: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
