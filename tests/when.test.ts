import { test } from "node:test";
import assert from "node:assert/strict";
import { monthOf, timeOfDayOf } from "../src/lib/when.ts";

test("monthOf uses the date in India", () => {
  assert.equal(monthOf("2026-11-14T07:42:00+05:30"), "November");
  // 31 Oct 20:00 UTC is already 1 Nov in India.
  assert.equal(monthOf("2026-10-31T20:00:00Z"), "November");
});

test("timeOfDayOf follows the hour in India", () => {
  const at = (hhmm: string) => timeOfDayOf(`2026-11-14T${hhmm}:00+05:30`);
  assert.equal(at("04:59"), "Night");
  assert.equal(at("05:00"), "Dawn");
  assert.equal(at("06:59"), "Dawn");
  assert.equal(at("07:00"), "Morning");
  assert.equal(at("11:00"), "Midday");
  assert.equal(at("14:00"), "Afternoon");
  assert.equal(at("17:30"), "Dusk");
  assert.equal(at("19:00"), "Night");
  assert.equal(at("00:15"), "Night");
});
