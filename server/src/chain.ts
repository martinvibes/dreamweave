/**
 * On-chain settlement via DreamVault on Base.
 *
 * Active only when SETTLE_ONCHAIN=1 with DREAMVAULT_ADDRESS + OPERATOR_PRIVATE_KEY
 * set (Base Sepolia by default). In local mode these functions are never called;
 * the orchestrator settles in-process instead. The ABI mirrors contracts/DreamVault.sol.
 */

import { config } from "./config.js";

const DREAMVAULT_ABI = [
  {
    type: "function",
    name: "openDream",
    stateMutability: "nonpayable",
    inputs: [
      { name: "weaver", type: "address" },
      { name: "budget", type: "uint256" },
      { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "dreamId", type: "uint256" }],
  },
  {
    type: "function",
    name: "settleThread",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dreamId", type: "uint256" },
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "capOrderId", type: "bytes32" },
          { name: "proofHash", type: "bytes32" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "closeDream",
    stateMutability: "nonpayable",
    inputs: [{ name: "dreamId", type: "uint256" }],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function chainConfigured(): boolean {
  return Boolean(
    config.chain.onchain &&
      config.chain.dreamVault &&
      config.chain.operatorKey,
  );
}

async function clients() {
  const { createWalletClient, createPublicClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { baseSepolia, base } = await import("viem/chains");
  const chain = config.chain.id === 8453 ? base : baseSepolia;
  const account = privateKeyToAccount(config.chain.operatorKey as `0x${string}`);
  const transport = http(config.chain.rpcUrl);
  return {
    account,
    chain,
    wallet: createWalletClient({ account, chain, transport }),
    pub: createPublicClient({ chain, transport }),
  };
}

/** Convert an arbitrary id/hash into a 32-byte hex for on-chain fields. */
export async function toBytes32(input: string): Promise<`0x${string}`> {
  const { keccak256, toHex } = await import("viem");
  if (/^0x[0-9a-fA-F]{64}$/.test(input)) return input as `0x${string}`;
  return keccak256(toHex(input));
}

export interface OnchainSettle {
  seller: `0x${string}`;
  amount: bigint;
  capOrderId: string;
  proofHash: string;
}

/**
 * Settle one thread on-chain: release USDC from the vault to the seller,
 * recording the CAP order id + proof hash. Returns the tx hash.
 */
export async function settleThreadOnchain(
  chainDreamId: bigint,
  s: OnchainSettle,
): Promise<`0x${string}`> {
  const { wallet, pub } = await clients();
  const hash = await wallet.writeContract({
    address: config.chain.dreamVault as `0x${string}`,
    abi: DREAMVAULT_ABI,
    functionName: "settleThread",
    args: [
      chainDreamId,
      {
        seller: s.seller,
        amount: s.amount,
        capOrderId: await toBytes32(s.capOrderId),
        proofHash: await toBytes32(s.proofHash),
      },
    ],
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

export { DREAMVAULT_ABI, ERC20_ABI };
