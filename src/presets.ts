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
  {
    id: "promise-vs-timeout",
    label: "Promise vs timeout",
    code: `console.log("s1");
setTimeout(() => console.log("macro"), 0);
Promise.resolve().then(() => console.log("micro"));
console.log("s2");
`,
  },
  {
    id: "micro-in-macro",
    label: "Micro inside macro",
    code: `setTimeout(() => {
  console.log("macro-start");
  Promise.resolve().then(() => console.log("micro-in-macro"));
  console.log("macro-end");
}, 0);
Promise.resolve().then(() => console.log("micro-first"));
`,
  },
  {
    id: "queue-microtask",
    label: "queueMicrotask",
    code: `queueMicrotask(() => console.log("q"));
Promise.resolve().then(() => console.log("p"));
setTimeout(() => console.log("macro"), 0);
console.log("s");
`,
  },
];

export const DEFAULT_CODE = PRESETS[0]!.code;
