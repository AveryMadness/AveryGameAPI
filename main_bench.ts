import { add } from "./main.ts";

Deno.bench(function addSmall() {
  console.log("Add 1 + 2 =", add(1, 2));
});

Deno.bench(function addBig() {
  console.log("Add 2 ** 32 + 2 ** 32 =",  add(2 ** 32, 2 ** 32));
});
