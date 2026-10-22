import { EVENT_ID } from "@/lib/seed";
import { GalleryView } from "@/views/gallery";

export const generateStaticParams = () => [{ eventId: EVENT_ID }];

export default async function Page({ params }: { params: Promise<{ eventId: string }> }) {
  return <GalleryView eventId={(await params).eventId} />;
}
