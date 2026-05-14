import { sanitizeContent } from './sanitizer';

export function toRow(payload) {
  return {
    title: payload.title,
    slug: payload.slug,
    excerpt: payload.excerpt ?? '',
    content: sanitizeContent(payload.content ?? ''),
    category: payload.category ?? '',
    domain_tags: payload.domain_tags ?? [],
    skill_level: payload.skill_level ?? 'Beginner',
    read_time: payload.readTime ?? '',
    author_id: payload.authorId ?? 'al-editorial',
    image: payload.image ?? '',
    alt_text: payload.alt_text ?? '',
    seo: payload.seo ?? {},
    course_mappings: payload.courseMappings ?? [],
    course_cta: payload.courseCTA ?? '',
    newsletter: payload.newsletter ?? {},
    ai_hints: payload.aiHints ?? {},
    trust: payload.trust ?? {},
    discussion: payload.discussion ?? {},
    advanced: payload.advanced ?? {},
  };
}
