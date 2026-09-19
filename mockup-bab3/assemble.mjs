// Merakit setiap body/<Nama>.html menjadi artboard <Nama>.dc.html
// dengan menyisipkan kit gaya bersama (_style.part).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const style = readFileSync("_style.part", "utf8").trimEnd();
const bodies = readdirSync("body").filter((f) => f.endsWith(".html")).sort();

for (const f of bodies) {
  const name = f.replace(/\.html$/, "");
  const body = readFileSync(join("body", f), "utf8").trimEnd();
  const out = [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8">',
    '  <script src="./support.js"></script>',
    "</head>",
    "<body>",
    "<x-dc>",
    style,
    body,
    "</x-dc>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
  writeFileSync(`${name}.dc.html`, out);
  console.log(`  ${name}.dc.html  ${(out.length / 1024).toFixed(1)} KB`);
}
