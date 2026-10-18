/**
 * Utility to parse and handle announcement attachments (Images, PDFs, Documents).
 */

export interface ParsedAttachment {
  url: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'file';
  size?: string;
}

export function parseAnnouncementAttachment(photo?: string): ParsedAttachment | null {
  if (!photo || typeof photo !== 'string' || !photo.trim()) return null;

  const trimmed = photo.trim();

  // Guard against encoded error payloads (e.g. Supabase 404 Bucket not found / NoSuchBucket saved as data URL)
  if (
    trimmed.includes('eyJzdGF0dXNDb2Rl') ||
    trimmed.includes('Bucket not found') ||
    trimmed.includes('NoSuchBucket')
  ) {
    return null;
  }

  // 1. Check if stored as JSON object { url, name, type, size }
  if (trimmed.startsWith('{') && trimmed.includes('"url"')) {
    try {
      const parsed = JSON.parse(trimmed);
      const url = parsed.url || '';
      let type: ParsedAttachment['type'] = parsed.type;
      
      if (!type) {
        if (url.startsWith('data:image/') || url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i)) {
          type = 'image';
        } else if (url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf') || parsed.name?.toLowerCase().endsWith('.pdf')) {
          type = 'pdf';
        } else if (
          url.startsWith('data:application/msword') ||
          url.startsWith('data:application/vnd') ||
          parsed.name?.match(/\.(doc|docx|txt|rtf|csv|xlsx|xls)$/i)
        ) {
          type = 'doc';
        } else {
          type = 'file';
        }
      }

      return {
        url,
        name: parsed.name || (type === 'pdf' ? 'Document.pdf' : type === 'image' ? 'Image.jpg' : 'Attachment'),
        type,
        size: parsed.size || '',
      };
    } catch {
      // JSON parse failed, proceed to fallback
    }
  }

  // 2. Direct PDF data URL or .pdf link
  if (trimmed.startsWith('data:application/pdf') || trimmed.toLowerCase().includes('.pdf')) {
    return {
      url: trimmed,
      name: 'Document.pdf',
      type: 'pdf',
    };
  }

  // 3. Word / Office / Text data URL
  if (
    trimmed.startsWith('data:application/msword') ||
    trimmed.startsWith('data:application/vnd') ||
    trimmed.startsWith('data:text/')
  ) {
    return {
      url: trimmed,
      name: 'Document.docx',
      type: 'doc',
    };
  }

  // 4. Image data URL or Image web URL
  if (trimmed.startsWith('data:image/') || trimmed.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i)) {
    return {
      url: trimmed,
      name: 'Photo.jpg',
      type: 'image',
    };
  }

  // 5. Default fallback to image or file
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
    return {
      url: trimmed,
      name: 'Attachment',
      type: 'file',
    };
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileCategory(nameOrType: string): 'pdf' | 'doc' | 'picture' | 'other' {
  if (!nameOrType) return 'other';
  const str = nameOrType.toLowerCase();
  if (str.endsWith('.pdf') || str.includes('application/pdf')) return 'pdf';
  if (
    str.endsWith('.doc') ||
    str.endsWith('.docx') ||
    str.endsWith('.docs') ||
    str.includes('msword') ||
    str.includes('wordprocessingml') ||
    str.includes('officedocument') ||
    str.includes('vnd.ms-word')
  ) {
    return 'doc';
  }
  if (
    str.endsWith('.jpg') ||
    str.endsWith('.jpeg') ||
    str.endsWith('.jfif') ||
    str.endsWith('.png') ||
    str.endsWith('.webp') ||
    str.endsWith('.gif') ||
    str.endsWith('.bmp') ||
    str.endsWith('.heic') ||
    str.endsWith('.heif') ||
    str.includes('image/')
  ) {
    return 'picture';
  }
  return 'other';
}

export function resolveSafeDocumentViewUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  if (
    trimmed.includes('NoSuchKey') ||
    trimmed.includes('NoSuchBucket') ||
    trimmed.includes('Bucket not found') ||
    trimmed.includes('statusCode') ||
    trimmed.includes('documents/unassigned/moa_')
  ) {
    return '';
  }

  // If an API proxy URL was previously saved or passed, extract and unwrap the actual original storage URL
  if (trimmed.includes('/api/documents?action=view') || trimmed.includes('/api/documents')) {
    try {
      const match = trimmed.match(/[?&]url=([^&]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded && (decoded.startsWith('http://') || decoded.startsWith('https://'))) {
          return decoded;
        }
      }
    } catch {}
  }

  // Direct Supabase storage URLs (or any direct http/https URLs) should be loaded directly
  // by the browser for images, PDFs, downloads, etc. - NEVER rewritten to a 404 relative endpoint
  return trimmed;
}

/**
 * Converts a base64 `data:` URL into an object (blob) URL.
 * Browsers block top-level navigation to `data:` URLs and some refuse to render
 * large `data:application/pdf` URLs inside iframes, so blob URLs are used instead.
 * Returns the original URL unchanged for non-data URLs.
 */
export function dataUrlToBlobUrl(url: string): string {
  if (!url || !url.startsWith('data:')) return url;
  try {
    const commaIdx = url.indexOf(',');
    const meta = url.slice(5, commaIdx); // e.g. "application/pdf;base64"
    const mime = meta.split(';')[0] || 'application/octet-stream';
    const isBase64 = meta.includes(';base64');
    const payload = url.slice(commaIdx + 1);
    let bytes: Uint8Array;
    if (isBase64) {
      const binary = atob(payload);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch (err) {
    console.warn('Failed to convert data URL to blob URL:', err);
    return url;
  }
}

/** Opens a document (image, PDF, etc.) in a new browser tab for full-size review. */
export function openDocumentInNewTab(url: string): void {
  if (!url) return;
  const safeUrl = resolveSafeDocumentViewUrl(url);
  if (!safeUrl) {
    console.warn('Cannot open document from invalid storage error URL:', url);
    return;
  }
  const viewUrl = safeUrl.startsWith('data:') ? dataUrlToBlobUrl(safeUrl) : safeUrl;
  const win = window.open(viewUrl, '_blank');
  if (win) {
    try {
      win.opener = null;
    } catch {}
  }
  if (viewUrl.startsWith('blob:') && viewUrl !== safeUrl) {
    // Keep the blob alive long enough for the new tab to load it
    setTimeout(() => URL.revokeObjectURL(viewUrl), 60_000);
  }
  if (!win) {
    // Popup blocked – fall back to a temporary anchor click
    const a = document.createElement('a');
    a.href = viewUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export async function downloadDocument(url: string, fileName?: string): Promise<void> {
  if (!url) return;
  const safeUrl = resolveSafeDocumentViewUrl(url);
  if (!safeUrl) {
    console.warn('Cannot download document from invalid storage error URL:', url);
    return;
  }
  const resolvedFileName = fileName || 'downloaded-document';

  try {
    // If it's a base64 or blob URL, trigger instant client-side download
    if (safeUrl.startsWith('data:') || safeUrl.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = safeUrl;
      a.download = resolvedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const response = await fetch(safeUrl);
    if (!response.ok) {
      throw new Error(`Download HTTP error status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const blob = await response.blob();

    // Guard against small JSON error responses (<150 bytes) being saved as corrupted docs
    if (contentType.includes('application/json') || blob.size < 150) {
      const text = await blob.text();
      if (
        text.includes('statusCode') ||
        text.includes('NoSuchKey') ||
        text.includes('Bucket not found') ||
        text.includes('NoSuchBucket') ||
        text.includes('error')
      ) {
        throw new Error('Storage returned error payload instead of binary file');
      }
      // Re-create blob with binary type if it passed
      const validBlob = new Blob([text], { type: contentType || 'application/octet-stream' });
      const blobUrl = window.URL.createObjectURL(validBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = resolvedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      return;
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = resolvedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.warn('Direct blob download notice, falling back to window navigation:', err);
    const navUrl = safeUrl.startsWith('http') ? safeUrl : url.startsWith('http') ? url : '';
    if (navUrl) {
      window.open(navUrl, '_blank');
    }
  }
}
