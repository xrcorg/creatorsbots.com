import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/dashboard-client.tsx", import.meta.url);
const workerPath = new URL("../worker/index.ts", import.meta.url);

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

test("allows a recorded per-fan adult confirmation without a global age bypass", async () => {
  const [dashboard, worker] = await Promise.all([
    readFile(dashboardPath, "utf8"),
    readFile(workerPath, "utf8"),
  ]);

  assert.match(dashboard, />Confirm fan is 18\+<\/button>/);
  assert.match(dashboard, />18\+ confirmed<\/span>/);
  assert.match(worker, /\/api\/admin\/conversations\/confirm-age/);
  assert.match(worker, /INSERT INTO age_verification_audit/);
  assert.match(worker, /This fan stated they are under 18\. Their age status cannot be overridden\./);
});

test("pauses an unclear age gate instead of repeating it indefinitely", async () => {
  const worker = await readFile(workerPath, "utf8");
  assert.match(worker, /Number\(priorAgePrompt\?\.count \|\| 0\) >= 1/);
  assert.match(worker, /queueCreatorReply\(env\.DB, message, "age_review"\)/);
  assert.match(worker, /age_creator_review_needed: true/);
});

test("allows Inbox deletion for fan and creator messages", async () => {
  const [dashboard, worker] = await Promise.all([
    readFile(dashboardPath, "utf8"),
    readFile(workerPath, "utf8"),
  ]);

  assert.match(dashboard, /async function deleteConversationMessage/);
  assert.match(dashboard, /Delete message from/);
  assert.match(worker, /telegram_message_id INTEGER/);
  assert.match(worker, /deleteBusinessMessages/);
  assert.match(worker, /request\.method === "DELETE" && messageMatch/);
  assert.match(worker, /DELETE FROM chat_messages WHERE id = \? AND chat_id = \?/);
});
