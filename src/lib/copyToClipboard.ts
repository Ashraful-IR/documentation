/**
 * Copies text to the clipboard using the modern Clipboard API when available,
 * falling back to a temporary textarea + execCommand("copy") for environments
 * where the Clipboard API is unavailable (non-HTTPS, restricted iframes, etc.).
 *
 * Returns true on success, false on failure. Never throws.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Fast path: modern Clipboard API.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path (e.g. permission denied).
    }
  }

  // Legacy fallback: textarea + execCommand.
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Prevent scrolling and visual flash.
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
