import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { tokenize } from "../src/lexer.js";

const samples = process.argv.slice(2);
if (samples.length === 0) throw new Error("Pass one or more .ever source files");
for (const file of samples) {
  const source = readFileSync(file,"utf8");
  const measurements:number[]=[];
  for(let i=0;i<30;i++){
    const start=performance.now();
    tokenize(source);
    measurements.push(performance.now()-start);
  }
  measurements.sort((a,b)=>a-b);
  const median=measurements[Math.floor(measurements.length/2)];
  console.log(JSON.stringify({file,bytes:Buffer.byteLength(source),iterations:30,medianLexerMs:median}));
}
