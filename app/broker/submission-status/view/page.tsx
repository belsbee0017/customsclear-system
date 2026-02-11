export const dynamic = "force-dynamic";
export const revalidate = 0;

import ViewClient from "./ViewClient";

export default function Page({
  searchParams,
}: {
  searchParams?: { document_set_id?: string };
}) {
  const documentSetId = searchParams?.document_set_id ?? null;
  return <ViewClient documentSetId={documentSetId} />;
}
