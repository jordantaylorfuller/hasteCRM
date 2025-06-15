export function formatError(error: any): Record<string, any> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return error || { message: "Unknown error" };
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  // More strict email validation regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Additional checks
  if (email.includes("..") || email.includes("@@")) return false;
  if (email.startsWith(".") || email.endsWith(".")) return false;
  if (email.includes(" ")) return false;

  return emailRegex.test(email);
}

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // Basic sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "");
}

export function truncateString(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str || "";
  if (maxLength <= 0) return "...";

  return str.substring(0, maxLength) + "...";
}
