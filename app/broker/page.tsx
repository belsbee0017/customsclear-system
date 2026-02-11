"use client";

import { useRouter } from "next/navigation";

export default function BrokerHomePage() {
  const router = useRouter();

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome!</h1>
        <p style={styles.subtitle}>
          Please select an option below to continue.
        </p>

        <div style={styles.grid}>
          {/* SUBMIT ENTRY */}
          <div style={styles.optionCard}>
            <h3 style={styles.optionTitle}>
              Submit Formal Entry Documents
            </h3>
            <p style={styles.optionText}>
              Upload required documents for system validation and review.
            </p>
            <button
              style={styles.actionLink}
              onClick={() => router.push("/broker/submit-entry")}
            >
              Submit Entries →
            </button>
          </div>

          {/* VIEW STATUS */}
          <div style={styles.optionCard}>
            <h3 style={styles.optionTitle}>
              View Submission Status
            </h3>
            <p style={styles.optionText}>
              Check the validation and approval status of your submissions.
            </p>
            <button
              style={styles.actionLink}
              onClick={() => router.push("/broker/submission-status")}
            >
              View Status →
            </button>
          </div>

          {/* PAST SUBMISSIONS */}
          <div style={styles.optionCard}>
            <h3 style={styles.optionTitle}>
              View Past Submissions
            </h3>
            <p style={styles.optionText}>
              Review previously submitted and completed formal entries.
            </p>
            <button
              style={styles.actionLink}
              onClick={() => router.push("/broker/past-submissions")}
            >
              View Entries →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ===============================
   STRICT BRAND KIT + SENIOR-FRIENDLY
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: "32px",
    backgroundColor: "#ffffff",
    minHeight: "calc(100vh - 64px)",
    color: "#141414"
  },

  card: {
    backgroundColor: "#e8eef3",
    borderRadius: "12px",
    padding: "40px",
    maxWidth: "1100px",
    margin: "0 auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "12px"
  },

  subtitle: {
    fontSize: "18px",
    marginBottom: "32px",
    lineHeight: "1.6"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "24px"
  },

  optionCard: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "28px",
    border: "1px solid #d6dde3",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  },

  optionTitle: {
    fontSize: "20px",
    fontWeight: "bold",
    marginBottom: "12px"
  },

  optionText: {
    fontSize: "16px",
    lineHeight: "1.6",
    marginBottom: "20px"
  },

  actionLink: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    padding: "12px 0",
    fontSize: "16px",
    fontWeight: "bold",
    color: "#141414",
    cursor: "pointer",
    textDecoration: "underline"
  }
};
