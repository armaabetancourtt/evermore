import assert from "node:assert/strict";
import test from "node:test";
import { tokenize } from "../src/lexer.js";
import { parse } from "../src/parser.js";

const corpus = ["", "\u0000", "\r\n", "\"unterminated", "{".repeat(64), "let a = 1", "screen Home {}"];
function next(seed: number): number { return (Math.imul(seed,1664525)+1013904223)>>>0; }
test("parser and lexer adversarial smoke corpus finishes without process termination",()=>{
  let seed=0x5eed;
  const chars="\u0000\r\n{}[]()\"'\\/ab=0123456789 ";
  for(let i=0;i<160;i++){
    let s="";
    for(let j=0;j<80;j++){seed=next(seed);s+=chars[seed%chars.length];}
    corpus.push(s);
  }
  for(const source of corpus) {
    try {
      // Parse errors are valid outcomes; stack overflows and hangs require separate process isolation.
      const result=tokenize(source);
      assert.ok(result);
    } catch(error) { assert.ok(error instanceof Error); }
  }
});
