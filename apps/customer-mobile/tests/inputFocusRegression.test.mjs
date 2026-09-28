import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inputSourceUrl = new URL(
  "../src/components/common/Input.tsx",
  import.meta.url,
);

test("Input does not restyle its wrapper during focus on React Native New Architecture", async () => {
  const source = await readFile(inputSourceUrl, "utf8");

  assert.doesNotMatch(
    source,
    /isFocused\s*&&\s*styles\.focused/,
    "Changing a TextInput wrapper style from onFocus can immediately dismiss the iOS keyboard",
  );
  assert.doesNotMatch(
    source,
    /setIsFocused\s*\(/,
    "Input focus must not trigger a wrapper rerender that drops the native keyboard",
  );
  assert.match(
    source,
    /input:\s*\{[^}]*alignSelf:\s*["']stretch["']/s,
    "The native TextInput should fill the wrapper so the whole visible field remains tappable",
  );
});
