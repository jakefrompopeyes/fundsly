import { AnchorProvider, BN, Idl, Program, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import idlJson from "@/idl/fundly.json";

// SPL Token Program ID
const TOKEN_PROGRAM_ID = new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

// Associated Token Program ID
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// Program ID from IDL
const PROGRAM_ID = new web3.PublicKey(idlJson.address);

// Type assertion through unknown to handle IDL structure differences
// Ensure IDL has all required fields for Anchor 0.32.1
const idl = idlJson as unknown as Idl;

/**
 * Provides a thin wrapper to access the Anchor program from the Next.js app.
 * This expects the program to be deployed at the address in the IDL metadata.
 */
export async function getProgram(connection: Connection, wallet: WalletContextState) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  
  // Anchor expects a wallet with signTransaction/signAllTransactions
  // The wallet adapter context provides these methods directly
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: async (tx: any) => {
      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support signTransaction");
      }
      return await wallet.signTransaction(tx);
    },
    signAllTransactions: async (txs: any[]) => {
      if (!wallet.signAllTransactions) {
        throw new Error("Wallet does not support signAllTransactions");
      }
      return await wallet.signAllTransactions(txs);
    },
  };

  const provider = new AnchorProvider(connection, anchorWallet as any, {
    commitment: "confirmed",
  });
  
  // Use the local IDL directly - this ensures compatibility with the Anchor client
  const program = new Program(idl, provider);
  return { program, provider };
}

function getReadOnlyProgram(connection: Connection) {
  const dummyKeypair = web3.Keypair.generate();
  const dummyWallet = {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: "confirmed",
  });

  return new Program(idl, provider);
}

export async function deriveProjectPda(owner: web3.PublicKey, symbol: string) {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("project"), owner.toBuffer(), Buffer.from(symbol)],
    PROGRAM_ID,
  );
  return pda;
}

export async function checkProjectExists(
  connection: Connection,
  owner: web3.PublicKey,
  symbol: string,
) {
  const projectPda = await deriveProjectPda(owner, symbol);
  const accountInfo = await connection.getAccountInfo(projectPda);
  return accountInfo !== null;
}

export async function deriveMetadataPda(mint: web3.PublicKey) {
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  return pda;
}

/**
 * Fetches token metadata (name, symbol) from on-chain metadata account
 */
export async function fetchTokenMetadata(
  connection: Connection,
  mint: PublicKey
): Promise<{ name: string; symbol: string; uri: string } | null> {
  try {
    const metadataPda = await deriveMetadataPda(mint);
    const metadataAccount = await connection.getAccountInfo(metadataPda);
    
    if (!metadataAccount) {
      return null;
    }

    // Parse Metaplex metadata format
    // Metadata structure: key (1 byte) + update_authority (32 bytes) + mint (32 bytes) + data...
    const data = metadataAccount.data;
    
    // Skip key (1 byte) + update authority (32 bytes) + mint (32 bytes) = 65 bytes
    let offset = 65;
    
    // Read name length (4 bytes)
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    
    // Read name
    const name = data.slice(offset, offset + nameLen).toString('utf8').replace(/\0/g, '');
    offset += nameLen;
    
    // Read symbol length (4 bytes)
    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    
    // Read symbol
    const symbol = data.slice(offset, offset + symbolLen).toString('utf8').replace(/\0/g, '');
    offset += symbolLen;

    // Read URI length and value
    const uriLen = data.readUInt32LE(offset);
    offset += 4;
    const uri = data.slice(offset, offset + uriLen).toString("utf8").replace(/\0/g, "");
    
    return { name, symbol, uri };
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return null;
  }
}

/**
 * Creates a metadata JSON object following Metaplex standards
 */
export function createMetadataJson(
  name: string,
  description: string,
  imageUrl: string,
  website: string,
  twitter: string,
  discord: string,
  category: string,
  totalSupply: string,
  symbol: string
) {
  return {
    name,
    symbol,
    description,
    image: imageUrl,
    external_url: website || "",
    attributes: [
      {
        trait_type: "Category",
        value: category,
      },
      {
        trait_type: "Total Supply",
        value: totalSupply,
      },
    ],
    properties: {
      category,
      files: [
        {
          uri: imageUrl,
          type: "image/png",
        },
      ],
      links: {
        website: website || "",
        twitter: twitter || "",
        discord: discord || "",
      },
    },
  };
}

