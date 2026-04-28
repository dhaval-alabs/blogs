// Remove inline `color` and `background-color` declarations from every
// `style="…"` attribute in the supplied HTML, dropping the attribute entirely
// if no other declarations remain. The editor's Color extension stores user
// colour choices inline; those would shadow our light/dark CSS if rendered or
// re-edited as-is, leading to invisible white-on-white text or mode-locked
// colour that ignores dark mode on the live site.
export function stripInlineColors(html) {
  if (!html || typeof html !== "string") return html;

  const cleanDecls = (body) =>
    body
      .split(";")
      .map((decl) => decl.trim())
      .filter((decl) => decl && !/^(color|background(-color)?)\s*:/i.test(decl))
      .join("; ");

  return html
    .replace(/\sstyle="([^"]*)"/gi, (_, body) => {
      const cleaned = cleanDecls(body);
      return cleaned ? ` style="${cleaned}"` : "";
    })
    .replace(/\sstyle='([^']*)'/gi, (_, body) => {
      const cleaned = cleanDecls(body);
      return cleaned ? ` style='${cleaned}'` : "";
    });
}
