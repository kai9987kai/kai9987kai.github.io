const fs = require('fs');
const html = fs.readFileSync('C:/Users/kai99/Desktop/asd/ai_studio_code.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  try {
    const vm = require('vm');
    new vm.Script(scriptMatch[1]);
    console.log("Syntax OK");
  } catch(e) {
    console.error("Syntax Error:", e);
  }
} else {
  console.log("No script found");
}
