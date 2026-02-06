import { headers } from "next/headers";

type Props = {
  css?: string | null;
};

export default async function ScopedStylesServer({ css }: Props) {
  if (!css) return null;
  const hdrs = await headers();
  const nonce = hdrs.get("x-nonce") || undefined;
  return <style nonce={nonce} dangerouslySetInnerHTML={{ __html: css }} />;
}
