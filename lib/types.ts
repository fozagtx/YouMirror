export type Kind = "foundation" | "lipstick" | "garment";

export type Product = {
  id: string;
  kind: Kind;
  brand: string;
  name: string;
  line: string;
  shade: string | null;
  hex: string | null;
  image?: string | null;
  url?: string | null;
  price?: string | null;
};

export type SkinOutput = { type: string; ui_score?: number; raw_score?: number; score?: number; mask_urls?: string[] };
