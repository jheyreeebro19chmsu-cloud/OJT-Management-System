import { uploadDocumentToStorage as supabaseUploadDoc } from '../services/supabaseService';
import { resolveSafeDocumentViewUrl } from './attachmentHelper';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export async function uploadDocumentToStorage(
  file: File,
  employeeId: string,
  docKey: string
): Promise<{ fileUrl: string; dataUrl: string }> {
  let remoteUrl = '';
  try {
    remoteUrl = await supabaseUploadDoc(employeeId || 'monitoring', docKey, file, file.name);
  } catch {
    remoteUrl = '';
  }

  // If uploaded to Supabase Storage with a public HTTP URL, use that lightweight URL for both fileUrl and dataUrl
  if (remoteUrl && remoteUrl.startsWith('http')) {
    return {
      fileUrl: remoteUrl,
      dataUrl: remoteUrl,
    };
  }

  // Fallback to base64 dataUrl only if remote storage upload was unavailable
  const dataUrl = await readFileAsDataUrl(file);
  return {
    fileUrl: dataUrl,
    dataUrl,
  };
}

export function resolveDocumentPreviewUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
  return resolveSafeDocumentViewUrl(rawUrl) || rawUrl;
}

export function formatFileSize(size?: number | string): string {
  if (size === undefined || size === null || size === '') return 'File';
  if (typeof size === 'string') {
    const num = Number(size);
    if (!Number.isFinite(num)) return size;
    size = num;
  }
  if (size <= 0) return 'File';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}
