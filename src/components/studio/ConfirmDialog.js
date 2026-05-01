"use client";

import { X } from "lucide-react";

export default function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;

  return (
    <div className="sched-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sched-modal" style={{ maxWidth: 400 }}>
        <button className="modal-close-x" onClick={onClose}><X size={18} /></button>
        
        <div className="sched-title" style={{ marginBottom: 12 }}>
          {dialog.title}
        </div>
        
        <div className="sched-sub" style={{ marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
          {dialog.message}
        </div>

        <div className="sched-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button 
            className="sched-cancel" 
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text3)', fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            className="sched-confirm"
            onClick={dialog.onConfirm}
            style={{ 
              padding: '10px 20px', borderRadius: 8, border: 'none', 
              background: dialog.confirmType === 'danger' ? 'var(--red)' : 'var(--primary)', 
              color: '#fff', fontWeight: 700, cursor: 'pointer' 
            }}
          >
            {dialog.confirmText || "Confirm"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-close-x {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          color: var(--text4);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .modal-close-x:hover {
          background: var(--bg3);
          color: var(--text);
        }
      `}</style>
    </div>
  );
}
