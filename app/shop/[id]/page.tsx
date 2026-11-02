import { Suspense } from "react";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import ProductView from "@/components/ProductView";
import { getProduct, lineOf } from "@/lib/catalog";

async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProduct(decodeURIComponent(id));
  if (!p) notFound();
  return <ProductView first={p} shades={lineOf(p)} />;
}

export default function ProductPage({ params }: PageProps<"/shop/[id]">) {
  return (
    <>
      <Nav active="/shop" />
      <main className="page">
        <Suspense fallback={<p className="empty">Loading product</p>}>
          <Product params={params} />
        </Suspense>
      </main>
    </>
  );
}
