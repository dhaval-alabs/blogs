import re

with open("src/app/blog/[slug]/ArticleContent.js", "r") as f:
    content = f.read()

# Fix startsWith
content = content.replace('if (!content.startsWith("<")) {', 'if (!content.trim()) {')

# Find the block to replace
start_idx = content.find('// Legacy shortcode mapping')
end_idx = content.find('return <>{renderedElements}</>;') + len('return <>{renderedElements}</>;')

if start_idx != -1 and end_idx != -1:
    old_block = content[start_idx:end_idx]
    
    new_block = """const preProcessedContent = content
                .replace(/\\[\\[newsletter\\]\\]/gi, '<div data-widget="newsletter"></div>')
                .replace(/\\[\\[nextsteps\\]\\]/gi, '<div data-widget="nextsteps"></div>')
                .replace(/\\[\\[coursematch\\]\\]/gi, '<div data-widget="coursematch"></div>');

              // Helper to render specific widget
              const renderWidget = (type, attrs = {}) => {
                if (type === "newsletter") {
                  const headline = attrs.headline || `Free Resource: ${post.domain_tags?.[0] || "Data Science"} Career Roadmap PDF`;
                  const subtext  = attrs.subtext  || "Get our 2026 edition — covering top roles, skills, salaries, and learning paths. Trusted by 80,000+ learners.";
                  const button   = attrs.ctaLabel || "Get Free PDF →";

                  return (
                    <div key="newsletter-widget" className="my-10 rounded-2xl overflow-hidden border border-slate-200 dark:border-[#424754] bg-[#f8fafc] dark:bg-[#131b2e]">
                      <div className="p-7">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-primary text-xl">download</span>
                          <h4 className="font-[family-name:var(--font-headline)] font-bold text-lg text-slate-900 dark:text-[#dae2fd]">
                            {headline}
                          </h4>
                        </div>
                        <p className="text-slate-600 dark:text-[#c2c6d6] text-sm mb-5">
                          {subtext}
                        </p>
                        <form className="flex flex-col sm:flex-row gap-3" onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.target);
                            const name = fd.get("name")?.toString().trim();
                            const email = fd.get("email")?.toString().trim();
                            if (!email || !email.includes("@")) { addToast("Please enter a valid email", "error"); return; }
                            const { subscribeAction } = await import("@/app/actions");
                            const result = await subscribeAction({ email, name, source: "article-pdf" });
                            if (result.success) { addToast("Roadmap PDF sent to your email!", "success"); e.target.reset(); }
                            else addToast(result.error || "Failed to subscribe", "error");
                          }}>
                          <input type="text" name="name" placeholder="Your name"
                            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none border border-slate-200 dark:border-[#424754] bg-white dark:bg-[#0b1326] text-slate-900 dark:text-[#dae2fd]" />
                          <input type="email" name="email" placeholder="Enter your work email"
                            className="flex-[2] px-4 py-2.5 rounded-xl text-sm outline-none border border-slate-200 dark:border-[#424754] bg-white dark:bg-[#0b1326] text-slate-900 dark:text-[#dae2fd]" />
                          <button type="submit"
                            className="bg-primary text-white hover:bg-primary/90 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap shadow-sm transition-all">
                            {button}
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                }

                if (type === "nextsteps") {
                  let steps = [];
                  if (attrs.steps) {
                    try {
                      const parsed = typeof attrs.steps === "string" ? JSON.parse(attrs.steps) : attrs.steps;
                      steps = (parsed || []).filter(s => s.text?.trim());
                    } catch {}
                  }

                  // Default steps if none provided in editor
                  if (!steps.length) {
                    steps = [
                      { icon: "quiz",         text: "Take a quick quiz",           url: "#discussion" },
                      { icon: "download",     text: "Download PDF Guide",          url: "#newsletter" },
                      { icon: "school",       text: `View ${post.domain_tags?.[0] || "AI"} Curriculum`, url: "https://www.analytixlabs.co.in/courses" },
                      { icon: "group",        text: "Join Study Community",        url: "https://www.analytixlabs.co.in/community" },
                    ];
                  }

                  return (
                    <div key="nextsteps-widget" className="my-10 rounded-2xl border border-slate-200 dark:border-[#424754] overflow-hidden shadow-sm bg-[#f8fafc] dark:bg-[#131b2e]">
                      <div className="px-6 py-4 border-b border-slate-200 dark:border-[#424754]"
                        style={{ background: "linear-gradient(90deg,rgba(0,59,147,0.03) 0%,transparent 100%)" }}>
                        <h3 className="font-[family-name:var(--font-headline)] font-bold text-base flex items-center gap-2 text-slate-900 dark:text-[#dae2fd]">
                          <span className="text-amber-500">✦</span>
                          Next Steps for You
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-[#c2c6d6] mt-0.5">
                          Great progress on {post.domain_tags?.[0] || "this topic"}! Based on your reading, what would you like to do next?
                        </p>
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {steps.map((step, i) => (
                          <a key={i} href={step.url || "#"}
                            className="flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition-all bg-white dark:bg-[#0b1326] border-slate-200 dark:border-[#424754] text-slate-700 dark:text-[#c2c6d6] hover:border-primary/30 dark:hover:border-primary/60 hover:text-primary dark:hover:text-[#adc6ff] hover:-translate-y-0.5 shadow-sm">
                            <span className="material-symbols-outlined text-base text-slate-400">{step.icon || "arrow_forward"}</span>
                            <span className="leading-snug">{step.text}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (type === "coursematch") {
                  const title = attrs.courseName || courseMatch?.title || "Advanced AI Curriculum";
                  const head  = attrs.ctaHeadline || "Ready to go deeper? Enroll now →";
                  const url   = attrs.courseUrl || "https://www.analytixlabs.co.in/courses";
                  const desc  = (attrs.courseName) ? "" : (courseMatch?.desc || ""); // Hide default desc if custom course

                  return (
                    <div key="course-widget" className="my-10 rounded-2xl overflow-hidden flex flex-col md:flex-row border border-slate-200 dark:border-[#424754] shadow-sm bg-[#f8fafc] dark:bg-[#131b2e]">
                      <div className="flex-1 p-7 flex flex-col gap-3">
                        <p className="text-primary text-xs font-bold uppercase tracking-wider">{head}</p>
                        <h3 className="font-[family-name:var(--font-headline)] font-bold text-xl text-slate-900 dark:text-[#dae2fd] leading-tight">
                          {title}
                        </h3>
                        {desc && <p className="text-slate-600 dark:text-[#c2c6d6] text-sm leading-relaxed">{desc}</p>}
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-block bg-primary text-white hover:bg-primary/90 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all mt-2 text-center md:self-start">
                          View Full Course Details →
                        </a>
                      </div>
                      {(courseMatch?.image && !attrs.courseName) && (
                        <div className="w-full md:w-48 aspect-video md:aspect-auto relative overflow-hidden">
                          <Image src={courseMatch.image} alt={title} fill className="object-cover opacity-70" />
                        </div>
                      )}
                    </div>
                  );
                }

                return null;
              };

              return (
                <div className="tiptap-prose">
                  {parse(preProcessedContent, {
                    replace(domNode) {
                      // Strip any embedded script tags (e.g. old schema or tracking code)
                      // to prevent duplication with our modern schema injection.
                      if (domNode.type === "script" || domNode.name === "script") {
                        return <></>;
                      }

                      if (
                        domNode.type === "tag" &&
                        domNode.name === "div" &&
                        domNode.attribs?.["data-widget"]
                      ) {
                        const widgetType = domNode.attribs["data-widget"];
                        let attrs = {};
                        try {
                          attrs = JSON.parse(domNode.attribs["data-widget-attrs"] || "{}");
                        } catch {}

                        if (widgetType === "quiz") {
                          return (
                            <FrontendKnowledgeCheck
                              question={attrs.question}
                              options={attrs.options}
                              correctIndex={attrs.correctIndex}
                              explanation={attrs.explanation}
                            />
                          );
                        }

                        // Handle other inline widgets correctly with custom attributes
                        if (["newsletter", "nextsteps", "coursematch"].includes(widgetType)) {
                          // Respect layout flags for legacy widget types
                          if (widgetType === "newsletter"  && !layout.showLeadGen) return <></>;
                          if (widgetType === "nextsteps"   && !layout.showNextSteps) return <></>;
                          if (widgetType === "coursematch" && !layout.showCourseCta) return <></>;
                          return renderWidget(widgetType, attrs);
                        }

                        // other widget types can be mapped here as they are built
                        return <></>;
                      }
                    },
                  })}
                </div>
              );"""
    
    content = content.replace(old_block, new_block)
    
    with open("src/app/blog/[slug]/ArticleContent.js", "w") as f:
        f.write(content)
    print("Successfully replaced content.")
else:
    print("Could not find blocks to replace!")

