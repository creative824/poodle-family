// Tracking: Meta Pixel + Google Analytics 4.
// Nothing loads until an ID is filled in below. Fill one or both, push, done.
const META_PIXEL_ID = ""; // e.g. "123456789012345"
const GA4_ID = "";        // e.g. "G-XXXXXXXXXX"
const ADS_CONVERSION = "AW-18473205415/Ceh-COX94oQdEKf92uhE";

(function () {
  if (META_PIXEL_ID) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", META_PIXEL_ID);
    fbq("track", "PageView");
  }

  // The Google tag (Google Ads AW-18473205415) is loaded in index.html <head>.
  // A GA4 ID here just adds a second destination to the same gtag.
  if (GA4_ID) {
    if (!window.gtag) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA4_ID);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { dataLayer.push(arguments); };
      gtag("js", new Date());
    }
    gtag("config", GA4_ID);
  }

  if (!META_PIXEL_ID && !window.gtag) return;

  // One "lead" per click on WhatsApp, phone or Facebook, wherever the link is on the page.
  function channelOf(href) {
    if (/wa\.me|whatsapp/i.test(href)) return "whatsapp";
    if (/^tel:/i.test(href)) return "phone";
    if (/facebook\.com/i.test(href)) return "facebook";
    return null;
  }
  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    const channel = channelOf(a.getAttribute("href"));
    if (!channel) return;
    const label = (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 80);
    if (window.fbq) fbq("track", "Lead", { content_name: channel, content_category: label });
    if (window.gtag) {
      gtag("event", "generate_lead", { method: channel, link_text: label, transport_type: "beacon" });
      // Google Ads conversion (orgil's "צפייה בדף" conversion), counted per contact click, not per page view.
      gtag("event", "conversion", { send_to: ADS_CONVERSION, transport_type: "beacon" });
    }
  }, true);
})();
