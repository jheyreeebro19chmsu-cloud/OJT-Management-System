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
    str.includes('msword') ||
    str.includes('wordprocessingml')
  ) {
    return 'doc';
  }
  if (
    str.endsWith('.jpg') ||
    str.endsWith('.jpeg') ||
    str.endsWith('.png') ||
    str.endsWith('.webp') ||
    str.endsWith('.gif') ||
    str.includes('image/')
  ) {
    return 'picture';
  }
  return 'other';
}

export async function downloadDocument(url: string, fileName?: string): Promise<void> {
  if (!url) return;
  const resolvedFileName = fileName || 'downloaded-document';

  try {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = resolvedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to window navigation:', err);
    const a = document.createElement('a');
    a.href = url;
    a.download = resolvedFileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
