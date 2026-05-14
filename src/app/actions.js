'use server';

import * as postSvc from '@/lib/services/postService';
import * as subscriberSvc from '@/lib/services/subscriberService';
import * as commentSvc from '@/lib/services/commentService';
import * as authorSvc from '@/lib/services/authorService';
import * as courseSvc from '@/lib/services/courseService';
import * as siteConfigSvc from '@/lib/services/siteConfigService';

// ── Posts ─────────────────────────────────────────────────────────
export const saveDraftAction = async (payload, id) => postSvc.saveDraft(payload, id);
export const publishPostAction = async (payload) => postSvc.publishPost(payload);
export const updatePostAction = async (id, payload) => postSvc.updatePost(id, payload);
export const publishExistingDraftAction = async (id, payload) => postSvc.publishExistingDraft(id, payload);
export const deletePostAction = async (id) => postSvc.deletePost(id);
export const togglePostStatusAction = async (id) => postSvc.togglePostStatus(id);
export const schedulePostAction = async (payload, scheduledDate) => postSvc.schedulePost(payload, scheduledDate);
export const fetchVersionsAction = async (postId) => postSvc.fetchVersions(postId);
export const restoreVersionAction = async (postId, versionId) => postSvc.restoreVersion(postId, versionId);
export const likePostAction = async (slug, delta) => postSvc.likePost(slug, delta);

// ── Subscribers ───────────────────────────────────────────────────
export const subscribeAction = async (args) => subscriberSvc.subscribe(args);
export const fetchSubscribersAction = async () => subscriberSvc.fetchSubscribers();
export const toggleSubscriberAction = async (id, isActive) => subscriberSvc.toggleSubscriber(id, isActive);
export const deleteSubscriberAction = async (id) => subscriberSvc.deleteSubscriber(id);

// ── Comments ──────────────────────────────────────────────────────
export const postCommentAction = async (input) => commentSvc.postComment(input);
export const likeCommentAction = async (commentId, delta) => commentSvc.likeComment(commentId, delta);
export const fetchCommentsAction = async (postSlug) => commentSvc.fetchComments(postSlug);
export const fetchPendingCommentsAction = async () => commentSvc.fetchPendingComments();
export const fetchApprovedCommentsAction = async () => commentSvc.fetchApprovedComments();
export const approveCommentAction = async (commentId) => commentSvc.approveComment(commentId);
export const rejectCommentAction = async (commentId) => commentSvc.rejectComment(commentId);
export const batchModerateCommentsAction = async (ids, action) => commentSvc.batchModerateComments(ids, action);

// ── Authors / Users ───────────────────────────────────────────────
export const adminCreateUserAction = async (args) => authorSvc.adminCreateUser(args);
export const updateAuthorProfileAction = async (args) => authorSvc.updateAuthorProfile(args);
export const toggleSuperAdminAction = async (targetSlug, makeSuperAdmin) => authorSvc.toggleSuperAdmin(targetSlug, makeSuperAdmin);
export const fetchAllAuthorsAction = async () => authorSvc.fetchAllAuthors();

// ── Courses ───────────────────────────────────────────────────────
export const createCourseAction = async (args) => courseSvc.createCourse(args);
export const updateCourseAction = async (id, args) => courseSvc.updateCourse(id, args);
export const deleteCourseAction = async (id) => courseSvc.deleteCourse(id);

// ── Site Config & Redirects ───────────────────────────────────────
export const upsertTopicsAction = async (topics) => siteConfigSvc.upsertTopics(topics);
export const updateBlogPageConfigAction = async (args) => siteConfigSvc.updateBlogPageConfig(args);
export const fetchRedirectsAction = async () => siteConfigSvc.fetchRedirects();
export const saveRedirectAction = async (payload, id) => siteConfigSvc.saveRedirect(payload, id);
export const deleteRedirectAction = async (id) => siteConfigSvc.deleteRedirect(id);
