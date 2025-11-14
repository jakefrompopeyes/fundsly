/**
 * Raydium DEX Integration
 * Handles swaps on Raydium after token migration
 */

import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Raydium, TxVersion, parseTokenAccountResp } from "@raydium-io/raydium-sdk-v2";
import { WalletContextState } from "@solana/wallet-adapter-react";
import Decimal from "decimal.js";

const RAYDIUM_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta" ? "mainnet" : "devnet";

let raydiumInstance: Raydium | null = null;

/**
 * Initialize Raydium SDK instance
 */
async function getRaydium(connection: Connection): Promise<Raydium> {
  if (raydiumInstance) return raydiumInstance;

  raydiumInstance = await Raydium.load({
    owner: PublicKey.default, // Will be set per transaction
    connection,
    cluster: RAYDIUM_CLUSTER,
    disableFeatureCheck: true,
    disableLoadToken: false,
  });

  return raydiumInstance;
}

/**
 * Find the pool address for a token pair (Token/SOL)
 */
export async function findRaydiumPool(
  connection: Connection,
  tokenMint: PublicKey
): Promise<PublicKey | null> {
  try {
    const raydium = await getRaydium(connection);
    
    // WSOL (wrapped SOL) address
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    
    // Fetch pool info for this token pair
    const pools = await raydium.liquidity.getPoolInfoFromRpc({
      poolId: undefined, // Search all
    });

    // Find pool with our token and SOL
    const pool = pools.find((p) => 
      (p.mintA.equals(tokenMint) && p.mintB.equals(WSOL)) ||
      (p.mintA.equals(WSOL) && p.mintB.equals(tokenMint))
    );

    if (!pool) {
      console.log("No Raydium pool found for token:", tokenMint.toBase58());
      return null;
    }

    console.log("Found Raydium pool:", pool.id.toBase58());
    return new PublicKey(pool.id);
  } catch (error) {
    console.error("Error finding Raydium pool:", error);
    return null;
  }
}

/**
 * Buy tokens on Raydium (SOL → Token)
 */
