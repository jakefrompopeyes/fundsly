/**
 * Diagnostic script to identify token issues
 * Run this to check which tokens have problems with metadata or bonding curves
 * 
 * Usage:
 *   npx ts-node --project frontend/tsconfig.json frontend/scripts/diagnose-token-issues.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import idlJson from '../src/idl/fundly.json';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';

interface DiagnosticResult {
  mint: string;
  projectExists: boolean;
  metadataExists: boolean;
  metadataValid: boolean;
  bondingCurveExists: boolean;
  errors: string[];
}

async function deriveMetadataPda(mint: PublicKey): Promise<PublicKey> {
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

async function deriveBondingCurvePda(mint: PublicKey): Promise<PublicKey> {
  const programId = new PublicKey(idlJson.address);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bonding_curve'), mint.toBuffer()],
    programId
  );
  return pda;
}

async function checkMetadata(connection: Connection, mint: PublicKey): Promise<{ exists: boolean; valid: boolean; error?: string }> {
  try {
    const metadataPda = await deriveMetadataPda(mint);
    const metadataAccount = await connection.getAccountInfo(metadataPda);
    
    if (!metadataAccount) {
      return { exists: false, valid: false, error: 'Metadata account does not exist' };
    }

    const data = metadataAccount.data;
    
    // Basic validation
    if (data.length < 65) {
      return { exists: true, valid: false, error: `Buffer too small: ${data.length} bytes` };
    }
    
    let offset = 65;
    
    // Try to read name length
    if (offset + 4 > data.length) {
      return { exists: true, valid: false, error: 'Cannot read name length' };
    }
    const nameLen = data.readUInt32LE(offset);
    offset += 4;
    
    if (nameLen > 32 || offset + nameLen > data.length) {
      return { exists: true, valid: false, error: `Invalid name length: ${nameLen}` };
    }
    
    offset += nameLen;
    
    // Try to read symbol length
    if (offset + 4 > data.length) {
      return { exists: true, valid: false, error: 'Cannot read symbol length' };
    }
    const symbolLen = data.readUInt32LE(offset);
    offset += 4;
    
    if (symbolLen > 10 || offset + symbolLen > data.length) {
      return { exists: true, valid: false, error: `Invalid symbol length: ${symbolLen}` };
    }
    
    return { exists: true, valid: true };
  } catch (error: any) {
    return { exists: false, valid: false, error: error.message };
  }
}

async function diagnoseTokens() {
  console.log('🔍 Starting token diagnostics...\n');
  console.log(`RPC URL: ${RPC_URL}\n`);
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const programId = new PublicKey(idlJson.address);
  
  // Create a dummy wallet for read-only operations
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };
  
  const provider = new AnchorProvider(connection, dummyWallet as any, { commitment: 'confirmed' });
  const program = new Program(idlJson as any, provider);
  
  // Fetch all projects
  console.log('📦 Fetching all projects...');
  const projects = await (program.account as any).projectState.all();
  console.log(`Found ${projects.length} projects\n`);
  
  const results: DiagnosticResult[] = [];
  
  for (const project of projects) {
    const account = project.account as any;
    const mint = account.mint;
    
    // Skip if mint is not set
    if (mint.equals(PublicKey.default)) {
      console.log(`⏭️  Skipping project ${project.publicKey.toBase58()} - mint not set`);
      continue;
    }
    
    const mintStr = mint.toBase58();
    console.log(`\n📍 Checking mint: ${mintStr}`);
    
    const result: DiagnosticResult = {
      mint: mintStr,
      projectExists: true,
      metadataExists: false,
      metadataValid: false,
      bondingCurveExists: false,
      errors: [],
    };
    
    // Check metadata
    console.log('  📝 Checking metadata...');
    const metadataCheck = await checkMetadata(connection, mint);
    result.metadataExists = metadataCheck.exists;
    result.metadataValid = metadataCheck.valid;
    
    if (!metadataCheck.exists) {
      console.log(`  ❌ Metadata does not exist`);
      result.errors.push('Metadata account missing');
    } else if (!metadataCheck.valid) {
      console.log(`  ⚠️  Metadata invalid: ${metadataCheck.error}`);
      result.errors.push(`Metadata invalid: ${metadataCheck.error}`);
    } else {
      console.log(`  ✅ Metadata valid`);
    }
    
    // Check bonding curve
    console.log('  📈 Checking bonding curve...');
    try {
      const bondingCurvePda = await deriveBondingCurvePda(mint);
      const bondingCurve = await (program.account as any).bondingCurve.fetch(bondingCurvePda);
      
      if (bondingCurve) {
        result.bondingCurveExists = true;
        console.log(`  ✅ Bonding curve exists`);
      }
    } catch (error: any) {
      console.log(`  ❌ Bonding curve does not exist or error: ${error.message}`);
      result.errors.push('Bonding curve missing');
    }
    
    results.push(result);
  }
  
  // Summary
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════\n');
  
  const tokensWithIssues = results.filter(r => r.errors.length > 0);
  const tokensOK = results.filter(r => r.errors.length === 0);
  
  console.log(`✅ Tokens OK: ${tokensOK.length}`);
  console.log(`⚠️  Tokens with issues: ${tokensWithIssues.length}\n`);
  
  if (tokensWithIssues.length > 0) {
    console.log('Tokens with issues:\n');
    tokensWithIssues.forEach(result => {
      console.log(`🔴 ${result.mint}`);
      result.errors.forEach(error => {
        console.log(`   - ${error}`);
      });
      console.log('');
    });
  }
  
  // Specific recommendations
  console.log('\n═══════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════\n');
  
  const missingMetadata = tokensWithIssues.filter(r => !r.metadataExists);
  const invalidMetadata = tokensWithIssues.filter(r => r.metadataExists && !r.metadataValid);
  const missingBondingCurve = tokensWithIssues.filter(r => !r.bondingCurveExists);
  
  if (missingMetadata.length > 0) {
    console.log(`📝 ${missingMetadata.length} token(s) missing metadata:`);
    console.log('   → These tokens were created but metadata was not initialized properly');
    console.log('   → Run create_mint again or manually create metadata\n');
  }
  
  if (invalidMetadata.length > 0) {
    console.log(`⚠️  ${invalidMetadata.length} token(s) have invalid metadata:`);
    console.log('   → The metadata accounts exist but contain malformed data');
    console.log('   → This is causing the "Trying to access beyond buffer length" error');
    console.log('   → These tokens need to be recreated or metadata needs to be fixed\n');
    invalidMetadata.forEach(r => {
      console.log(`      - ${r.mint}`);
    });
    console.log('');
  }
  
  if (missingBondingCurve.length > 0) {
    console.log(`📈 ${missingBondingCurve.length} token(s) missing bonding curves:`);
    console.log('   → These tokens have projects but InitializeBondingCurve was never called');
    console.log('   → Call InitializeBondingCurve for these tokens to enable trading\n');
  }
  
  console.log('═══════════════════════════════════════════\n');
}

// Run diagnostics
diagnoseTokens()
  .then(() => {
    console.log('✅ Diagnostics complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostics failed:', error);
    process.exit(1);
  });


