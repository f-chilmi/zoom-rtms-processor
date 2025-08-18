// OWASP Security Headers Middleware
export const addSecurityHeaders = (req, res, next) => {
  // Skip security headers for static assets
  if (
    req.path.startsWith("/_next/") ||
    req.path.startsWith("/static/") ||
    req.path.includes(".js") ||
    req.path.includes(".css") ||
    req.path.includes(".map") ||
    req.path.includes(".ico")
  ) {
    return next();
  }

  // Required OWASP headers for Zoom Apps (only for HTML pages)
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy - adjust based on your frontend needs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://appssdk.zoom.us https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' https:",
    "frame-src 'self' https:",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);

  // Additional security headers (recommended)
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  next();
};
