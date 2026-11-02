import Mirror from "@/components/Mirror";
import { catalogSize } from "@/lib/catalog";

export default function Home() {
  const size = catalogSize();
  return <Mirror shadeCount={size.foundation + size.lipstick} />;
}
