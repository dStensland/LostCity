import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import ForthDigestTemplate from "./forth-digest-template";
import type { ForthDigestProps } from "./forth-digest-template";

/**
 * Server-side PDF generation using @react-pdf/renderer
 * Returns a Buffer of the generated PDF
 */
export async function generateDigestPdf(
  props: ForthDigestProps
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = createElement(ForthDigestTemplate, props) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
