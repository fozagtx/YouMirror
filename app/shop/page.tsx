import Nav from "@/components/Nav";
import Shop from "@/components/Shop";

export default function ShopPage() {
  return (
    <>
      <Nav active="/shop" />
      <main className="page"><Shop /></main>
    </>
  );
}
