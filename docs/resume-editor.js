// Drafts are isolated from the active resume until the user explicitly saves them.
const RESUME_EDITOR_KEY = "proof-resume-editor",
  RESUME_VERSION_KEY = "proof-resume-versions";
function resumeEditorRead() {
  try {
    return JSON.parse(workspaceLocal.getItem(RESUME_EDITOR_KEY) || "null");
  } catch {
    return null;
  }
}
function resumeEditorWrite(state) {
  state.updatedAt = new Date().toISOString();
  workspaceLocal.setItem(RESUME_EDITOR_KEY, JSON.stringify(state));
}
function resumeEditorPrompts(text) {
  const tokens = String(text).match(/\[[^\]\n]+\]/g) || [];
  return tokens.filter(
    (token) =>
      /\b(your|verified|add|replace|actual|specific|describe|intended|verify)\b/i.test(
        token,
      ) ||
      /^\[(?:x|y|z|project|work sample|city|professional email|portfolio|real |what |audience|scope|metric|number|name|company|employer|role|date|result|tool|skill|impact|contribution|outcome|context|dataset|finding|decision|lesson|link)(?:\b|\s|\/)/i.test(
        token,
      ) ||
      /^\[[0-9.]+%\]$/.test(token),
  );
}

function resumeEditorEnsure(report) {
  const original = marketplaceResume(),
    context = JSON.stringify({
      targetRole: report.targetRole || "",
      listingId: report.listingId || null,
      source: report.source || "",
      rewrites: report.rewrites || [],
      summary: report.summary || "",
    }),
    current = resumeEditorRead();
  if (
    current &&
    current.original === original &&
    current.context === context &&
    Array.isArray(current.edits)
  )
    return current;
  if (current?.draft && current.draft !== current.original)
    resumeEditorVersion(
      current.draft,
      "Automatic backup before a new review",
      "backup",
    );
  const edits = resumeEditSuggestions(report).map((s, i) => ({
    ...s,
    id: "edit-" + i,
    proposed: s.draft,
    status: "pending",
  }));
  const state = {
    id: "draft-" + Date.now().toString(36),
    context,
    original,
    draft: original,
    edits,
    actions: [],
    view: "edit",
    createdAt: new Date().toISOString(),
  };
  resumeEditorWrite(state);
  return state;
}
function resumeEditorVersions() {
  try {
    const list = JSON.parse(workspaceLocal.getItem(RESUME_VERSION_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
function resumeEditorVersion(text, label, kind = "draft") {
  const versions = resumeEditorVersions();
  const version = {
    id:
      "version-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7),
    label: String(label || "Resume draft").slice(0, 100),
    text,
    kind,
    savedAt: new Date().toISOString(),
  };
  workspaceLocal.setItem(
    RESUME_VERSION_KEY,
    JSON.stringify([version, ...versions]),
  );
  return version;
}
function resumeEditorNotice(message, error = false) {
  const node = document.getElementById("resume-editor-feedback");
  if (node) {
    node.textContent = message;
    node.className = error ? "review-error" : "resume-hint";
  } else if (typeof toast === "function") toast(message);
}
function updateResumeEditorText(text) {
  const state = resumeEditorRead();
  if (!state) return;
  state.draft = String(text).slice(0, 30000);
  resumeEditorWrite(state);
  const status = document.getElementById("editor-draft-status");
  if (status) status.textContent = resumeEditorStatus(state);
  const preview = document.getElementById("editor-live-preview");
  if (preview) preview.textContent = state.draft;
}
function updateResumeProposal(id, text) {
  const state = resumeEditorRead(),
    edit = state?.edits.find((x) => x.id === id);
  if (!edit || edit.status !== "pending") return;
  edit.proposed = String(text).slice(0, 6000);
  resumeEditorWrite(state);
}
function acceptResumeEdit(id) {
  const state = resumeEditorRead(),
    edit = state?.edits.find((x) => x.id === id);
  if (!edit || edit.status !== "pending") return false;
  const proposed = edit.proposed.trim();
  if (!proposed || resumeEditorPrompts(proposed).length) {
    resumeEditorNotice(
      "Fill in the bracketed prompts with your real details before accepting this edit.",
      true,
    );
    return false;
  }
  if (edit.before && !state.draft.includes(edit.before)) {
    resumeEditorNotice(
      "This original line has changed. Edit the draft directly or reject this suggestion.",
      true,
    );
    return false;
  }
  const next = edit.before
    ? state.draft.replace(edit.before, proposed)
    : state.draft.trimEnd() + "\n\n" + proposed;
  if (next.length > 30000) {
    resumeEditorNotice("Keep the resume under 30,000 characters.", true);
    return false;
  }
  state.actions.push({ editId: id, before: state.draft, after: next });
  state.draft = next;
  edit.status = "accepted";
  resumeEditorWrite(state);
  paintResumeEditor();
  resumeEditorNotice(
    "Edit accepted into your draft. Your active resume is unchanged.",
  );
  return true;
}
function rejectResumeEdit(id) {
  const state = resumeEditorRead(),
    edit = state?.edits.find((x) => x.id === id);
  if (!edit || edit.status !== "pending") return;
  edit.status = "rejected";
  resumeEditorWrite(state);
  paintResumeEditor();
}
function undoResumeEdit() {
  const state = resumeEditorRead(),
    last = state?.actions.at(-1);
  if (!last) return;
  if (state.draft !== last.after) {
    resumeEditorNotice(
      "You edited the draft after this change. Use Compare to review and change the text safely.",
      true,
    );
    return;
  }
  state.draft = last.before;
  const edit = state.edits.find((x) => x.id === last.editId);
  if (edit) edit.status = "pending";
  state.actions.pop();
  resumeEditorWrite(state);
  paintResumeEditor();
}
function resumeEditorStatus(state) {
  const accepted = state.edits.filter((e) => e.status === "accepted").length,
    prompts = resumeEditorPrompts(state.draft).length;
  return `${accepted} accepted · ${state.edits.filter((e) => e.status === "pending").length} pending · ${prompts ? prompts + " prompts need details" : "No unresolved prompts"}`;
}
function setResumeEditorView(view) {
  const state = resumeEditorRead();
  if (!state) return;
  state.view = ["edit", "compare", "versions"].includes(view) ? view : "edit";
  resumeEditorWrite(state);
  paintResumeEditor();
}
function paintResumeEditor() {
  const node = document.getElementById("resume-editor-root"),
    state = resumeEditorRead();
  if (node && state) node.innerHTML = resumeEditorBody(state);
}
function resumeEditorHTML(report) {
  if (resumeReportTab !== "improve")
    return '<section id="resume-editor-root"></section>';
  const state = resumeEditorEnsure(report);
  return `<section id="resume-editor-root">${resumeEditorBody(state)}</section>`;
}
function resumeEditorBody(state) {
  const accepted = state.edits.filter((e) => e.status === "accepted").length;
  return `<div class="resume-editor-heading"><div><span class="section-label">RESUME WORKSPACE</span><h2>Turn feedback into your next version</h2><p>Edit a suggestion, accept or reject it, then compare and export your draft.</p></div><span class="editor-private-label">${icon("lock", 14)} Private draft</span></div><div class="resume-editor-toolbar"><div class="resume-editor-views" role="group" aria-label="Resume draft view">${[
    ["edit", "Edit draft"],
    ["compare", "Compare"],
    ["versions", "Saved versions"],
  ]
    .map(
      ([v, t]) =>
        `<button class="${state.view === v ? "active" : ""}" aria-pressed="${state.view === v}" onclick="setResumeEditorView('${v}')">${t}</button>`,
    )
    .join(
      "",
    )}</div><div><button class="text-control" ${state.actions.length ? "" : "disabled"} onclick="undoResumeEdit()">${icon("back", 14)} Undo last edit</button><label class="sr-only" for="resume-version-name">Version name</label><input id="resume-version-name" maxlength="100" placeholder="Name this version"><button class="outline" onclick="saveResumeEditorVersion()">Save version</button></div></div><p id="resume-editor-feedback" role="status" class="resume-hint"></p>${state.view === "edit" ? `<div class="resume-editing-layout"><section class="editor-suggestions" aria-label="Suggested resume changes"><div class="editor-column-title"><h3>Suggested changes</h3><span>${accepted}/${state.edits.length} accepted</span></div>${state.edits.map((edit) => `<article class="editor-suggestion ${edit.status}"><div><span class="editor-edit-status">${edit.status === "pending" ? "FOR REVIEW" : edit.status.toUpperCase()}</span><h4>${esc(edit.title)}</h4></div>${edit.before ? `<details class="editor-source-line"><summary>Original line</summary><p>${esc(edit.before)}</p></details>` : ""}<p>${esc(edit.why)}</p>${edit.status === "pending" ? `<label class="field">Edit this suggestion<textarea aria-label="Draft wording for ${esc(edit.title)}" maxlength="6000" oninput="updateResumeProposal('${edit.id}',this.value)">${esc(edit.proposed)}</textarea></label><div class="editor-edit-actions"><button class="primary" onclick="acceptResumeEdit('${edit.id}')">${icon("check", 14)} Accept edit</button><button class="outline" onclick="rejectResumeEdit('${edit.id}')">Reject</button></div>` : `<p class="editor-completed-change">${esc(edit.proposed)}</p>`}</article>`).join("")}</section><section class="editor-document"><div class="editor-column-title"><h3>Your draft</h3><span>Editable text</span></div><label class="sr-only" for="resume-draft-text">Editable resume draft</label><textarea id="resume-draft-text" maxlength="30000" spellcheck="true" oninput="updateResumeEditorText(this.value)">${esc(state.draft)}</textarea><small>Accepting suggestions changes this draft. Save as active resume when you are ready.</small></section></div>` : state.view === "compare" ? resumeCompareHTML(state) : resumeEditorVersionsHTML()}<div class="resume-editor-footer"><div><b id="editor-draft-status">${resumeEditorStatus(state)}</b><span>The original reviewed text stays available in Compare.</span></div><div class="editor-export-actions"><details class="editor-export-menu"><summary>Export draft ${icon("arrow", 14)}</summary><div><button onclick="exportResumeDraft('docx')">Word document (.docx)</button><button onclick="exportResumeDraft('txt')">Plain text (.txt)</button><button onclick="printResumeDraft()">Print / Save as PDF</button></div></details><button class="primary" onclick="saveResumeEditorAsActive()">Use as active resume ${icon("arrow", 15)}</button></div></div>`;
}
function resumeDiffLines(original, draft) {
  const a = String(original).split("\n"),
    b = String(draft).split("\n");
  if (a.length * b.length > 180000) {
    return {
      original: a.map((text) => ({
        text,
        state: b.includes(text) ? "same" : "removed",
      })),
      draft: b.map((text) => ({
        text,
        state: a.includes(text) ? "same" : "added",
      })),
    };
  }
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0,
    j = 0;
  const left = [],
    right = [];
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      left.push({ text: a[i++], state: "same" });
      right.push({ text: b[j++], state: "same" });
    } else if (j >= b.length || (i < a.length && dp[i + 1][j] >= dp[i][j + 1]))
      left.push({ text: a[i++], state: "removed" });
    else right.push({ text: b[j++], state: "added" });
  }
  return { original: left, draft: right };
}
function resumeCompareHTML(state) {
  const diff = resumeDiffLines(state.original, state.draft),
    lines = (items) =>
      items
        .map(
          (x) =>
            `<div class="resume-diff-line ${x.state}"><span aria-hidden="true">${x.state === "added" ? "+" : x.state === "removed" ? "−" : " "}</span><span>${esc(x.text) || "&nbsp;"}</span></div>`,
        )
        .join("");
  return `<div class="resume-compare-legend"><span><i class="diff-key-removed"></i>Original text removed or changed</span><span><i class="diff-key-added"></i>Text added to draft</span></div><div class="resume-comparison"><section><h3>Original reviewed resume</h3><div class="resume-diff-document" tabindex="0">${lines(diff.original)}</div></section><section><h3>Current draft</h3><div class="resume-diff-document" tabindex="0">${lines(diff.draft)}</div></section></div>`;
}
function resumeEditorVersionsHTML() {
  const versions = resumeEditorVersions().filter(
    (v) => typeof v.text === "string",
  );
  return `<section class="resume-version-list"><div class="editor-column-title"><h3>Saved versions</h3><span>${versions.length} versions</span></div>${versions.map((v) => `<article><div><h4>${esc(v.label)}</h4><small>${new Date(v.savedAt).toLocaleString()} · ${v.text.trim().split(/\s+/).length} words</small></div><button class="outline" data-version-id="${esc(v.id)}" onclick="loadResumeEditorVersion(this.dataset.versionId)">Load into draft</button></article>`).join("") || '<div class="editor-empty-versions"><h3>Keep a version for each opportunity</h3><p>Save a named version before you make further changes. Loading it will not replace your active resume.</p></div>'}</section>`;
}
async function saveResumeEditorVersion() {
  const state = resumeEditorRead();
  if (!state) return;
  const label =
    document.getElementById("resume-version-name")?.value.trim() ||
    (typeof resumeReport !== "undefined" && resumeReport?.targetRole
      ? resumeReport.targetRole
      : "Resume") +
      " · " +
      new Date().toLocaleDateString();
  const owner = typeof Account !== "undefined" ? Account.user?.id : null;
  resumeEditorVersion(state.draft, label);
  paintResumeEditor();
  resumeEditorNotice("Saving version…");
  try {
    if (typeof saveWorkspace === "function") await saveWorkspace();
    if (typeof Account !== "undefined" && Account.user?.id !== owner) return;
    resumeEditorNotice(
      "Version saved to your account. Unfinished prompts can stay in saved drafts.",
    );
  } catch {}
}
function loadResumeEditorVersion(id) {
  const state = resumeEditorRead(),
    version = resumeEditorVersions().find((v) => v.id === id);
  if (!state || !version || typeof version.text !== "string") return;
  if (state.draft !== version.text)
    resumeEditorVersion(
      state.draft,
      "Automatic backup before loading a version",
      "backup",
    );
  state.draft = version.text;
  state.edits.forEach(
    (edit) =>
      (edit.status =
        state.draft.includes(edit.proposed) && edit.proposed.trim()
          ? "accepted"
          : "pending"),
  );
  state.actions = [];
  state.view = "compare";
  resumeEditorWrite(state);
  paintResumeEditor();
  resumeEditorNotice(
    "Version loaded into your draft. Your active resume is unchanged.",
  );
}
async function saveResumeEditorAsActive() {
  const state = resumeEditorRead();
  if (!state) return false;
  if (state.draft.trim().length < 100) {
    resumeEditorNotice(
      "Add at least 100 characters before saving your active resume.",
      true,
    );
    return false;
  }
  if (resumeEditorPrompts(state.draft).length) {
    resumeEditorNotice(
      "Replace every bracketed prompt with your real details before saving or exporting.",
      true,
    );
    return false;
  }
  const owner = typeof Account !== "undefined" ? Account.user?.id : null;
  resumeEditorVersion(
    state.original,
    "Original before resume edits",
    "original",
  );
  resumeEditorVersion(state.draft, "Updated active resume", "active");
  setMarketplaceResume(state.draft);
  const file = typeof savedResumeFile === "function" ? savedResumeFile() : null;
  if (file)
    workspaceLocal.setItem(
      "proof-resume-file",
      JSON.stringify({ ...file, textEdited: true }),
    );
  state.activeSavedAt = new Date().toISOString();
  resumeEditorWrite(state);
  try {
    if (typeof saveWorkspace === "function") await saveWorkspace();
    if (typeof Account !== "undefined" && Account.user?.id !== owner)
      return false;
    location.hash = "resume";
    if (typeof render === "function") render();
    if (typeof toast === "function")
      toast("Updated resume saved. Review it again to assess your changes.");
    return true;
  } catch {
    return false;
  }
}
function resumeExportReady() {
  const state = resumeEditorRead();
  if (!state || !state.draft.trim()) {
    resumeEditorNotice("Add resume content before exporting.", true);
    return null;
  }
  if (resumeEditorPrompts(state.draft).length) {
    resumeEditorNotice(
      "Replace every bracketed prompt with your real details before exporting.",
      true,
    );
    return null;
  }
  return state.draft;
}
function exportResumeDraft(format) {
  const text = resumeExportReady();
  if (text === null) return;
  const docx = format === "docx",
    blob = docx
      ? new Blob([createResumeDocx(text)], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      : new Blob([text], { type: "text/plain;charset=utf-8" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "nextwork-resume." + (docx ? "docx" : "txt");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function createResumeDocx(text) {
  const xml = (s) =>
    String(s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
          })[c],
      );
  const paragraphs = String(text)
    .split("\n")
    .map(
      (line, i) =>
        `<w:p><w:pPr>${i === 0 ? '<w:pStyle w:val="Title"/>' : /^[A-Z][A-Z &/]{2,40}$/.test(line) ? '<w:pStyle w:val="Heading1"/>' : ""}<w:spacing w:after="100"/></w:pPr><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`,
    )
    .join("");
  const files = {
    "[Content_Types].xml":
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    "_rels/.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/_rels/document.xml.rels":
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/styles.xml":
      '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>',
    "word/document.xml":
      '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      paragraphs +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr></w:body></w:document>',
  };
  return resumeZip(files);
}
function resumeZip(files) {
  const encode = new TextEncoder(),
    chunks = [],
    central = [];
  let offset = 0;
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c ^= byte;
      for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const header = (size, signature) => {
    const a = new Uint8Array(size);
    new DataView(a.buffer).setUint32(0, signature, true);
    return a;
  };
  for (const [path, value] of Object.entries(files)) {
    const name = encode.encode(path),
      data = encode.encode(value),
      sum = crc(data),
      local = header(30, 0x04034b50),
      lv = new DataView(local.buffer);
    lv.setUint16(4, 20, true);
    lv.setUint16(12, 33, true);
    lv.setUint32(14, sum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    chunks.push(local, name, data);
    const entry = header(46, 0x02014b50),
      ev = new DataView(entry.buffer);
    ev.setUint16(4, 20, true);
    ev.setUint16(6, 20, true);
    ev.setUint16(14, 33, true);
    ev.setUint32(16, sum, true);
    ev.setUint32(20, data.length, true);
    ev.setUint32(24, data.length, true);
    ev.setUint16(28, name.length, true);
    ev.setUint32(42, offset, true);
    central.push(entry, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = central.reduce((n, a) => n + a.length, 0),
    end = header(22, 0x06054b50),
    v = new DataView(end.buffer);
  v.setUint16(8, Object.keys(files).length, true);
  v.setUint16(10, Object.keys(files).length, true);
  v.setUint32(12, centralSize, true);
  v.setUint32(16, offset, true);
  const all = [...chunks, ...central, end],
    out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let at = 0;
  for (const a of all) {
    out.set(a, at);
    at += a.length;
  }
  return out;
}
function printResumeDraft() {
  const text = resumeExportReady();
  if (text === null) return;
  const frame = document.createElement("iframe");
  frame.title = "Printable resume";
  frame.className = "resume-print-frame";
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(
    '<!doctype html><html><head><meta charset="UTF-8"><title>Nextwork resume</title><style>@page{size:A4;margin:18mm}body{font:11pt/1.5 Arial,sans-serif;color:#111}h1{font-size:20pt;margin:0 0 12pt}p{white-space:pre-wrap;margin:0 0 5pt;overflow-wrap:anywhere}h2{font-size:12pt;border-bottom:1px solid #ccc;margin:15pt 0 7pt}</style></head><body>' +
      text
        .split("\n")
        .map((line, i) =>
          i === 0
            ? "<h1>" + esc(line) + "</h1>"
            : /^[A-Z][A-Z &/]{2,40}$/.test(line)
              ? "<h2>" + esc(line) + "</h2>"
              : "<p>" + esc(line) + "</p>",
        )
        .join("") +
      "</body></html>",
  );
  doc.close();
  frame.contentWindow.addEventListener("afterprint", () => frame.remove(), {
    once: true,
  });
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 100);
}
