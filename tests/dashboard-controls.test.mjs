import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/dashboard-client.tsx", import.meta.url);

test("keeps content delivery and video chat fulfillment controls in the inbox", async () => {
  const dashboard = await readFile(dashboardPath, "utf8");

  assert.match(dashboard, />Confirm video chat payment<\/button>/);
  assert.match(dashboard, />Complete video chat \+ resume bot<\/button>/);
  assert.match(dashboard, /<span>Selected content<\/span>/);
  assert.match(dashboard, />Send selected content<\/button>/);

  const contentSelector = dashboard.indexOf("<span>Selected content</span>");
  const sendContent = dashboard.indexOf(">Send selected content</button>");
  const secondaryTools = dashboard.indexOf("quickReplyOptions", sendContent);

  assert.ok(contentSelector >= 0 && sendContent > contentSelector);
  assert.ok(secondaryTools > sendContent);
});
