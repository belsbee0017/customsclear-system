"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabaseClient";
import Button from "@/app/components/Button";

const supabase = createClient();

/* ===============================
   DOCUMENT CONFIG
   =============================== */
type UploadKey = "gd" | "invoice" | "packing" | "awb";

type UploadField = {
  label: string;
  key: UploadKey;
};

const DOCUMENTS: UploadField[] = [
  { label: "Goods Declaration (GD / SAD)", key: "gd" },
  { label: "Commercial Invoice", key: "invoice" },
  { label: "Packing List", key: "packing" },
  { label: "Airway Bill", key: "awb" }
];

/* ===============================
   DB ENUM MAP
   =============================== */
const DOCUMENT_TYPE_MAP: Record<
  UploadKey,
  "GD" | "INVOICE" | "PACKING_LIST" | "AWB"
> = {

  gd: "GD",
  invoice: "INVOICE",
  packing: "PACKING_LIST",
  awb: "AWB"
};

export default function SubmitFormalEntryPage() {
  const router = useRouter();

  const [files, setFiles] = useState<Record<UploadKey, File[]>>({
  gd: [],
  invoice: [],
  packing: [],
  awb: []
});

  const [dragOver, setDragOver] = useState<UploadKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* ===============================
     FILE HANDLERS
     =============================== */
  const handleFile = (key: UploadKey, input: File | FileList | null) => {
  if (!input) return;

  const incoming = input instanceof File ? [input] : Array.from(input);
  if (incoming.length === 0) return;

  setFiles((prev) => ({
    ...prev,
    [key]: [...prev[key], ...incoming], // ✅ always append
  }));
  };

  const handleDrop = (key: UploadKey, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    handleFile(key, e.dataTransfer.files);
  };

  /* ===============================
     PREPARE DOCUMENTS (OCR STARTS HERE)
     =============================== */
  const handlePrepare = async () => {
    const missing = DOCUMENTS.filter((d) => files[d.key].length === 0);
    if (missing.length > 0) {
      alert("Please upload all required documents before continuing.");
      return;
    }

    setSubmitting(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Not authenticated");
      setSubmitting(false);
      return;
    }

    /* 1️⃣ CREATE DOCUMENT SET */
    const { data: documentSet, error: dsError } = await supabase
      .from("document_sets")
      .insert({
        created_by: user.id,
        status: "Pending"
      })
      .select()
      .single();

    if (dsError || !documentSet) {
      alert(dsError?.message ?? "Failed to create document set");
      setSubmitting(false);
      return;
    }

 /* 2️⃣ UPLOAD + INSERT */
for (const doc of DOCUMENTS) {
  const fileList = files[doc.key]; // ✅ array

  for (const file of fileList) {
    const storagePath = `${documentSet.document_set_id}/${doc.key}_${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) {
      alert(uploadError.message);
      setSubmitting(false);
      return;
    }

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        document_set_id: documentSet.document_set_id,
        type: DOCUMENT_TYPE_MAP[doc.key],
        storage_path: storagePath,
        mime_type: file.type,
        ocr_status: "Pending"
      })
      .select()
      .single();

    if (insertError || !insertedDoc) {
      alert(insertError?.message ?? "Failed to save document record");
      setSubmitting(false);
      return;
    }
  }
}

    /* 3️⃣ ROUTE TO REVIEW PAGE */
    router.push(
      `/broker/submit-entry/review?document_set_id=${documentSet.document_set_id}`
    );
  };

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Submit Formal Entry</h1>
        <p style={styles.subtitle}>
          Upload all required documents to prepare your submission.
        </p>

        <div style={styles.grid}>
          {DOCUMENTS.map((doc) => (
            <label
              key={doc.key}
              style={{
                ...styles.uploadCard,
                backgroundColor:
                  dragOver === doc.key ? "#dbe5ee" : "#ffffff"
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(doc.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(doc.key, e)}
            >
              <h3 style={styles.uploadTitle}>{doc.label}</h3>

              <p style={styles.uploadText}>
                Drag & drop or click to browse
                <br />
                <span style={styles.uploadHint}>
                  PDF, JPG, JPEG, PNG accepted
                </span>
              </p>

              {files[doc.key].length > 0 && (
                <div style={styles.fileName}>
                  {files[doc.key].length} file(s) selected
                </div>
              )}

             <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              style={styles.hiddenInput}
              onChange={(e) => handleFile(doc.key, e.target.files)}
            />

              <div style={styles.browseButton}>Browse</div>
            </label>
          ))}
        </div>

        <div style={styles.actions}>
          <Button onClick={handlePrepare} disabled={submitting}>
            {submitting ? "Preparing…" : "Prepare Documents"}
          </Button>
        </div>
      </div>
    </main>
  );
}

/* ===============================
   STRICT BRAND KIT STYLES
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
    padding: "32px",
    maxWidth: "1200px",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "20px"
  },
  uploadCard: {
    border: "1px dashed #8aa8c2",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  },
  uploadTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    marginBottom: "8px"
  },
  uploadText: {
    fontSize: "13px",
    marginBottom: "10px"
  },
  uploadHint: {
    fontSize: "12px",
    color: "#555"
  },
  fileName: {
    fontSize: "12px",
    fontStyle: "italic",
    marginBottom: "8px"
  },
  browseButton: {
    fontSize: "13px",
    fontWeight: "bold",
    backgroundColor: "#8aa8c2",
    padding: "8px 14px",
    borderRadius: "6px",
    display: "inline-block",
    boxShadow: "0 2px 0 rgba(0,0,0,0.15)"
  },
  hiddenInput: {
    display: "none"
  },
  actions: {
    display: "flex",
    justifyContent: "center",
    marginTop: "24px"
  }
};