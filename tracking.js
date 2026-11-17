// Google Ads contact clicks for poodle-family only.
// The base Google tag AW-18473205415 is loaded once in index.html.
(function () {
  // Exact destinations copied from the two Google Ads click-event snippets.
  const CONVERSIONS = Object.freeze({
    whatsapp: "AW-18473205415/5LxQCPPJjrodEKf92uhE",
    phone: "AW-18473205415/zpfHCOaQj7odEKf92uhE",
  });

  // Fail closed if either destination is missing, belongs to another account,
  // or both channels accidentally point at the same conversion action.
  const validDestination = /^AW-18473205415\/[A-Za-z0-9_-]+$/;
  if (!Object.values(CONVERSIONS).every((value) => validDestination.test(value)) ||
      CONVERSIONS.whatsapp === CONVERSIONS.phone) return;

  // Re-executing this script must not register another conversion listener.
  if (window.__poodleContactTrackingInstalled) return;
  window.__poodleContactTrackingInstalled = true;

  function channelOf(href) {
    if (/^tel:\s*\+?[\d(]/i.test(href)) return "phone";
    try {
      const url = new URL(href, document.baseURI);
      if (url.protocol === "whatsapp:" && url.hostname === "send") return "whatsapp";
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      if (url.hostname === "wa.me" && /^\/\d+\/?$/.test(url.pathname)) return "whatsapp";
      if (["api.whatsapp.com", "web.whatsapp.com", "www.whatsapp.com", "whatsapp.com"].includes(url.hostname) &&
          /^\/send\/?$/.test(url.pathname)) return "whatsapp";
    } catch {
      // Malformed and unrelated links are not contact conversions.
    }
    return null;
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    const anchor = target && target.closest && target.closest("a[href]");
    if (!anchor || typeof window.gtag !== "function") return;
    const channel = channelOf((anchor.getAttribute("href") || "").trim());
    if (!channel) return;
    // One explicit Ads conversion per click, including dynamically added links.
    // No generic generate_lead event, legacy conversion, or Meta/Facebook event.
    window.gtag("event", "conversion", {
      send_to: CONVERSIONS[channel],
      transport_type: "beacon",
    });
  }, true);
})();
