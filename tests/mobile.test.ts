import assert from "node:assert/strict";
import test from "node:test";

import { compile } from "../src/compiler.js";
import { EvermoreDiagnosticError } from "../src/diagnostics.js";
import { formatSource } from "../src/formatter.js";
import { parse } from "../src/parser.js";

const source = String.raw`
app "Mobile"

mobile ProductMobile
  storage "secure"
  permission "camera"
  permission "notifications"
  network "offline-first"
  native "swift"
  native "kotlin"
end

screen Home
  state count starts 0
  title "Home"
  show count
  button "Next"
    opens Details
end

screen Details
  title "Details"
  button "Back"
    opens Home
end
`;

test("parses mobile policy without duplicating screen semantics", () => {
  console.error("MOBILE_DEBUG_1_START");
  const program = parse(source);
  const mobile = program.mobiles[0];

  assert.equal(mobile?.storage, "secure");
  assert.equal(mobile?.network, "offline-first");
  assert.deepEqual(mobile?.permissions, ["camera", "notifications"]);
  assert.deepEqual(mobile?.nativeExtensions, ["swift", "kotlin"]);
  assert.equal(program.screens.length, 2);
});

test("formatter preserves mobile platform policy", () => {
  console.error("MOBILE_DEBUG_2_START");
  const formatted = formatSource(source);

  assert.match(formatted, /mobile ProductMobile/);
  assert.match(formatted, /storage "secure"/);
  assert.match(formatted, /permission "camera"/);
  assert.match(formatted, /network "offline-first"/);
  assert.match(formatted, /native "swift"/);
  assert.match(formatted, /native "kotlin"/);
});

test("react-native target emits navigation runtime and native boundaries", () => {
  console.error("MOBILE_DEBUG_3_START");
  const result = compile(source, { target: "react-native" });
  const paths = new Set(result.files.map((file) => file.path));
  const app = result.files.find((file) => file.path === "src/App.tsx")!;
  const runtime = result.files.find(
    (file) => file.path === "src/generated/mobile-runtime.ts",
  )!;

  for (const required of [
    "src/App.tsx",
    "src/generated/screens.tsx",
    "src/generated/mobile-runtime.ts",
    "ios/EvermoreNativeBridge.swift",
    "android/EvermoreNativeBridge.kt",
  ]) {
    assert.ok(paths.has(required), "missing " + required);
  }

  assert.match(app.content, /setScreen/);
  assert.match(runtime.content, /evermoreRequestPermission/);
  assert.match(runtime.content, /evermoreFlushNetworkQueue/);
  assert.match(runtime.content, /EvermoreNativeStorage/);
});

test("flutter target reuses the same screens and mobile policy", () => {
  console.error("MOBILE_DEBUG_4_START");
  const result = compile(source, { target: "flutter" });
  const main = result.files.find((file) => file.path === "lib/main.dart")!;
  const manifest = result.files.find(
    (file) => file.path === "evermore.mobile.json",
  )!;

  assert.match(main.content, /MaterialApp/);
  assert.match(main.content, /HomeScreen/);
  assert.match(main.content, /DetailsScreen/);
  assert.match(manifest.content, /flutter-experiment/);
});

test("mobile permissions cannot be duplicated", () => {
  console.error("MOBILE_DEBUG_5_START");
  const invalid = String.raw`
app "Broken"

mobile App
  permission "camera"
  permission "camera"
end

screen Home
  title "Home"
`;

  assert.throws(
    () => compile(invalid, { target: "vue" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2901"),
      );
      return true;
    },
  );
});

test("mobile declarations require a shared screen surface", () => {
  console.error("MOBILE_DEBUG_6_START");
  const invalid = String.raw`
app "Broken"

mobile App
  storage "memory"
end
`;

  assert.throws(
    () => compile(invalid, { target: "vue" }),
    (error: unknown) => {
      assert.ok(error instanceof EvermoreDiagnosticError);
      assert.ok(
        error.diagnostics.some((diagnostic) => diagnostic.code === "E2903"),
      );
      return true;
    },
  );
});
