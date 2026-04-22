"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchSubscribersAction,
  toggleSubscriberAction,
  deleteSubscriberAction,
} from "@/app/actions";
import StudioToast from "@/components/studio/StudioToast";
import { useStudioContext } from "@/components/studio/StudioSidebarContext";

export default function SubscribersPage() {
  const router = useRouter();
  const { authorProfile, loading: authLoading } = useAuth();
  const { dynamicAuthor } = useStudioContext();

  const [subscribers, setSubscribers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (authLoading) return;
    if (!authorProfile?.is_super_admin) router.replace("/studio");
  }, [authLoading, authorProfile, router]);

  const load = useCallback(async () => {
    setFetching(true);
    const result = await fetchSubscribersAction();
    if (result.success) setSubscribers(result.subscribers);
    else showToast(result.error || "Failed to load", "err");
    setFetching(false);
  }, []);

  useEffect(() => {
    if (authorProfile?.is_super_admin) load();
  }, [authorProfile, load]);

  const showToast = (msg, type = "ok") =>
    setToast({ msg, type, id: Date.now() });

  const sources = useMemo(() => {
    const s = new Set(subscribers.map((r) => r.source || "unknown"));
    return ["all", ...Array.from(s)];
  }, [subscribers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscribers.filter((r) => {
      if (sourceFilter !== "all" && (r.source || "unknown") !== sourceFilter)
        return false;
      if (activeFilter === "active" && !r.is_active) return false;
      if (activeFilter === "inactive" && r.is_active) return false;
      if (!q) return true;
      return (
        (r.email || "").toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q)
      );
    });
  }, [subscribers, query, sourceFilter, activeFilter]);

  async function handleToggle(row) {
    if (busy.has(row.id)) return;
    setBusy((p) => new Set(p).add(row.id));
    const result = await toggleSubscriberAction(row.id, !row.is_active);
    if (result.success) {
      setSubscribers((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, is_active: !row.is_active } : r
        )
      );
      showToast(row.is_active ? "Marked inactive" : "Reactivated");
    } else {
      showToast(result.error || "Update failed", "err");
    }
    setBusy((p) => {
      const n = new Set(p);
      n.delete(row.id);
      return n;
    });
  }

  async function handleDelete(id) {
    if (busy.has(id)) return;
    if (!confirm("Delete this subscriber permanently?")) return;
    setBusy((p) => new Set(p).add(id));
    const result = await deleteSubscriberAction(id);
    if (result.success) {
      setSubscribers((prev) => prev.filter((r) => r.id !== id));
      showToast("Deleted");
    } else {
      showToast(result.error || "Delete failed", "err");
    }
    setBusy((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
  }

  function exportCsv() {
    const rows = filtered.length ? filtered : subscribers;
    if (!rows.length) {
      showToast("Nothing to export", "err");
      return;
    }
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["id", "email", "name", "source", "subscribed_at", "is_active"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((k) => esc(k === "is_active" ? (r[k] ? "active" : "inactive") : r[k]))
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authLoading) return null;

  const totalActive = subscribers.filter((r) => r.is_active).length;

  return (
    <>
      {toast && (
        <StudioToast
          key={toast.id}
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <span className="tb-crumb">
            Studio&nbsp;
            <span style={{ color: "var(--text4)", margin: "0 4px" }}>/</span>
            &nbsp;
            <span style={{ color: "var(--text)" }}>Subscribers</span>
          </span>

          <div className="tb-title">Newsletter Subscribers</div>

          <div className="tb-saved-wrap">
            <div
              className="tb-saved-dot"
              style={{
                background: fetching ? "var(--orange)" : "var(--green)",
              }}
            />
            {fetching ? "Refreshing..." : `${totalActive} active`}
          </div>

          <button
            className="tb-ghost"
            onClick={exportCsv}
            disabled={fetching || !subscribers.length}
            style={{ marginRight: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>

          <button className="tb-ghost" onClick={load} disabled={fetching}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>

          <div
            className="tb-profile"
            onClick={() => router.push("/studio/settings")}
          >
            <div className="tb-avatar-circle">
              {dynamicAuthor?.image ? (
                <img src={dynamicAuthor.image} alt="" />
              ) : (
                dynamicAuthor?.initials
              )}
            </div>
          </div>
        </header>

        <div
          className="workspace"
          style={{
            background: "var(--bg2)",
            padding: "32px 40px",
            overflowY: "auto",
            display: "block",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "var(--text)",
                  margin: 0,
                  letterSpacing: "-0.5px",
                }}
              >
                All Subscribers
              </h2>
              <p
                style={{
                  color: "var(--text3)",
                  fontSize: 13,
                  margin: "4px 0 0",
                }}
              >
                {subscribers.length} total · {totalActive} active ·{" "}
                {subscribers.length - totalActive} inactive
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search email or name..."
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                  minWidth: 240,
                }}
              />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                }}
              >
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All sources" : s}
                  </option>
                ))}
              </select>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                  fontSize: 13,
                }}
              >
                <option value="all">All status</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 && !fetching && (
            <div
              className="glass-chip"
              style={{
                padding: "80px 40px",
                textAlign: "center",
                borderRadius: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                background: "var(--bg)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: "var(--bg3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text4)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 32 }}
                >
                  mail
                </span>
              </div>
              <div>
                <h3 style={{ margin: 0, color: "var(--text)", fontSize: 18 }}>
                  {subscribers.length === 0
                    ? "No subscribers yet"
                    : "No matches"}
                </h3>
                <p
                  style={{
                    margin: "4px 0 0",
                    color: "var(--text3)",
                    fontSize: 14,
                  }}
                >
                  {subscribers.length === 0
                    ? "Newsletter sign-ups from the blog will appear here."
                    : "Try adjusting your filters or search query."}
                </p>
              </div>
            </div>
          )}

          {filtered.length > 0 && (
            <div
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--bg2)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Subscribed</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isBusy = busy.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          opacity: isBusy ? 0.5 : 1,
                        }}
                      >
                        <td style={tdStyle}>
                          <span
                            style={{ fontWeight: 600, color: "var(--text)" }}
                          >
                            {row.email}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: "var(--text2)" }}>
                            {row.name || "—"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "var(--blue-dim)",
                              color: "var(--blue)",
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {row.source || "unknown"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: "var(--text3)" }}>
                          {formatDate(row.subscribed_at)}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: row.is_active
                                ? "var(--green-dim)"
                                : "var(--red-dim)",
                              color: row.is_active
                                ? "var(--green)"
                                : "var(--red)",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button
                            className="tb-ghost"
                            onClick={() => handleToggle(row)}
                            disabled={isBusy}
                            style={{ fontSize: 12, padding: "6px 10px" }}
                          >
                            {row.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            className="tb-ghost"
                            onClick={() => handleDelete(row.id)}
                            disabled={isBusy}
                            style={{
                              fontSize: 12,
                              padding: "6px 10px",
                              color: "var(--red)",
                              marginLeft: 6,
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "12px 16px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text3)",
};

const tdStyle = {
  padding: "14px 16px",
  verticalAlign: "middle",
};

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
