export type Preset = {
  id: string;
  label: string;
  code: string;
};

export const PRESETS: Preset[] = [
  {
    id: "loupe",
    label: "Loupe-style",
    code: `console.log("Start");
setTimeout(function () {
  console.log("Timeout 1");

  setTimeout(function () {
    console.log("Nested Timeout");
  }, 0);
}, 0);

setTimeout(function () {
  console.log("Timeout 2");
}, 0);

function test() {
  console.log("Inside test");

  setTimeout(function () {
    console.log("Timeout 3");
  }, 0);

  console.log("test finished");
}

test();

console.log("End");
`,
  },
  {
    id: "basic-timeout",
    label: "Timeout 0",
    code: `console.log("A");
setTimeout(() => console.log("B"), 0);
console.log("C");
`,
  },
  {
    id: "nested",
    label: "Nested timeout",
    code: `setTimeout(function () {
  console.log("outer");
  setTimeout(function () {
    console.log("inner");
  }, 0);
}, 0);
console.log("sync");
`,
  },
];

export const DEFAULT_CODE = PRESETS[0]!.code;
