import { Suspense } from "react";
import Nav from "@/components/Nav";
import Mirror from "@/components/Mirror";

export default function MirrorPage() {
  return (
    <>
      <Nav active="/mirror" />
      <main className="page">
        <Suspense fallback={<p className="empty">Opening the mirror</p>}>
          <Mirror />
        </Suspense>
      </main>
    </>
  );
}
