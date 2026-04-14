/**
 * Triggers a browser file download from a pre-signed R2 URL.
 * R2 serves the file with Content-Disposition: attachment so the browser
 * downloads rather than navigating away.
 */
export function triggerPresignedDownload(signedUrl: string): void {
  window.open(signedUrl, '_blank', 'noopener,noreferrer');
}
