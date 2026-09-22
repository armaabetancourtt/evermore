import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";

const source = String.raw`
app "Evermore Showcase"

component Navigation

  stack horizontal

    button "Home"
      opens Home

    button "Counter"
      opens Counter

    button "About"
      opens About

  end

end

screen Home
  title "Build software like you think."
  use Navigation

screen Counter
  title "State without ceremony"
  state count starts 0
  show count
  button "Add"
    increases count
  use Navigation

screen About
  title "Designed to endure"
  use Navigation
`;

test("M1 showcase compiles three screens with shared components and state", () => {
  const result = compile(source);

  const screens = result.files.filter((file) =>
    file.path.startsWith("src/generated/screens/"),
  );

  assert.equal(screens.length, 3);

  const counter = screens.find((file) =>
    file.path.endsWith("CounterScreen.vue"),
  );

  assert.ok(counter);
  assert.match(counter.content, /const state_count = ref\(0\);/);
  assert.match(counter.content, />Add</);
  assert.match(counter.content, />Home</);
  assert.match(counter.content, />About</);
});
