/**
 * Apex result handling. Run with Node 24: `pnpm --filter @homeroom/app test`.
 *
 * The theme of these is that every ambiguous input must come out as a failure.
 * `sf apex run test --json` isn't a documented contract, so the parser is
 * written to be wrong safely, and these tests are what say so out loud: a
 * payload we can't read, an outcome we don't recognise, a test that never ran,
 * all land on "not a pass". The one thing that must never happen is a green
 * result nobody earned — it would set a PROVEN state, seed a recall schedule
 * and unlock the worked solution off nothing.
 */

import assert from "node:assert";
import test from "node:test";

import {
  apexProjectFiles,
  classNameOf,
  deployFailureMessage,
  parseApexTestOutput,
  testClassNames,
} from "./apex.ts";

/** The shape the CLI is understood to return. */
function payload(tests) {
  return JSON.stringify({
    status: 0,
    result: {
      summary: { outcome: "Passed", testsRan: tests.length, failing: 0 },
      tests,
    },
  });
}

function row(overrides = {}) {
  return {
    Id: "07M000000000001",
    MethodName: "bulkifiesInsert",
    Outcome: "Pass",
    Message: null,
    StackTrace: null,
    ApexClass: { Id: "01p000000000001", Name: "BulkInsertTest" },
    FullName: "BulkInsertTest.bulkifiesInsert",
    RunTime: 42,
    ...overrides,
  };
}

test("a passing run maps to the fully-qualified test name", () => {
  const results = parseApexTestOutput(payload([row()]));
  assert.deepEqual(results, [
    { name: "BulkInsertTest.bulkifiesInsert", passed: true, message: "" },
  ]);
});

test("only the exact outcome Pass counts as a pass", () => {
  for (const outcome of ["Fail", "CompileFail", "Skip", "pass", "PASS", "", "Passed"]) {
    const [result] = parseApexTestOutput(payload([row({ Outcome: outcome })]));
    assert.equal(result.passed, false, `"${outcome}" was treated as a pass`);
  }
});

test("a failure carries its message and stack", () => {
  const [result] = parseApexTestOutput(
    payload([
      row({
        Outcome: "Fail",
        Message: "System.AssertException: Expected 200, Actual 1",
        StackTrace: "Class.BulkInsertTest.bulkifiesInsert: line 14, column 1",
      }),
    ]),
  );
  assert.equal(result.passed, false);
  assert.match(result.message, /Expected 200, Actual 1/);
  assert.match(result.message, /line 14/);
});

test("a compile failure says the code never ran", () => {
  const [result] = parseApexTestOutput(
    payload([row({ Outcome: "CompileFail", Message: "Variable does not exist: acc" })]),
  );
  assert.match(result.message, /Variable does not exist/);
});

test("a skipped test is not silently green", () => {
  const [result] = parseApexTestOutput(payload([row({ Outcome: "Skip", Message: null })]));
  assert.equal(result.passed, false);
  assert.match(result.message, /skipped/);
});

test("an unreadable payload is null, not an empty pass", () => {
  for (const bad of [
    "",
    "not json",
    "{}",
    '{"result":{}}',
    '{"result":{"tests":"nope"}}',
    '{"result":{"tests":[]}}', // parsed, but nothing recognisable ran
    '{"result":{"tests":[{"Outcome":"Pass"}]}}', // no name — can't be reconciled
  ]) {
    assert.equal(parseApexTestOutput(bad), null, `parsed as results: ${bad}`);
  }
});

test("a row falls back to Class.method when FullName is absent", () => {
  const [result] = parseApexTestOutput(
    payload([row({ FullName: undefined })]),
  );
  assert.equal(result.name, "BulkInsertTest.bulkifiesInsert");
});

test("class names come from the basename, and reject anything illegal", () => {
  assert.equal(classNameOf("force-app/main/default/classes/AccountService.cls"), "AccountService");
  assert.equal(classNameOf("AccountService.cls"), "AccountService");
  assert.equal(classNameOf("Account Service.cls"), null);
  assert.equal(classNameOf("9Lives.cls"), null);
  assert.equal(classNameOf("notes.md"), null);
});

test("the project writes a meta file per class and never the solution", () => {
  const files = apexProjectFiles(
    [{ path: "AccountService.cls", contents: "public class AccountService {}" }],
    [{ path: "AccountServiceTest.cls", contents: "@isTest private class AccountServiceTest {}" }],
  );
  const paths = files.map((f) => f.path);

  assert.ok(paths.includes("sfdx-project.json"));
  assert.ok(paths.includes("force-app/main/default/classes/AccountService.cls"));
  assert.ok(paths.includes("force-app/main/default/classes/AccountService.cls-meta.xml"));
  assert.ok(paths.includes("force-app/main/default/classes/AccountServiceTest.cls-meta.xml"));
  // There is no parameter that could carry it, and there must not be one.
  assert.ok(!files.some((f) => f.content.includes("the answer")));
});

test("a submission cannot shadow a test class by reusing its name", () => {
  const files = apexProjectFiles(
    [{ path: "AccountServiceTest.cls", contents: "public class AccountServiceTest { /* mine */ }" }],
    [{ path: "AccountServiceTest.cls", contents: "@isTest private class AccountServiceTest { /* real */ }" }],
  );
  const deployed = files.find(
    (f) => f.path === "force-app/main/default/classes/AccountServiceTest.cls",
  );
  assert.match(deployed.content, /real/);
  assert.ok(!deployed.content.includes("mine"));
});

test("only test classes are named to the runner", () => {
  const names = testClassNames([
    { path: "AccountServiceTest.cls", contents: "" },
    { path: "AccountServiceTest.cls", contents: "" },
    { path: "readme.md", contents: "" },
  ]);
  assert.deepEqual(names, ["AccountServiceTest"]);
});

test("a deploy failure explains that nothing ran", () => {
  assert.match(deployFailureMessage("Invalid type: Acccount"), /didn't deploy/);
  assert.match(deployFailureMessage("Invalid type: Acccount"), /Invalid type/);
  assert.match(deployFailureMessage(""), /didn't deploy/);
});
