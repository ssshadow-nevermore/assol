import assert from "node:assert/strict";
import test from "node:test";

const { validateWorkingHoursInput } = await import("../app/api/admin/working-hours-validation.ts");

test("working hours reject backwards and equal same-day intervals", () => {
  assert.throws(() => validateWorkingHoursInput({ is_closed: 0, opens_at: "20:00", closes_at: "09:00" }), /раньше/);
  assert.throws(() => validateWorkingHoursInput({ is_closed: 0, opens_at: "09:00", closes_at: "09:00" }), /раньше/);
});

test("working hours accept a valid interval and closed days", () => {
  assert.doesNotThrow(() => validateWorkingHoursInput({ is_closed: 0, opens_at: "09:00", closes_at: "19:00" }));
  assert.doesNotThrow(() => validateWorkingHoursInput({ is_closed: 1, opens_at: null, closes_at: null }));
});
