"use client";

import { useEffect, useRef, useState } from "react";

/* ===============================
   INTERSECTION OBSERVER HOOK
   =============================== */
function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

const STATUS_EXPLANATIONS: Record<string, string> = {
  submitted:
    "Your submission has been received and is awaiting initial review.",
  for_review:
    "Your submission is currently under review by Customs.",
  validated:
    "Your submission has been validated. Processing is complete.",
  error:
    "An issue was identified during validation. You may be contacted for clarification.",
  released:
    "Your submission has been cleared and released.",
  completed:
    "This formal entry has been fully processed."
};


export default function Home() {
  const section1 = useReveal();
  const section2 = useReveal();
  const section3 = useReveal();
  const section4 = useReveal();

  return (
    <main style={styles.page}>
      {/* ===============================
          HERO
          =============================== */}
      <section style={styles.hero}>
        <div style={styles.heroOverlay} />

        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>Welcome to CustomsClear</h1>
          <h2 style={styles.heroSubtitle}>Formal Entry Validation System</h2>
          <p style={styles.heroText}>
            A government-oriented platform that supports the electronic
            submission and preliminary validation of formal entry documents,
            subject to customs officer verification.
          </p>
        </div>
      </section>

      {/* ===============================
          WHAT IS CUSTOMSCLEAR
          =============================== */}
      <section
        ref={section1.ref}
        style={{
          ...styles.section,
          ...reveal(section1.visible),
        }}
      >
        <h2 style={styles.sectionTitle}>What is CustomsClear?</h2>

        <div style={styles.cardGrid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>System Purpose</h3>
            <p style={styles.cardText}>
              CustomsClear assists in the submission, extraction, and
              preliminary validation of formal entry documents for imported
              goods.
            </p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>System Scope</h3>
            <p style={styles.cardText}>
              The system supports customs brokers and customs officers by
              organizing document workflows and system-generated computations.
            </p>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Regulatory Context</h3>
            <p style={styles.cardText}>
              The system is designed to align with Philippine Bureau of Customs
              procedures and internal validation processes.
            </p>
          </div>
        </div>
      </section>

      {/* ===============================
          REGISTRATION FLOW
          =============================== */}
      <section
        ref={section2.ref}
        style={{
          ...styles.sectionAlt,
          ...reveal(section2.visible),
        }}
      >
        <h2 style={styles.sectionTitle}>
          What Happens After Broker Registration?
        </h2>

        <ol style={styles.steps}>
          <li>Broker submits registration details through the system.</li>
          <li>Account status is set to <strong>Pending</strong>.</li>
          <li>System administrators review and verify the registration.</li>
          <li>Approved users receive authorization to access system features.</li>
          <li>Brokers may submit formal entry documents for validation.</li>
        </ol>
      </section>

      {/* ===============================
          ACCESSIBILITY
          =============================== */}
      <section
        ref={section3.ref}
        style={{
          ...styles.section,
          ...reveal(section3.visible),
        }}
      >
        <h2 style={styles.sectionTitle}>
          Accessibility and System Design Considerations
        </h2>

        <ul style={styles.list}>
          <li>High-contrast text for readability</li>
          <li>Large font sizes suitable for senior users</li>
          <li>Clear labels and instructions</li>
          <li>Consistent layout across pages</li>
          <li>No reliance on color alone to convey meaning</li>
          <li>Keyboard-accessible form controls</li>
        </ul>
      </section>

      {/* ===============================
          SYSTEM ACCESS
          =============================== */}
      <section
        ref={section4.ref}
        style={{
          ...styles.sectionAlt,
          ...reveal(section4.visible),
        }}
      >
        <h2 style={styles.sectionTitle}>System Access</h2>

        <p style={styles.text}>
          Access to the CustomsClear system is granted only to authorized users.
          Login credentials are issued after successful registration,
          verification, and administrative approval.
        </p>

        <ul style={styles.accessNotes}>
          <li>
            <em>
              For brokers: registration and administrative approval are required
              prior to system access.
            </em>
          </li>
          <li>
            <em>
              For customs officers: access is provided through official internal
              authorization.
            </em>
          </li>
        </ul>

        <p style={styles.audit}>
          All system activities are subject to monitoring and audit in
          accordance with applicable regulations.
        </p>
      </section>
    </main>
  );
}

/* ===============================
   ANIMATION HELPERS
   =============================== */

function reveal(visible: boolean): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };
}

/* ===============================
   STRICT BRAND KIT STYLES
   =============================== */

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    backgroundColor: "#ffffff",
    color: "#141414",
  },

  hero: {
    position: "relative",
    minHeight: "70vh",
    backgroundImage: "url('/heroBackground.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    alignItems: "center",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(255,255,255,0.72)",
  },

  heroContent: {
    position: "relative",
    maxWidth: "1100px",
    padding: "48px",
    margin: "0 auto",
  },

  heroTitle: {
    fontSize: "40px",
    fontWeight: "bold",
    marginBottom: "12px",
  },

  heroSubtitle: {
    fontSize: "22px",
    fontWeight: "bold",
    marginBottom: "16px",
  },

  heroText: {
    fontSize: "18px",
    maxWidth: "720px",
    lineHeight: "1.6",
  },

  section: {
    padding: "56px 40px",
    maxWidth: "1100px",
    margin: "0 auto",
  },

  sectionAlt: {
    padding: "56px 40px",
    backgroundColor: "#f4f6f8",
  },

  sectionTitle: {
    fontSize: "26px",
    fontWeight: "bold",
    marginBottom: "24px",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "24px",
  },

  card: {
    backgroundColor: "#e8eef3",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },

  cardTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "12px",
  },

  cardText: {
    fontSize: "16px",
    lineHeight: "1.5",
  },

  steps: {
    fontSize: "17px",
    lineHeight: "1.8",
    paddingLeft: "20px",
  },

  list: {
    fontSize: "16px",
    lineHeight: "1.7",
    paddingLeft: "20px",
  },

  text: {
    fontSize: "17px",
    maxWidth: "900px",
    marginBottom: "16px",
    lineHeight: "1.6",
  },

  accessNotes: {
    fontSize: "15px",
    paddingLeft: "20px",
    marginBottom: "16px",
  },

  audit: {
    fontSize: "14px",
    maxWidth: "900px",
    lineHeight: "1.6",
  },
};