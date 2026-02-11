"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

const STATUS_EXPLANATIONS: Record<string, string> = {
  pending: "Your submission has been received and is awaiting initial review.",
  for_review: "Your submission is currently under review by Customs.",
  validated: "Your submission has been validated.",
  completed: "Final tax computation has been confirmed by Customs.",
  error: "An issue was identified during validation.",
};

function normStatus(s: string | null | undefined) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

type Submission = {
  document_set_id: string;
  created_at: string;
  status: string;
};

type DocumentFile = {
  document_id: string;
  type: string;
  storage_path: string;
};

export default function BrokerViewSubmissionPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.container}>
          <div style={styles.card}>Loading submission…</div>
        </main>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const documentSetId = searchParams.get("document_set_id");
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [hasComputation, setHasComputation] = useState(false);

  useEffect(() => {
    if (!documentSetId) return;

    const fetchData = async () => {
      const { data: ds } = await supabase
        .from("document_sets")
        .select(
          `
          document_set_id,
          created_at,
          status,
          tax_computation ( tax_id )
        `
        )
        .eq("document_set_id", documentSetId)
        .single();

      const { data: docs } = await supabase
        .from("documents")
        .select("document_id, type, storage_path")
        .eq("document_set_id", documentSetId);

      setSubmission(ds as any);
      setDocuments(docs ?? []);
      setHasComputation(
        Array.isArray((ds as any)?.tax_computation) &&
          (ds as any).tax_computation.length > 0
      );
      setLoading(false);
    };

    fetchData();
  }, [documentSetId]);

  if (loading || !submission) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>Loading submission…</div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>View Submission</h1>
            <p style={styles.subtitle}>
              Entry No.: <strong>{submission.document_set_id}</strong>
            </p>
          </div>

          <div style={styles.backButtonWrapper}>
            <Button variant="outline" onClick={() => router.back()}>
              Back
            </Button>
          </div>
        </div>

        <section style={{ marginTop: 10, marginBottom: 18 }}>
          {(() => {
            const raw = normStatus(submission.status);
            const displayKey = hasComputation ? "completed" : raw;

            return (
              <div style={{ fontSize: 14 }}>
                <div>
                  <strong>Status:</strong>{" "}
                  {displayKey.replace(/_/g, " ").toUpperCase()}
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#333" }}>
                  {STATUS_EXPLANATIONS[displayKey] ?? "Status update pending."}
                </div>
              </div>
            );
          })()}
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Uploaded Documents</h2>

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Document Type</th>
                <th style={styles.th}>File</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.document_id}>
                  <td style={styles.td}>{doc.type}</td>
                  <td style={styles.td}>
                    <a
                      href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.storage_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      View / Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

/* ---------- STYLES ---------- */
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
    padding: "32px",
    maxWidth: "1100px",
    margin: "0 auto",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
  },

  title: {
    fontSize: "26px",
    fontWeight: "bold",
    marginBottom: "6px"
  },

  subtitle: {
    fontSize: "15px",
    marginBottom: "24px"
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "24px",
    alignItems: "flex-start"
  },

  /* 🔽 ONLY THIS CONTROLS BACK BUTTON SIZE */
  backButtonWrapper: {
    transform: "scale(1)",
    transformOrigin: "top right"
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden"
  },

  th: {
    textAlign: "left",
    padding: "14px",
    fontWeight: "bold",
    borderBottom: "1px solid #d6dde3"
  },

  td: {
    padding: "14px",
    borderBottom: "1px solid #e1e6eb",
    verticalAlign: "top"
  },

  section: {
    marginTop: "28px"
  },

  sectionTitle: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "16px"
  },

  link: {
    fontWeight: "bold",
    textDecoration: "underline",
    color: "#141414"
  }
};