export async function fetchProjectByMint(
  connection: Connection,
  mint: PublicKey,
) {
  try {
    const program = getReadOnlyProgram(connection);
    const results = await (program.account as any).projectState.all([
      {
        memcmp: {
          offset: 8 + 32, // discriminator + owner
          bytes: mint.toBase58(),
        },
      },
    ]);

    if (!results || results.length === 0) {
      return null;
    }

    return results[0];
  } catch (error) {
    console.error("Error fetching project by mint:", error);
    return null;
  }
}

export async function fetchBondingCurveReadonly(
  connection: Connection,
  mint: PublicKey,
) {
  try {
    const program = getReadOnlyProgram(connection);
    const bondingCurvePda = await deriveBondingCurvePda(mint);
    return await (program.account as any).bondingCurve.fetch(bondingCurvePda);
  } catch (error) {
    console.error("Error fetching bonding curve (read-only):", error);
    return null;
  }
}

export async function rpc_initializeProject(
  connection: Connection,
  wallet: WalletContextState,
  name: string,
  symbol: string,
  totalSupply: number,
  category: string,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  
  // Check if project already exists
  const projectExists = await checkProjectExists(connection, wallet.publicKey, symbol);
  if (projectExists) {
    throw new Error(`A project with symbol "${symbol}" already exists for your wallet. Please use a different symbol.`);
  }
  
  const { program } = await getProgram(connection, wallet);
  const owner = wallet.publicKey;
  const projectPda = await deriveProjectPda(owner, symbol);

  const totalSupplyBN = new BN(totalSupply);

  return program.methods
    .initializeProject(name, symbol, totalSupplyBN, category)
    .accounts({
      projectState: projectPda,
      owner,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
}

/**
 * Fetches all projects created by a specific owner
 */
export async function fetchUserProjects(
  connection: Connection,
  wallet: WalletContextState,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  
  const { program } = await getProgram(connection, wallet);
  
  // Fetch all ProjectState accounts where owner matches the wallet
  const projects = await (program.account as any).projectState.all([
    {
      memcmp: {
        offset: 8, // Discriminator is 8 bytes
        bytes: wallet.publicKey.toBase58(),
      },
    },
  ]);
  
  return projects.map((project: any) => ({
    publicKey: project.publicKey,
    account: project.account,
  }));
}

export async function rpc_createMint(
  connection: Connection,
  wallet: WalletContextState,
  symbol: string,
  name: string,
  description: string,
  imageUrl: string,
  website: string,
  twitter: string,
  discord: string,
  category: string,
  totalSupply: string,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  const owner = wallet.publicKey;
  const projectPda = await deriveProjectPda(owner, symbol);
  const mintKeypair = web3.Keypair.generate();
  const metadataPda = await deriveMetadataPda(mintKeypair.publicKey);

  // Derive the associated token account for the owner
  const [ownerTokenAccount] = web3.PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Create metadata JSON structure
  // Format total supply for display (divide by 10^6 for 6 decimals)
  const totalSupplyFormatted = "999,999,999.999999";
  
  const metadataJson = createMetadataJson(
    name,
    description,
    imageUrl,
    website,
    twitter,
    discord,
    category,
    totalSupplyFormatted,
    symbol
  );

  // For now, we'll use the image URL as the URI
  // In production, you should upload the full metadata JSON to Arweave/IPFS
  // and use that URI instead
  const metadataUri = imageUrl;

  console.log("Metadata JSON (for future Arweave upload):", metadataJson);

  await program.methods
    .createMint(name, symbol, metadataUri)
    .accounts({
      projectState: projectPda,
      mint: mintKeypair.publicKey,
      metadata: metadataPda,
      ownerTokenAccount: ownerTokenAccount,
      owner,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKeypair])
    .rpc();

  return mintKeypair.publicKey;
}

/**
 * Derive the global config PDA
 */
export async function deriveGlobalConfigPda() {
  const programId = new web3.PublicKey((idl as any).address || "H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC");
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    programId,
  );
  return pda;
}

/**
 * Derive the bonding curve PDA for a mint
 */
export async function deriveBondingCurvePda(mint: web3.PublicKey) {
  const programId = new web3.PublicKey((idl as any).address || "H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC");
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    programId,
  );
  return pda;
}

