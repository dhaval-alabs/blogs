"use client";

import { useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import useStudioDraft from "@/hooks/useStudioDraft";
import StudioSidebar from "@/components/studio/StudioSidebar";
import { StudioContext } from "@/components/studio/StudioSidebarContext";
import "./studio.css";

export default function StudioLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authorProfile, signOut } = useAuth();
  const normalizedPath = (pathname || "").replace(/\/$/, "") || "/";
  const isLoginPage = normalizedPath === "/studio/login";

  const {
    state,
    set,
    setMany,
    dispatch,
    showToast,
    fetchAllPosts,
    clearEditor,
    loadPostForEdit,
    restoreDraft,
    discardDraft,
    clearDraftOnSuccess,
  } = useStudioDraft();

  // Memoized so StudioContext.Provider doesn't see a new value on every render
  // of this layout — which would force every child consumer (sidebar, editor,
  // every Studio page) to re-render and re-run effects (incl. data fetches).
  const dynamicAuthor = useMemo(() => ({
    slug: authorProfile?.slug || "al-editorial",
    name: authorProfile?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Author",
    image: authorProfile?.image || user?.user_metadata?.avatar_url || "/authors/default.svg",
    initials: authorProfile?.initials || user?.user_metadata?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || "U",
    is_super_admin: authorProfile?.is_super_admin || false,
    email: user?.email,
  }), [authorProfile, user]);

  useEffect(() => {
    // Force light mode in studio regardless of system settings
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";

    // Optional: if you want to restore dark mode when leaving studio, 
    // you'd need to check localStorage/matchMedia here. 
    // But usually, removing it is enough for the "remove dark theme" request.
  }, []);

  useEffect(() => {
    if (isLoginPage) return;
    fetchAllPosts();
  }, [fetchAllPosts, isLoginPage]);

  const handleClearEditor = () => {
    clearEditor();
    if (normalizedPath !== '/studio') router.push('/studio');
  };

  const handleLoadPostForEdit = (post) => {
    loadPostForEdit(post);
    if (normalizedPath !== '/studio') router.push('/studio');
  };

  // Same reasoning as dynamicAuthor — fresh object literal would invalidate
  // the context on every render. All function members are useCallback'd
  // inside useStudioDraft, so referential stability here is what we expect.
  const contextValue = useMemo(() => ({
    state,
    set,
    setMany,
    dispatch,
    showToast,
    fetchAllPosts,
    clearEditor,
    loadPostForEdit,
    restoreDraft,
    discardDraft,
    clearDraftOnSuccess,
    dynamicAuthor,
    signOut,
    user,
    authorProfile,
  }), [
    state, set, setMany, dispatch, showToast,
    fetchAllPosts, clearEditor, loadPostForEdit, restoreDraft, discardDraft, clearDraftOnSuccess,
    dynamicAuthor, signOut, user, authorProfile,
  ]);

  if (isLoginPage) {
    return (
      <StudioContext.Provider value={contextValue}>
        <div className="studio-wrapper light-theme">{children}</div>
      </StudioContext.Provider>
    );
  }

  return (
    <StudioContext.Provider value={contextValue}>
      <div className="studio-wrapper light-theme">
        <div className="app">
          <StudioSidebar
            viewMode={state.viewMode}
            postsViewMode={state.postsViewMode}
            allPosts={state.allPosts}
            clearEditor={handleClearEditor}
            loadPostForEdit={handleLoadPostForEdit}
            fetchAllPosts={fetchAllPosts}
            set={set}
            setMany={setMany}
            onGoHome={() => router.push("/")}
            signOut={signOut}
            dynamicAuthor={dynamicAuthor}
          />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </div>
    </StudioContext.Provider>
  );
}
