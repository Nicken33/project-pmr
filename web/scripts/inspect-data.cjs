const fs = require("fs");
const s = fs.readFileSync("src/lib/data.ts", "utf8");
const re = /slug: "([^"]+)"/g;
let m;
const arr = [];
while ((m = re.exec(s))) arr.push(m[1]);
console.log(arr.join("\n"));
