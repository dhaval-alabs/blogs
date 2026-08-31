"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchRedirectsAction, saveRedirectAction, deleteRedirectAction } from "@/app/actions";
import { 
  ArrowLeft, Plus, Trash2, Edit2, CheckCircle2, 
  ShieldAlert, Loader2, Save, X, ExternalLink, 
  RefreshCw, Power
} from "lucide-react";

export default function RedirectsPage() {
  const router = useRouter();
  const { authorProfile, loading: authLoading } = useAuth();
  
  const [redirects, setRedirects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    source: "",
    destination: "",
    type: "301",
    active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!authorProfile?.is_super_admin) {
        router.replace("/studio");
        return;
      }
      loadRedirects();
    }
  }, [authLoading, authorProfile, router]);

  const loadRedirects = async () => {
    setIsLoading(true);
    const res = await fetchRedirectsAction();
    if (res.success) {
      setRedirects(res.redirects);
    } else {
      setMessage({ type: 'err', text: res.error });
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const res = await saveRedirectAction(formData, editingId);
    if (res.success) {
      setMessage({ type: 'success', text: editingId ? "Redirect updated!" : "Redirect created!" });
      setFormData({ source: "", destination: "", type: "301", active: true });
      setIsEditing(false);
      setEditingId(null);
      loadRedirects();
    } else {
      setMessage({ type: 'err', text: res.error });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this redirect?")) return;
    
    const res = await deleteRedirectAction(id);
    if (res.success) {
      loadRedirects();
    } else {
      setMessage({ type: 'err', text: res.error });
    }
  };

  const handleEdit = (redirect) => {
    setFormData({
      source: redirect.source,
      destination: redirect.destination,
      type: redirect.type?.toString() || "301",
      active: redirect.active
    });
    setEditingId(redirect.id);
    setIsEditing(true);
  };

  if (authLoading || isLoading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}><Loader2 className="spinning" size={32} color="var(--primary)" /></div>;
  }

  return (
    <div style={{ flex: 1, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px' }}>
        
        {/* Navigation */}
        <button 
          onClick={() => router.push("/studio")} 
          style={{ 
            background: 'none', border: 'none', color: 'var(--text3)', 
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontSize: 14, fontWeight: 500, marginBottom: 40, padding: 0
          }}
        >
          <ArrowLeft size={16} /> Back to Studio
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: '-0.5px' }}>URL Redirects</h1>
            <p style={{ margin: '8px 0 0', color: 'var(--text3)', fontSize: 15 }}>Manage 301 and 302 redirections for the blog.</p>
          </div>
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              style={{ 
                padding: '12px 24px', borderRadius: 12, background: 'var(--primary)', color: '#fff', border: 'none', 
                fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(39, 65, 108, 0.2)'
              }}
            >
              <Plus size={18} /> New Redirect
            </button>
          )}
        </div>

        {message && (
          <div style={{ 
            padding: '14px 20px', borderRadius: 12, marginBottom: 32, fontSize: 14, fontWeight: 500,
            background: message.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)', 
            color: message.type === 'success' ? 'var(--green)' : 'var(--red)',
            border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            {message.text}
          </div>
        )}

        {/* Editor Form */}
        {isEditing && (
          <div style={{ 
            background: 'var(--bg2)', padding: 32, borderRadius: 20, border: '1px solid var(--border)', 
            marginBottom: 48, boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700 }}>{editingId ? "Edit Redirect" : "Add New Redirect"}</h3>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 20, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>SOURCE PATH</label>
                <input 
                  type="text" 
                  value={formData.source} 
                  onChange={e => setFormData({...formData, source: e.target.value})}
                  placeholder="/old-path"
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>DESTINATION URL</label>
                <input 
                  type="text" 
                  value={formData.destination} 
                  onChange={e => setFormData({...formData, destination: e.target.value})}
                  placeholder="/new-path or https://..."
                  required
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8 }}>TYPE</label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, cursor: 'pointer' }}
                >
                  <option value="301">301</option>
                  <option value="302">302</option>
                  <option value="307">307</option>
                  <option value="308">308</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button 
                  type="button" 
                  onClick={() => { setIsEditing(false); setEditingId(null); setFormData({source:"", destination:"", type:"301", active:true}); }}
                  style={{ padding: '10px 20px', borderRadius: 10, background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  <X size={16} style={{ marginBottom: -3, marginRight: 4 }} /> Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ padding: '10px 24px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                >
                  {isSubmitting ? <Loader2 size={16} className="spinning" /> : editingId ? "Update Redirect" : "Create Redirect"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Redirects Table */}
        <div style={{ background: 'var(--bg2)', borderRadius: 20, border: '1px solid var(--border)', overflowX: 'auto', overflowY: 'hidden' }}>
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Source Path</th>
                <th style={{ textAlign: 'left', padding: '16px 24px', color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Destination</th>
                <th style={{ textAlign: 'center', padding: '16px 24px', color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Type</th>
                <th style={{ textAlign: 'center', padding: '16px 24px', color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '16px 24px', color: 'var(--text3)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {redirects.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text4)' }}>
                    No redirects configured yet.
                  </td>
                </tr>
              ) : (
                redirects.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="table-row">
                    <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text)' }}>
                      {r.source}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.destination}</span>
                        <a href={r.destination} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', opacity: 0.5 }}><ExternalLink size={12} /></a>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg3)', fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                       <span style={{ 
                         display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, 
                         fontSize: 11, fontWeight: 700,
                         background: r.active ? 'var(--green-dim)' : 'var(--bg3)',
                         color: r.active ? 'var(--green)' : 'var(--text4)'
                       }}>
                         <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.active ? 'var(--green)' : 'var(--text4)' }} />
                         {r.active ? "ACTIVE" : "DISABLED"}
                       </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button 
                          onClick={() => handleEdit(r)}
                          style={{ pading: 8, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', borderRadius: 8 }}
                          className="action-btn"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(r.id)}
                          style={{ pading: 8, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', borderRadius: 8 }}
                          className="action-btn"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .spinning { animation: spin 1s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .table-row:hover { background: var(--bg3); }
          .action-btn { 
            padding: 8px; 
            transition: all 0.2s; 
          }
          .action-btn:hover { 
            background: var(--bg); 
            color: var(--primary) !important; 
          }
        `}} />
      </div>
    </div>
  );
}