/**
 * Derive the SOL vault PDA for a mint
 */
export async function deriveSolVaultPda(mint: web3.PublicKey) {
  const programId = new web3.PublicKey((idl as any).address || "H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC");
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("sol_vault"), mint.toBuffer()],
    programId,
  );
  return pda;
}

/**
 * Initialize the global configuration (should be done once by admin)
 */
export async function rpc_initializeGlobalConfig(
  connection: Connection,
  wallet: WalletContextState,
  treasury: PublicKey, // Treasury address for automatic fee collection
  virtualSolReserves: number, // in SOL
  virtualTokenReserves: number, // in tokens
  initialTokenSupply: number, // in tokens
  feeBasisPoints: number, // 100 = 1%
  migrationThresholdSol: number = 85, // SOL threshold for migration (default 85)
  raydiumAmmProgram?: PublicKey, // Raydium AMM program ID (optional)
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  
  const globalConfigPda = await deriveGlobalConfigPda();
  
  // Convert SOL to lamports and tokens to raw units (6 decimals)
  const virtualSolLamports = new BN(virtualSolReserves * web3.LAMPORTS_PER_SOL);
  const virtualTokenRaw = new BN(virtualTokenReserves * 1_000_000);
  const initialTokenSupplyRaw = new BN(initialTokenSupply * 1_000_000);
  const migrationThresholdLamports = new BN(migrationThresholdSol * web3.LAMPORTS_PER_SOL);
  
  // Default Raydium AMM program ID if not provided
  const raydiumProgram = raydiumAmmProgram || new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

  return program.methods
    .initializeGlobalConfig(
      treasury,
      virtualSolLamports,
      virtualTokenRaw,
      initialTokenSupplyRaw,
      feeBasisPoints,
      migrationThresholdLamports,
      raydiumProgram,
    )
    .accounts({
      globalConfig: globalConfigPda,
      authority: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
}

/**
 * Update global configuration (admin only)
 * Pass null for any parameter you don't want to change
 */
export async function rpc_updateGlobalConfig(
  connection: Connection,
  wallet: WalletContextState,
  treasury?: PublicKey | null,
  virtualSolReserves?: number | null,
  virtualTokenReserves?: number | null,
  initialTokenSupply?: number | null,
  feeBasisPoints?: number | null,
  migrationThresholdSol?: number | null,
  raydiumAmmProgram?: PublicKey | null,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  
  const globalConfigPda = await deriveGlobalConfigPda();
  
  // Convert values to proper format, keeping null as null
  const virtualSolLamports = virtualSolReserves !== null && virtualSolReserves !== undefined
    ? new BN(virtualSolReserves * web3.LAMPORTS_PER_SOL)
    : null;
  const virtualTokenRaw = virtualTokenReserves !== null && virtualTokenReserves !== undefined
    ? new BN(virtualTokenReserves * 1_000_000)
    : null;
  const initialTokenSupplyRaw = initialTokenSupply !== null && initialTokenSupply !== undefined
    ? new BN(initialTokenSupply * 1_000_000)
    : null;
  const migrationThresholdLamports = migrationThresholdSol !== null && migrationThresholdSol !== undefined
    ? new BN(migrationThresholdSol * web3.LAMPORTS_PER_SOL)
    : null;

  return program.methods
    .updateGlobalConfig(
      treasury || null,
      virtualSolLamports,
      virtualTokenRaw,
      initialTokenSupplyRaw,
      feeBasisPoints !== null && feeBasisPoints !== undefined ? feeBasisPoints : null,
      migrationThresholdLamports,
      raydiumAmmProgram || null,
    )
    .accounts({
      globalConfig: globalConfigPda,
      authority: wallet.publicKey,
    })
    .rpc();
}

/**
 * Initialize a bonding curve for a token
 */
export async function rpc_initializeBondingCurve(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  tokenSupply: number | BN, // in tokens OR raw units as BN
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  const solVaultPda = await deriveSolVaultPda(mint);
  const globalConfigPda = await deriveGlobalConfigPda();
  
  // Get associated token account for bonding curve
  const bondingCurveAta = await getAssociatedTokenAddress(
    mint,
    bondingCurvePda,
    true, // allowOwnerOffCurve
  );
  // Creator's token account (holds the freshly minted supply)
  const creatorAta = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey,
  );
  
  // Convert tokens to raw units (6 decimals) if needed
  const tokenSupplyRaw = BN.isBN(tokenSupply) 
    ? tokenSupply 
    : new BN(Math.floor(tokenSupply * 1_000_000));

  return program.methods
    .initializeBondingCurve(tokenSupplyRaw)
    .accounts({
      bondingCurve: bondingCurvePda,
      mint,
      solVault: solVaultPda,
      bondingCurveTokenAccount: bondingCurveAta,
      creatorTokenAccount: creatorAta,
      globalConfig: globalConfigPda,
      creator: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}

/**
 * Buy tokens from the bonding curve
 */
export async function rpc_buyTokens(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  solAmount: number, // in SOL
  slippageTolerance: number = 0.01, // 1% default
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  const solVaultPda = await deriveSolVaultPda(mint);
  const globalConfigPda = await deriveGlobalConfigPda();
  
  // Get associated token accounts
  const bondingCurveAta = await getAssociatedTokenAddress(
    mint,
    bondingCurvePda,
    true,
  );
  const buyerAta = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey,
  );
  
  // Fetch bonding curve state and global config to calculate expected tokens
  const bondingCurveAccount = await (program.account as any).bondingCurve.fetch(bondingCurvePda);
  const globalConfig = await (program.account as any).globalConfig.fetch(globalConfigPda);
  
  // Calculate expected tokens out (pass fee basis points from global config)
  const solAmountLamports = solAmount * web3.LAMPORTS_PER_SOL;
  const expectedTokens = calculateBuyTokensOut(bondingCurveAccount, solAmountLamports, globalConfig.feeBasisPoints);
  const minTokensOut = new BN(expectedTokens * (1 - slippageTolerance));

  return program.methods
    .buyTokens(new BN(solAmountLamports), minTokensOut)
    .accounts({
      bondingCurve: bondingCurvePda,
      mint,
      bondingCurveSolVault: solVaultPda,
      bondingCurveTokenAccount: bondingCurveAta,
      buyerTokenAccount: buyerAta,
      globalConfig: globalConfigPda,
      buyer: wallet.publicKey,
      treasury: globalConfig.treasury, // Treasury receives fees automatically
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Sell tokens back to the bonding curve
 */
export async function rpc_sellTokens(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  tokenAmount: number, // in tokens
  slippageTolerance: number = 0.01, // 1% default
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  const solVaultPda = await deriveSolVaultPda(mint);
  const globalConfigPda = await deriveGlobalConfigPda();
  
  // Get associated token accounts
  const bondingCurveAta = await getAssociatedTokenAddress(
    mint,
    bondingCurvePda,
    true,
  );
  const sellerAta = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey,
  );
  
  // Fetch bonding curve state and global config to calculate expected SOL
  const bondingCurveAccount = await (program.account as any).bondingCurve.fetch(bondingCurvePda);
  const globalConfig = await (program.account as any).globalConfig.fetch(globalConfigPda);
  
  // Calculate expected SOL out (pass fee basis points from global config)
  const tokenAmountRaw = tokenAmount * 1_000_000;
  const expectedSol = calculateSellSolOut(bondingCurveAccount, tokenAmountRaw, globalConfig.feeBasisPoints);
  const minSolOut = new BN(expectedSol * (1 - slippageTolerance));

  return program.methods
    .sellTokens(new BN(tokenAmountRaw), minSolOut)
    .accounts({
      bondingCurve: bondingCurvePda,
      mint,
      bondingCurveSolVault: solVaultPda,
      bondingCurveTokenAccount: bondingCurveAta,
      sellerTokenAccount: sellerAta,
      globalConfig: globalConfigPda,
      seller: wallet.publicKey,
      treasury: globalConfig.treasury, // Treasury receives fees automatically
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Calculate expected tokens out for a buy operation
 * NOTE: This function accounts for fees - the solAmountLamports includes the fee
 */
function calculateBuyTokensOut(bondingCurve: any, solAmountLamports: number, feeBasisPoints: number = 100): number {
  const virtualSol = bondingCurve.virtualSolReserves.toNumber();
  const virtualToken = bondingCurve.virtualTokenReserves.toNumber();
  const realSol = bondingCurve.realSolReserves.toNumber();
  const realToken = bondingCurve.realTokenReserves.toNumber();
  
  // Calculate fee and SOL amount after fee (matching Rust implementation)
  const fee = Math.floor((solAmountLamports * feeBasisPoints) / 10000);
  const solAfterFee = solAmountLamports - fee;
  
  const totalSolBefore = virtualSol + realSol;
  const totalTokenBefore = virtualToken + realToken;
  const k = totalSolBefore * totalTokenBefore;
  
  // Use solAfterFee in the calculation (not full amount)
  const totalSolAfter = totalSolBefore + solAfterFee;
  const totalTokenAfter = k / totalSolAfter;
  const tokensOut = totalTokenBefore - totalTokenAfter;
  
  return tokensOut;
}

/**
 * Calculate expected SOL out for a sell operation
 * NOTE: This function accounts for fees - returns SOL after fee deduction
 */
function calculateSellSolOut(bondingCurve: any, tokenAmountRaw: number, feeBasisPoints: number = 100): number {
  const virtualSol = bondingCurve.virtualSolReserves.toNumber();
  const virtualToken = bondingCurve.virtualTokenReserves.toNumber();
  const realSol = bondingCurve.realSolReserves.toNumber();
  const realToken = bondingCurve.realTokenReserves.toNumber();
  
  const totalSolBefore = virtualSol + realSol;
  const totalTokenBefore = virtualToken + realToken;
  const k = totalSolBefore * totalTokenBefore;
  
  const totalTokenAfter = totalTokenBefore + tokenAmountRaw;
  const totalSolAfter = k / totalTokenAfter;
  const solOutBeforeFee = totalSolBefore - totalSolAfter;
  
  // Apply fee (matching Rust implementation)
  const fee = Math.floor((solOutBeforeFee * feeBasisPoints) / 10000);
  const solOut = solOutBeforeFee - fee;
  
  return solOut;
}

/**
 * Fetch bonding curve state
 */
export async function fetchBondingCurve(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
) {
  const { program } = await getProgram(connection, wallet);
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  return (program.account as any).bondingCurve.fetch(bondingCurvePda);
}

/**
 * Fetch global config
 */
export async function fetchGlobalConfig(
  connection: Connection,
  wallet: WalletContextState,
) {
  const { program } = await getProgram(connection, wallet);
  const globalConfigPda = await deriveGlobalConfigPda();
  return (program.account as any).globalConfig.fetch(globalConfigPda);
}

/**
 * Migrate bonding curve to Raydium when threshold is reached
 * Takes a 6 SOL migration fee that goes to the treasury
 */
export async function rpc_migrateToRaydium(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);
  
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  const solVaultPda = await deriveSolVaultPda(mint);
  const bondingCurveTokenAccount = await getAssociatedTokenAddress(
    mint,
    bondingCurvePda,
    true,
  );
  const globalConfigPda = await deriveGlobalConfigPda();
  
  // Fetch global config to get treasury address
  const globalConfig = await (program.account as any).globalConfig.fetch(globalConfigPda);
  const treasury = globalConfig.treasury;
  
  // Derive migration vault PDAs
  const [migrationSolVault] = await web3.PublicKey.findProgramAddress(
    [Buffer.from("migration_vault"), mint.toBuffer()],
    PROGRAM_ID
  );
  
  const [migrationAuthority] = await web3.PublicKey.findProgramAddress(
    [Buffer.from("migration_authority")],
    PROGRAM_ID
  );
  
  const migrationTokenAccount = await getAssociatedTokenAddress(
    mint,
    migrationAuthority,
    true,
  );

  console.log("Migration vault addresses:");
  console.log("- SOL vault:", migrationSolVault.toBase58());
  console.log("- Token account:", migrationTokenAccount.toBase58());
  console.log("- Authority:", migrationAuthority.toBase58());
  console.log("- Treasury:", treasury.toBase58());
  console.log("⚠️ Migration fee: 6 SOL will be sent to treasury");

  return program.methods
    .migrateToRaydium()
    .accounts({
      bondingCurve: bondingCurvePda,
      mint: mint,
      bondingCurveSolVault: solVaultPda,
      bondingCurveTokenAccount: bondingCurveTokenAccount,
      migrationSolVault: migrationSolVault,
      migrationTokenAccount: migrationTokenAccount,
      migrationAuthority: migrationAuthority,
      globalConfig: globalConfigPda,
      payer: wallet.publicKey,
      treasury: treasury,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();
}

/**
 * Check if bonding curve has reached migration threshold
 */
export async function checkMigrationThreshold(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
): Promise<{ reached: boolean; progress: number }> {
  const bondingCurve = await fetchBondingCurve(connection, wallet, mint);
  const globalConfig = await fetchGlobalConfig(connection, wallet);
  
  const realSolReserves = bondingCurve.realSolReserves.toNumber();
  const migrationThreshold = globalConfig.migrationThresholdSol.toNumber();
  
  const progress = (realSolReserves / migrationThreshold) * 100;
  const reached = realSolReserves >= migrationThreshold;
  
  return { reached, progress: Math.min(progress, 100) };
}

/**
 * ==========================================
 * VESTING FUNCTIONS
 * ==========================================
 */

/**
 * Derive the vesting schedule PDA for a creator and mint
 */
export async function deriveVestingSchedulePda(
  mint: web3.PublicKey,
  beneficiary: web3.PublicKey,
) {
  const [pda, bump] = await web3.PublicKey.findProgramAddress(
    [Buffer.from("vesting"), mint.toBuffer(), beneficiary.toBuffer()],
    PROGRAM_ID,
  );
  return { pda, bump };
}

/**
 * Initialize a vesting schedule for creator tokens
 * @param totalAmount - Total tokens to vest (with decimals)
 * @param startTime - Unix timestamp when vesting starts
 * @param cliffDuration - Seconds before any tokens unlock (e.g., 30 days = 2592000)
 * @param vestingDuration - Total vesting period in seconds (e.g., 12 months = 31104000)
 * @param releaseInterval - How often tokens unlock in seconds (e.g., monthly = 2592000)
 */
export async function rpc_initializeVesting(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  totalAmount: BN,
  startTime: BN,
  cliffDuration: BN,
  vestingDuration: BN,
  releaseInterval: BN,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);

  const { pda: vestingSchedule } = await deriveVestingSchedulePda(mint, wallet.publicKey);
  const vestingVault = await getAssociatedTokenAddress(mint, vestingSchedule, true);

  const tx = await program.methods
    .initializeVesting(
      totalAmount,
      startTime,
      cliffDuration,
      vestingDuration,
      releaseInterval,
    )
    .accounts({
      vestingSchedule,
      mint,
      vestingVault,
      creator: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { signature: tx, vestingSchedule, vestingVault };
}

/**
 * Claim vested tokens that have unlocked
 */
export async function rpc_claimVestedTokens(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);

  const { pda: vestingSchedule } = await deriveVestingSchedulePda(mint, wallet.publicKey);
  const vestingVault = await getAssociatedTokenAddress(mint, vestingSchedule, true);
  const beneficiaryTokenAccount = await getAssociatedTokenAddress(mint, wallet.publicKey);

  const tx = await program.methods
    .claimVestedTokens()
    .accounts({
      vestingSchedule,
      mint,
      vestingVault,
      beneficiaryTokenAccount,
      beneficiary: wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { signature: tx };
}

/**
 * Fetch vesting schedule details
 */
export async function fetchVestingSchedule(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  beneficiary?: web3.PublicKey,
) {
  const { program } = await getProgram(connection, wallet);
  const beneficiaryKey = beneficiary || wallet.publicKey;
  if (!beneficiaryKey) throw new Error("Beneficiary not provided");

  const { pda: vestingSchedule } = await deriveVestingSchedulePda(mint, beneficiaryKey);
  
  try {
    const account = await (program.account as any).vestingSchedule.fetch(vestingSchedule);
    return account;
  } catch (error) {
    return null; // Vesting schedule doesn't exist
  }
}

/**
 * Calculate claimable tokens based on current time
 */
export function calculateClaimableTokens(
  vestingSchedule: any,
  currentTime: number,
): { unlocked: number; claimed: number; claimable: number } {
  const startTime = vestingSchedule.startTime.toNumber();
  const cliffTime = vestingSchedule.cliffTime.toNumber();
  const endTime = vestingSchedule.endTime.toNumber();
  const totalAmount = vestingSchedule.totalAmount.toNumber();
  const claimedAmount = vestingSchedule.claimedAmount.toNumber();

  // If cliff hasn't been reached
  if (currentTime < cliffTime) {
    return {
      unlocked: 0,
      claimed: claimedAmount,
      claimable: 0,
    };
  }

  // If fully vested
  if (currentTime >= endTime) {
    return {
      unlocked: totalAmount,
      claimed: claimedAmount,
      claimable: totalAmount - claimedAmount,
    };
  }

  // Linear vesting
  const vestingDuration = endTime - startTime;
  const elapsedTime = currentTime - startTime;
  const unlocked = Math.floor((totalAmount * elapsedTime) / vestingDuration);
  const claimable = Math.max(0, unlocked - claimedAmount);

  return {
    unlocked,
    claimed: claimedAmount,
    claimable,
  };
}

/**
 * Helper function to create common vesting schedules
 */
export const VestingPresets = {
  // 1 month cliff, 12 month total vesting, monthly unlocks
  standard12Month: (startTime: number) => ({
    startTime: new BN(startTime),
    cliffDuration: new BN(30 * 24 * 60 * 60), // 30 days
    vestingDuration: new BN(365 * 24 * 60 * 60), // 12 months
    releaseInterval: new BN(30 * 24 * 60 * 60), // Monthly
  }),
  
  // 3 month cliff, 24 month total vesting, monthly unlocks
  extended24Month: (startTime: number) => ({
    startTime: new BN(startTime),
    cliffDuration: new BN(90 * 24 * 60 * 60), // 90 days
    vestingDuration: new BN(730 * 24 * 60 * 60), // 24 months
    releaseInterval: new BN(30 * 24 * 60 * 60), // Monthly
  }),
  
  // No cliff, 6 month vesting, weekly unlocks
  quickVest6Month: (startTime: number) => ({
    startTime: new BN(startTime),
    cliffDuration: new BN(0), // No cliff
    vestingDuration: new BN(180 * 24 * 60 * 60), // 6 months
    releaseInterval: new BN(7 * 24 * 60 * 60), // Weekly
  }),
  
  // Custom vesting
  custom: (startTime: number, cliffDays: number, vestingMonths: number, intervalDays: number) => ({
    startTime: new BN(startTime),
    cliffDuration: new BN(cliffDays * 24 * 60 * 60),
    vestingDuration: new BN(vestingMonths * 30 * 24 * 60 * 60),
    releaseInterval: new BN(intervalDays * 24 * 60 * 60),
  }),
};

/**
 * Withdraw accumulated platform fees from a bonding curve vault
 * Only callable by the platform authority
 */
export async function rpc_withdrawPlatformFees(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
  treasury: web3.PublicKey,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = await getProgram(connection, wallet);

  const bondingCurvePda = await deriveBondingCurvePda(mint);
  const solVaultPda = await deriveSolVaultPda(mint);
  const globalConfigPda = await deriveGlobalConfigPda();

  const tx = await (program.methods as any)
    .withdrawPlatformFees()
    .accounts({
      bondingCurve: bondingCurvePda,
      mint: mint,
      bondingCurveSolVault: solVaultPda,
      globalConfig: globalConfigPda,
      authority: wallet.publicKey,
      treasury: treasury,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  return tx;
}

/**
 * Calculate accumulated fees for a bonding curve
 */
export async function calculateAccumulatedFees(
  connection: Connection,
  wallet: WalletContextState,
  mint: web3.PublicKey,
) {
  const bondingCurvePda = await deriveBondingCurvePda(mint);
  const solVaultPda = await deriveSolVaultPda(mint);
  
  // Fetch vault balance
  const vaultBalance = await connection.getBalance(solVaultPda);
  
  // Fetch bonding curve state
  const bondingCurve = await fetchBondingCurve(connection, wallet, mint);
  const realSolReserves = bondingCurve.realSolReserves.toNumber();
  
  // Rent exempt minimum for PDA (typically ~890880 lamports)
  const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(0);
  
  // Calculate accumulated fees
  const accumulatedFees = Math.max(0, vaultBalance - realSolReserves - rentExemptMinimum);
  
  return {
    vaultBalance,
    realSolReserves,
    rentExemptMinimum,
    accumulatedFees,
    accumulatedFeesSOL: accumulatedFees / web3.LAMPORTS_PER_SOL,
  };
}


