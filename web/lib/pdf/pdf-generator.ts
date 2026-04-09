import { createElement } from "react";
import type { ForthDigestProps } from "./forth-digest-template";

/**
 * Server-side PDF generation using @react-pdf/renderer.
 * Dependencies are dynamically imported so the heavy package
 * is only bundled into this API route chunk, not traced globally.
 */
export async function generateDigestPdf(
  props: ForthDigestProps
): Promise<Buffer> {
  const [{ renderToBuffer }, { default: ForthDigestTemplate }] =
    await Promise.all([
      import("@react-pdf/renderer"),
      import("./forth-digest-template"),
    ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(ForthDigestTemplate, props) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
