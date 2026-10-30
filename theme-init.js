/* Runs in <head> before first paint. Kept in a file (not inline) so the
   website's Content-Security-Policy can block all inline scripts. */
// Apply the saved theme before first paint to avoid a flash.
try { const t = localStorage.getItem('ld_theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
// Turn on the web-font stylesheet once it has loaded, without blocking the first
// paint (this replaces an inline onload="this.media='all'" handler).
document.querySelectorAll('link[data-async-style]').forEach(link => {
  const on = () => { link.media = 'all'; };
  if (link.sheet) on(); else link.addEventListener('load', on, { once: true });
});
