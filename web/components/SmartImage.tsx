import Image, { type ImageProps } from "next/image";
import { getProxiedImageSrc } from "@/lib/image-proxy";

export default function SmartImage(props: ImageProps) {
  const { src, alt = "", ...rest } = props;
  const resolvedSrc = getProxiedImageSrc(src);
  return <Image src={resolvedSrc} alt={alt} {...rest} />;
}
