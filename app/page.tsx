import { getChatGPTUser } from "./chatgpt-auth";
import Dashboard from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="accessDenied">
        <div>
          <span>TM</span>
          <h1>Creator access only</h1>
          <p>Open this control panel from your signed in Codex workspace.</p>
        </div>
      </main>
    );
  }
  return <Dashboard />;
}