export async function buyTokensOnRaydium(
  connection: Connection,
  wallet: WalletContextState,
  tokenMint: PublicKey,
  solAmount: number,
  slippageBps: number = 100 // 1% default slippage
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  try {
    console.log(`🔵 Buying tokens on Raydium: ${solAmount} SOL`);

    const raydium = await getRaydium(connection);
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    
    // Find the pool
    const poolAddress = await findRaydiumPool(connection, tokenMint);
    if (!poolAddress) {
      throw new Error("Raydium pool not found for this token");
    }

    // Get pool info
    const poolInfo = await raydium.liquidity.getRpcPoolInfo(poolAddress.toBase58());
    if (!poolInfo) {
      throw new Error("Could not fetch pool info");
    }

    // Determine input/output mints
    const inputMint = WSOL;
    const outputMint = tokenMint;
    const inputAmount = new Decimal(solAmount).mul(10 ** 9); // SOL has 9 decimals

    // Get swap quote
    const { execute, transaction } = await raydium.liquidity.swap({
      poolInfo,
      poolKeys: poolInfo,
      amountIn: inputAmount,
      amountOut: new Decimal(0), // Will be calculated
      fixedSide: "in",
      inputMint,
      outputMint,
      txVersion: TxVersion.V0,
      config: {
        bypassAssociatedCheck: false,
      },
      computeBudgetConfig: {
        units: 600000,
        microLamports: 1000000,
      },
    });

    console.log("Swap transaction prepared, sending...");

    // Sign and send
    const signedTx = await wallet.signTransaction(transaction as VersionedTransaction);
    const txId = await connection.sendTransaction(signedTx);
    
    console.log(`✅ Raydium swap successful: ${txId}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(txId, "confirmed");
    
    return txId;
  } catch (error: any) {
    console.error("Raydium buy error:", error);
    throw new Error(error.message || "Failed to buy tokens on Raydium");
  }
}

/**
 * Sell tokens on Raydium (Token → SOL)
 */
export async function sellTokensOnRaydium(
  connection: Connection,
  wallet: WalletContextState,
  tokenMint: PublicKey,
  tokenAmount: number,
  tokenDecimals: number = 6,
  slippageBps: number = 100 // 1% default slippage
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  try {
    console.log(`🔵 Selling tokens on Raydium: ${tokenAmount} tokens`);

    const raydium = await getRaydium(connection);
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    
    // Find the pool
    const poolAddress = await findRaydiumPool(connection, tokenMint);
    if (!poolAddress) {
      throw new Error("Raydium pool not found for this token");
    }

    // Get pool info
    const poolInfo = await raydium.liquidity.getRpcPoolInfo(poolAddress.toBase58());
    if (!poolInfo) {
      throw new Error("Could not fetch pool info");
    }

    // Determine input/output mints
    const inputMint = tokenMint;
    const outputMint = WSOL;
    const inputAmount = new Decimal(tokenAmount).mul(10 ** tokenDecimals);

    // Get swap quote
    const { execute, transaction } = await raydium.liquidity.swap({
      poolInfo,
      poolKeys: poolInfo,
      amountIn: inputAmount,
      amountOut: new Decimal(0), // Will be calculated
      fixedSide: "in",
      inputMint,
      outputMint,
      txVersion: TxVersion.V0,
      config: {
        bypassAssociatedCheck: false,
      },
      computeBudgetConfig: {
        units: 600000,
        microLamports: 1000000,
      },
    });

    console.log("Swap transaction prepared, sending...");

    // Sign and send
    const signedTx = await wallet.signTransaction(transaction as VersionedTransaction);
    const txId = await connection.sendTransaction(signedTx);
    
    console.log(`✅ Raydium swap successful: ${txId}`);
    
    // Wait for confirmation
    await connection.confirmTransaction(txId, "confirmed");
    
    return txId;
  } catch (error: any) {
    console.error("Raydium sell error:", error);
    throw new Error(error.message || "Failed to sell tokens on Raydium");
  }
}

/**
 * Get quote for buying tokens on Raydium
 */
export async function getRaydiumBuyQuote(
  connection: Connection,
  tokenMint: PublicKey,
  solAmount: number
): Promise<{ tokensOut: number; priceImpact: number } | null> {
  try {
    const raydium = await getRaydium(connection);
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    
    const poolAddress = await findRaydiumPool(connection, tokenMint);
    if (!poolAddress) return null;

    const poolInfo = await raydium.liquidity.getRpcPoolInfo(poolAddress.toBase58());
    if (!poolInfo) return null;

    const inputAmount = new Decimal(solAmount).mul(10 ** 9);

    // Compute output (simplified - actual calculation is more complex)
    const { amountOut, priceImpact } = await raydium.liquidity.computeAmountOut({
      poolInfo,
      amountIn: inputAmount,
      mintIn: WSOL,
      mintOut: tokenMint,
      slippage: 0.01, // 1%
    });

    return {
      tokensOut: amountOut.toNumber() / 10 ** 6, // Assuming 6 decimals
      priceImpact: priceImpact.toNumber(),
    };
  } catch (error) {
    console.error("Error getting Raydium quote:", error);
    return null;
  }
}

/**
 * Get quote for selling tokens on Raydium
 */
export async function getRaydiumSellQuote(
  connection: Connection,
  tokenMint: PublicKey,
  tokenAmount: number,
  tokenDecimals: number = 6
): Promise<{ solOut: number; priceImpact: number } | null> {
  try {
    const raydium = await getRaydium(connection);
    const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
    
    const poolAddress = await findRaydiumPool(connection, tokenMint);
    if (!poolAddress) return null;

    const poolInfo = await raydium.liquidity.getRpcPoolInfo(poolAddress.toBase58());
    if (!poolInfo) return null;

    const inputAmount = new Decimal(tokenAmount).mul(10 ** tokenDecimals);

    // Compute output
    const { amountOut, priceImpact } = await raydium.liquidity.computeAmountOut({
      poolInfo,
      amountIn: inputAmount,
      mintIn: tokenMint,
      mintOut: WSOL,
      slippage: 0.01, // 1%
    });

    return {
      solOut: amountOut.toNumber() / 10 ** 9, // SOL has 9 decimals
      priceImpact: priceImpact.toNumber(),
    };
  } catch (error) {
    console.error("Error getting Raydium quote:", error);
    return null;
  }
}

/**
 * Check if a Raydium pool exists for the token
 */
export async function hasRaydiumPool(
  connection: Connection,
  tokenMint: PublicKey
): Promise<boolean> {
  const pool = await findRaydiumPool(connection, tokenMint);
  return pool !== null;
}

