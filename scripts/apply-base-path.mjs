import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SENTINEL = "/__AFFIRM_BASE_PATH__";
const LOCALHOST_BASE = "/weng/app/sp/affirmations/out";
const DEFAULT_BASE = "/app/sp/affirmations/out";
const BOOTSTRAP_MARK = "affirm-static-base-path";

const EXPR = `((typeof location!=="undefined"&&String(location.href).includes("localhost"))?${JSON.stringify(LOCALHOST_BASE)}:${JSON.stringify(DEFAULT_BASE)})`;

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function patchJavaScript(source) {
  if (!source.includes(SENTINEL)) return source;
  return source.split(SENTINEL).join(`"+${EXPR}+"`);
}

function wrapHtml(source) {
  if (source.includes(BOOTSTRAP_MARK)) return source;
  if (!source.includes(SENTINEL)) return source;
  const payload = JSON.stringify(source).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Affirmation Lab</title>
<script data-${BOOTSTRAP_MARK}="1">
(function () {
  var base = String(location.href).includes("localhost")
    ? ${JSON.stringify(LOCALHOST_BASE)}
    : ${JSON.stringify(DEFAULT_BASE)};
  var html = ${payload}.split(${JSON.stringify(SENTINEL)}).join(base);
  html = html.split("/favicon.svg").join(base + "/favicon.svg");
  document.open();
  document.write(html);
  document.close();
})();
</script>
</head>
<body></body>
</html>
`;
}

function patchCss(source) {
  if (!source.includes(SENTINEL)) return source;
  return source.split(SENTINEL).join(DEFAULT_BASE);
}

const files = await walk(outDir);
let patched = 0;

for (const file of files) {
  const ext = path.extname(file);
  const original = await readFile(file, "utf8");
  if (!original.includes(SENTINEL) && !original.includes(BOOTSTRAP_MARK)) continue;

  let next = original;
  if (ext === ".html") {
    next = wrapHtml(original);
  } else if (ext === ".js" || ext === ".mjs" || ext === ".css") {
    next = ext === ".css" ? patchCss(original) : patchJavaScript(original);
  }

  if (next !== original) {
    await writeFile(file, next);
    patched += 1;
  }
}

if (patched === 0) {
  console.warn("apply-base-path: no sentinel found in out/. Was next.config basePath set for production?");
  process.exitCode = 1;
} else {
  console.log(`apply-base-path: patched ${patched} file(s) in out/`);
}
