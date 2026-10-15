// Build the landing page into ONE self-contained HTML file:
//   dist-showcase/sundown-showcase.html
// (no <html>/<head>/<body> wrapper; the JS and CSS are inlined).
// Usage: node scripts/build-showcase.mjs
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

execSync("npx vite build --config vite.showcase.config.ts", { stdio: "inherit" });

const dir = "dist-showcase/assets";
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
let css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

// The fonts come in through a <link>; drop any @import of the same sheet.
css = css.replace(/@import\s+url\([^)]*fonts\.googleapis[^)]*\)\s*;?/g, "");
const safeJs = js.replace(/<\/script/gi, "<\\/script");

const html = `<title>Sundown</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${safeJs}
</script>
`;
writeFileSync("dist-showcase/sundown-showcase.html", html);
console.log(`wrote dist-showcase/sundown-showcase.html (${(html.length / 1024).toFixed(0)} KB)`);
