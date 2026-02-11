export const dynamic = "force-dynamic";
export const revalidate = 0;

import ViewClient from "./ViewClient";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ document_set_id?: string }>;
}) {
  const params = await searchParams;
  const documentSetId = params?.document_set_id ?? null;
  return <ViewClient documentSetId={documentSetId} />;
}
