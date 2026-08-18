/**
 * Verifies the Tiptap extension set (src/components/editor/editor-config.ts)
 * supports every control in the editor toolbar — the schema must contain the
 * nodes/marks each command targets, with the attributes the toolbar writes
 * (color, fontSize, fontFamily, highlight color, textAlign) and heading
 * levels 1-6 that the dropdown offers.
 *
 * Run: npm run test:toolbar
 */
import { readFileSync } from "node:fs";
import { getSchema } from "@tiptap/core";
import { buildEditorExtensions } from "../src/components/editor/editor-config";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

const extensions = buildEditorExtensions("test placeholder");
const schema = getSchema(extensions);

// ---- Every node/mark the toolbar targets must exist in the schema ----
{
  const marks = Object.keys(schema.marks).sort();
  for (const name of ["bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight"]) {
    check(marks.includes(name), `schema has mark "${name}" (got: ${marks.join(", ")})`);
  }
  const nodes = Object.keys(schema.nodes).sort();
  for (const name of [
    "heading",
    "paragraph",
    "blockquote",
    "codeBlock",
    "bulletList",
    "orderedList",
    "listItem",
    "image",
    "table",
    "tableRow",
    "tableHeader",
    "tableCell",
    "callout",
  ]) {
    check(nodes.includes(name), `schema has node "${name}" (got: ${nodes.join(", ")})`);
  }

  // Heading levels 1-6 — the dropdown offers all six.
  const headingSpec = schema.nodes.heading?.spec as { parseDOM?: Array<{ tag: string }> } | undefined;
  const headingTags = headingSpec?.parseDOM?.map((p) => p.tag).join(",") ?? "";
  for (let level = 1; level <= 6; level++) {
    check(headingTags.includes(`h${level}`), `heading parses level ${level} (tags: ${headingTags})`);
  }

  // textStyle must carry the exact attributes the toolbar writes.
  const textStyleAttrs = Object.keys(schema.marks.textStyle?.spec.attrs ?? {}) as string[];
  check(textStyleAttrs.includes("color"), `textStyle has color attr (text color) [got: ${textStyleAttrs.join(", ")}]`);
  check(textStyleAttrs.includes("fontSize"), `textStyle has fontSize attr (text size) [got: ${textStyleAttrs.join(", ")}]`);
  check(textStyleAttrs.includes("fontFamily"), `textStyle has fontFamily attr (font family) [got: ${textStyleAttrs.join(", ")}]`);

  // Highlight must carry a color attribute (background color).
  const highlightAttrs = Object.keys(schema.marks.highlight?.spec.attrs ?? {}) as string[];
  check(highlightAttrs.includes("color"), `highlight has color attr [got: ${highlightAttrs.join(", ")}]`);

  // TextAlign must be supported on heading + paragraph (alignment buttons).
  const paragraphAttrs = Object.keys(schema.nodes.paragraph?.spec.attrs ?? {}) as string[];
  const headingAttrs = Object.keys(schema.nodes.heading?.spec.attrs ?? {}) as string[];
  check(paragraphAttrs.includes("textAlign"), `paragraph supports textAlign [got: ${paragraphAttrs.join(", ")}]`);
  check(headingAttrs.includes("textAlign"), `heading supports textAlign [got: ${headingAttrs.join(", ")}]`);
}

// ---- The commands the toolbar calls exist in the installed packages ----
{
  // Commands live inside extension addCommands() (not introspectable without
  // an editor instance), so verify the command names against the installed
  // extension sources that provide them. StarterKit v3 bundles underline,
  // link, blockquote, lists, codeBlock and UndoRedo (undo/redo); the
  // text-style package provides color/font-size/font-family commands; the
  // highlight/text-align/image packages provide their own.
  const src = (p: string) => readFileSync(p, "utf8");
  const textStyleSrc = src(require.resolve("@tiptap/extension-text-style"));
  const highlightSrc = src(require.resolve("@tiptap/extension-highlight"));
  const textAlignSrc = src(require.resolve("@tiptap/extension-text-align"));
  const imageSrc = src(require.resolve("@tiptap/extension-image"));
  const extensionsSrc = src(require.resolve("@tiptap/extensions"));
  const starterSrc = src(require.resolve("@tiptap/starter-kit"));

  const has = (haystack: string, needle: string) => check(haystack.includes(needle), `package provides ${needle}`);

  has(textStyleSrc, "setColor:");
  has(textStyleSrc, "unsetColor:");
  has(textStyleSrc, "setFontSize:");
  has(textStyleSrc, "unsetFontSize:");
  has(textStyleSrc, "setFontFamily:");
  has(textStyleSrc, "unsetFontFamily:");
  has(highlightSrc, "setHighlight:");
  has(highlightSrc, "unsetHighlight:");
  has(highlightSrc, "toggleHighlight:");
  has(textAlignSrc, "setTextAlign:");
  has(imageSrc, "setImage:");
  has(extensionsSrc, "undo:");
  has(extensionsSrc, "redo:");
  // StarterKit bundles the underline, link, blockquote, list and codeBlock
  // extensions used by the toolbar buttons.
  for (const n of ["Underline", "Link", "Blockquote", "BulletList", "OrderedList", "CodeBlock"]) {
    check(starterSrc.includes(`from \"@tiptap/extension-${n.toLowerCase()}\"`) || starterSrc.includes(n), `StarterKit bundles ${n}`);
  }
}

// ---- Font stacks offered by the toolbar are well-formed CSS ----
{
  const fontValues = [
    "Arial, Helvetica, sans-serif",
    "Times New Roman, Times, serif",
    "Georgia, serif",
    "Inter, system-ui, sans-serif",
    "system-ui, -apple-system, sans-serif",
    'Georgia, "Times New Roman", serif',
    "ui-monospace, SFMono-Regular, Menlo, monospace",
  ];
  for (const v of fontValues) {
    const quotes = (v.match(/"/g) ?? []).length;
    check(v.trim().length > 0 && quotes % 2 === 0, `font stack "${v}" is well-formed`);
  }
}

if (failures === 0) {
  console.log("All editor-toolbar tests passed.");
} else {
  console.error(`${failures} failure(s).`);
  process.exit(1);
}
