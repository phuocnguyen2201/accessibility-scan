import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
blocked.addSubnet("::1", 128, "ipv6");
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");

/** Throws if the host resolves to a private / loopback / link-local address. */
export async function assertPublicHost(hostname: string): Promise<void> {
  const addrs = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true });
  for (const { address, family } of addrs) {
    if (blocked.check(address, family === 6 ? "ipv6" : "ipv4")) {
      throw new Error(`Refusing to scan ${hostname}: resolves to private address ${address}`);
    }
  }
}
