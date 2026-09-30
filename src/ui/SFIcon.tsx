import React from "react";
import { SvgXml } from "react-native-svg";
import { SF_ICONS, type SFSymbolName } from "./sf-icons";

export type { SFSymbolName };

/**
 * Pixel-identical Apple SF Symbols artwork, rendered from extracted vector
 * data (see scripts/extract-sf-icons.js). Drop-in for lucide-react-native
 * usage: <SFIcon name="message" size={22} color="#111" />.
 *
 * NOTE: Apple's license restricts SF Symbols artwork to Apple platforms.
 */
export function SFIcon({
  name,
  size = 21,
  color = "#111",
}: {
  name: SFSymbolName | string;
  size?: number;
  color?: string;
}) {
  const icon =
    SF_ICONS[name as SFSymbolName] ?? SF_ICONS["circle"];
  const paths = icon.paths
    .map(
      (p) =>
        `<path d="${p.d}"${
          p.fillOpacity != null ? ` fill-opacity="${p.fillOpacity}"` : ""
        }/>`
    )
    .join("");
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" ` +
    `fill="${color}" preserveAspectRatio="xMidYMid meet">${paths}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}
