import IntakeForm from "./onboarding-client";
import styles from "./onboarding.module.css";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className={styles.pageShell}>
      <IntakeForm />
    </main>
  );
}
