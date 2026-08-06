import assert from "node:assert/strict";
import test from "node:test";

import {
  selectWorkspaceApiTargets,
  selectWorkspaceWebTargets,
} from "./start-development.mjs";

test("selects both the Nest watcher and detached API process", () => {
  const processes = [
    {
      processId: 101,
      parentProcessId: 90,
      commandLine:
        "node C:\\workspace\\apps\\api\\node_modules\\@nestjs\\cli\\bin\\nest.js start --watch",
    },
    {
      processId: 102,
      parentProcessId: 99,
      commandLine: "node C:\\workspace\\apps\\api\\dist\\src\\main.js",
    },
  ];

  assert.deepEqual(selectWorkspaceApiTargets(processes), processes);
});

test("selects a direct API process when no Nest watcher exists", () => {
  const processes = [
    {
      processId: 201,
      parentProcessId: 10,
      commandLine: "node C:\\workspace\\apps\\api\\dist\\src\\main.js",
    },
  ];

  assert.deepEqual(selectWorkspaceApiTargets(processes), processes);
});

test("selects child processes so detached API processes cannot keep Prisma locked", () => {
  const processes = [
    { processId: 301, parentProcessId: 10, commandLine: "api parent" },
    { processId: 302, parentProcessId: 301, commandLine: "api child" },
  ];

  assert.deepEqual(selectWorkspaceApiTargets(processes), processes);
});

test("selects only the Angular development server", () => {
  const processes = [
    {
      processId: 401,
      parentProcessId: 40,
      commandLine:
        'node "C:\\workspace\\apps\\admin-web\\node_modules\\@angular\\cli\\bin\\ng.js" serve',
    },
    {
      processId: 402,
      parentProcessId: 40,
      commandLine: 'node "C:\\workspace\\tools\\server.js"',
    },
  ];

  assert.deepEqual(selectWorkspaceWebTargets(processes), [processes[0]]);
});
