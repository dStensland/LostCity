import { headers } from "next/headers";

type Props = {
  css?: string | null;
};

export default function ScopedStylesServer({ css }: Props) {
  if (!css) return null;
  const nonce = headers().get("x-nonce") || undefined;
  return <style nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />;
}
