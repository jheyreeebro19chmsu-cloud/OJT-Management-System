import React, { useState } from 'react';
import { FileText, Download, ExternalLink, Eye, X, Image as ImageIcon } from 'lucide-react';
import { parseAnnouncementAttachment, ParsedAttachment } from '../utils/attachmentHelper';

interface Props {
  photo?: string;
  allowDownload?: boolean;
}

export function AnnouncementAttachmentView({ photo, allowDownload = true }: Props) {
  const [showImageModal, setShowImageModal] = useState(false);
  const attachment = parseAnnouncementAttachment(photo);

  if (!attachment || !attachment.url) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name || 'attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (attachment.url.startsWith('data:application/pdf')) {
      // Open base64 pdf in new tab cleanly
      const win = window.open();
      if (win) {
        win.document.write(
          `<iframe src="${attachment.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
        win.document.title = attachment.name;
      } else {
        window.open(attachment.url, '_blank');
      }
    } else {
      window.open(attachment.url, '_blank');
    }
  };

  // 1. IMAGE ATTACHMENT
  if (attachment.type === 'image') {
    return (
      <div className="my-3">
        <div className="group relative inline-block max-w-md w-full bg-slate-50 rounded-2xl p-2 border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all">
          <img
            src={attachment.url}
            alt={attachment.name}
            onClick={() => setShowImageModal(true)}
            className="w-full max-h-72 object-contain rounded-xl cursor-zoom-in transition-transform group-hover:scale-[1.01]"
          />
          <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium truncate max-w-[200px]" title={attachment.name}>
              <ImageIcon size={14} className="text-blue-600 shrink-0" />
              <span className="truncate">{attachment.name}</span>
            </span>
            {allowDownload && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowImageModal(true)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 shadow-xs flex items-center gap-1 transition-all"
                  title="Preview Full Size"
                >
                  <Eye size={12} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1 transition-all"
                  title="Download Image"
                >
                  <Download size={12} />
                  <span>Download</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Full Image Modal */}
        {showImageModal && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowImageModal(false)}
          >
            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <div className="w-full flex items-center justify-between text-white pb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} />
                  <span className="font-bold text-sm truncate max-w-sm">{attachment.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors"
                    title="Download"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={() => setShowImageModal(false)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20 bg-slate-900"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. PDF ATTACHMENT
  if (attachment.type === 'pdf') {
    return (
      <div className="my-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-red-50/70 border border-red-200/90 rounded-2xl shadow-xs max-w-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
              PDF
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate" title={attachment.name}>
                {attachment.name}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-red-700 font-medium mt-0.5">
                <span>Portable Document Format</span>
                {attachment.size && <span>• {attachment.size}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handleOpenNewTab}
              className="px-3 py-1.5 bg-white hover:bg-red-100/50 text-red-700 font-bold text-xs rounded-xl border border-red-200 shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Eye size={13} />
              <span>View PDF</span>
            </button>
            {allowDownload && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Download size={13} />
                <span>Download</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. DOC / GENERIC ATTACHMENT
  return (
    <div className="my-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-blue-50/70 border border-blue-200/90 rounded-2xl shadow-xs max-w-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate" title={attachment.name}>
              {attachment.name}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-blue-700 font-medium mt-0.5">
              <span>Attached Document</span>
              {attachment.size && <span>• {attachment.size}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {allowDownload && (
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Download size={13} />
              <span>Download File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
