// Widget form registry.
//
// Adding a new in-article widget type means adding ONE entry here — the
// DetailsPanel's WidgetConfigPanel looks up Form/label/color from this map,
// so it doesn't need editing.
//
// Each Form receives:
//   - widget:  the widget's current state object
//   - update:  partial-update callback dispatched into the editor reducer
//   - context: optional shared data the form may need
//              (e.g. CourseMatchForm needs the list of studio courses)

import QuizForm from "./QuizForm";
import NewsletterForm from "./NewsletterForm";
import CourseMatchForm from "./CourseMatchForm";
import NextStepsForm from "./NextStepsForm";

export const WIDGET_REGISTRY = {
  quiz:        { Form: QuizForm,        label: "Knowledge Check", color: "#16a34a" },
  newsletter:  { Form: NewsletterForm,  label: "Newsletter CTA",   color: "#003b93" },
  coursematch: { Form: CourseMatchForm, label: "Course CTA",       color: "#4f46e5" },
  nextsteps:   { Form: NextStepsForm,   label: "AI Next Steps",    color: "#b45309" },
};

export function getWidgetEntry(type) {
  return WIDGET_REGISTRY[type] || null;
}
