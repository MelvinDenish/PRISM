/**
 * SSRF guard for server-side outbound fetches of user-supplied URLs.
 *
 * The summarize route fetches an arbitrary URL the user provides and returns
 * its body. Without guarding, that is a full-read SSRF: an attacker can read
 * cloud metadata (169.254.169.254), loopback, and RFC-1918 internal services.
 *
 * Defenses:
 *  - allow only http/https
 *  - resolve the hostname and reject private / loopback / link-local / reserved IPs
 *  - callers MUST also disable redirects (maxRedirects: 0) and re-validate any
 *    redirect target, since DNS can be re-pointed between check and fetch.
 */

const dns = require('dns').promises;
const net = require('net');

// Returns true for IPs that must never be fetched server-side.
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 10) return true;                              // 10.0.0.0/8
    if (p[0] === 127) return true;                             // loopback
    if (p[0] === 0) return true;                               // 0.0.0.0/8
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16.0.0/12
    if (p[0] === 192 && p[1] === 168) return true;             // 192.168.0.0/16
    if (p[0] === 169 && p[1] === 254) return true;             // link-local / cloud metadata
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;// CGNAT 100.64.0.0/10
    if (p[0] >= 224) return true;                              // multicast / reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;                // loopback / unspecified
    if (v.startsWith('fe80')) return true;                     // link-local
    if (v.startsWith('fc') || v.startsWith('fd')) return true; // unique local
    if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // unparseable → treat as unsafe
}

/**
 * Validate a user-supplied URL for safe server-side fetching.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https URLs are allowed' };
  }
  // If the host is already a literal IP, check it directly.
  const host = parsed.hostname;
  if (net.isIP(host)) {
    return isPrivateIp(host) ? { ok: false, reason: 'URL resolves to a blocked address' } : { ok: true };
  }
  // Otherwise resolve and reject if ANY resolved address is private.
  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    return { ok: false, reason: 'Could not resolve host' };
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    return { ok: false, reason: 'URL resolves to a blocked address' };
  }
  return { ok: true };
}

module.exports = { assertSafeUrl, isPrivateIp };
