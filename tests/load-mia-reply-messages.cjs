const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const loaded = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mia-reply-messages.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:loaded,exports:loaded.exports});
module.exports = loaded.exports;
