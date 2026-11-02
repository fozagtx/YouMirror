import Nav from "@/components/Nav";
import SkinHistory from "@/components/SkinHistory";

export default function SkinPage() {
  return (
    <>
      <Nav active="/skin" />
      <main className="page"><SkinHistory /></main>
    </>
  );
}
