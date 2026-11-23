import { useEffect, useRef, useState } from "react";
import type { CompletedScan } from "../scan";
import { unwarpRaster } from "../unwarp";

async function loadPixels(url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

/** The input photo next to the card the decoder "sees": flattened with the 4 corner markers. */
export function RawUnwarpView({ scan }: { scan: CompletedScan }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  useEffect(() => {
    let live = true;
    setState("working");
    loadPixels(scan.imageUrl)
      .then((photo) => {
        const flat = unwarpRaster(photo, scan.result, scan.layout);
        const c = canvas.current;
        if (!live || !flat || !c) return live && setState("failed");
        c.width = flat.width;
        c.height = flat.height;
        c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(flat.data), flat.width, flat.height), 0, 0);
        setState("done");
      })
      .catch(() => live && setState("failed"));
    return () => {
      live = false;
    };
  }, [scan]);
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="raw-unwarped">
      <figure>
        <img src={scan.imageUrl} alt={`Raw input photo: ${scan.label}`} className="block w-full rounded-lg border-2 border-slate-400 bg-slate-800" />
        <figcaption className="mt-2 text-lg font-bold">Raw photo</figcaption>
      </figure>
      <figure>
        <canvas
          ref={canvas}
          role="img"
          aria-label="The same card after optical unwarping: flat, face-on, corner markers at their printed positions"
          className="block w-full rounded-lg border-2 border-slate-400 bg-white"
        />
        <figcaption className="mt-2 text-lg font-bold">
          Unwarped card{" "}
          <span className="font-normal text-slate-800">
            {state === "working" ? "(drawing...)" : state === "failed" ? "(could not be drawn)" : "(4 corner markers mapped to their printed positions)"}
          </span>
        </figcaption>
      </figure>
    </div>
  );
}
