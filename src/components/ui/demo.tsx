import { ImageStreamHero } from "@/components/ui/image-stream-hero";

const GALLERY_IMAGES = [
  {
    src: "/gallery/cleanup-bridge.png",
    alt: "Volunteers cleaning riverbanks under the bridge",
  },
  {
    src: "/gallery/cleanup-river-dredge.png",
    alt: "Dredging debris and sludge in polluted river",
  },
  {
    src: "/gallery/cleanup-hands-sunset.png",
    alt: "Volunteer hands recovering plastic bottles at sunset",
  },
  {
    src: "/gallery/cleanup-shore-bags.png",
    alt: "Massive plastic cleanup along lake shoreline",
  },
  {
    src: "/gallery/cleanup-volunteers-stream.png",
    alt: "Community volunteers clearing stream debris",
  },
];

// ONLY DEFAULT EXPORT WILL BE TREATED AS A DEMO
export default function DemoOne() {
  return (
    <ImageStreamHero
      images={GALLERY_IMAGES}
      className="h-[560px] w-full rounded-2xl border border-[#e7e5e4] bg-[#fbf9f5]"
    >
      <div className="relative z-10 flex h-full flex-col items-center justify-between py-12 text-center">
        <div className="px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            GROUND ZERO ACTION STREAM
          </span>
          <h1 className="mt-4 text-balance text-4xl font-extrabold tracking-tight text-[#1c1917] sm:text-5xl">
            Clean Waters,
            <br />
            Front and Centre.
          </h1>
        </div>
        <p className="max-w-md text-balance px-6 text-sm font-medium text-[#57534e]">
          Every bag dredged, every bottle recovered. Watch the live 3D stream of community action restoring our lakes.
        </p>
      </div>
    </ImageStreamHero>
  );
}
