use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{Mint, Token, TokenAccount, MintTo, Transfer, Burn, mint_to, transfer, burn};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{
    create_metadata_accounts_v3,
    mpl_token_metadata::types::DataV2,
    CreateMetadataAccountsV3, Metadata,
};

declare_id!("5dtdAtkPad7cnAtBq8QLy6mfVbtb81pTrg5gCYxfUCgK");

#[program]
pub mod fundly {
    use super::*;

    pub fn initialize_project(
        ctx: Context<InitializeProject>,
        name: String,
        symbol: String,
        total_supply: u64,
        category: String,
    ) -> Result<()> {
        let state = &mut ctx.accounts.project_state;
        state.owner = ctx.accounts.owner.key();
        state.mint = Pubkey::default();
        state.name = name;
        state.symbol = symbol;
        state.created_at = Clock::get()?.unix_timestamp;
        state.total_supply = total_supply;
        state.category = category;
        Ok(())
    }

    pub fn create_mint(
        ctx: Context<CreateMint>,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        // Record the mint on the state account
        let state = &mut ctx.accounts.project_state;
        state.mint = ctx.accounts.mint.key();

        // Create metadata account
        let data_v2 = DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let cpi_context = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.owner.to_account_info(),
                payer: ctx.accounts.owner.to_account_info(),
                update_authority: ctx.accounts.owner.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
        );

        create_metadata_accounts_v3(cpi_context, data_v2, true, true, None)?;

        // Mint the initial supply (999,999,999.999999 tokens with 6 decimals)
        // The total_supply is already in raw token units (includes decimals)
        let amount_with_decimals = state.total_supply;

        let mint_cpi_context = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );

        mint_to(mint_cpi_context, amount_with_decimals)?;

        Ok(())
    }

    /// Initialize a vesting schedule for creator tokens
    /// This locks tokens and releases them over time to prevent rug pulls
    pub fn initialize_vesting(
        ctx: Context<InitializeVesting>,
        total_amount: u64,
        start_time: i64,
        cliff_duration: i64,    // Time before any tokens unlock (e.g., 30 days)
        vesting_duration: i64,  // Total vesting period (e.g., 12 months)
        release_interval: i64,  // How often tokens unlock (e.g., every month)
    ) -> Result<()> {
        require!(total_amount > 0, ErrorCode::InvalidAmount);
        require!(vesting_duration > 0, ErrorCode::InvalidVestingDuration);
        require!(cliff_duration < vesting_duration, ErrorCode::InvalidCliffDuration);

        let vesting_schedule = &mut ctx.accounts.vesting_schedule;
        vesting_schedule.beneficiary = ctx.accounts.creator.key();
        vesting_schedule.mint = ctx.accounts.mint.key();
        vesting_schedule.total_amount = total_amount;
        vesting_schedule.claimed_amount = 0;
        vesting_schedule.start_time = start_time;
        vesting_schedule.cliff_time = start_time.checked_add(cliff_duration).unwrap();
        vesting_schedule.end_time = start_time.checked_add(vesting_duration).unwrap();
        vesting_schedule.release_interval = release_interval;
        vesting_schedule.last_claim_time = start_time;
        vesting_schedule.bump = ctx.bumps.vesting_schedule;

        Ok(())
    }

    /// Claim vested tokens that have unlocked
    pub fn claim_vested_tokens(
        ctx: Context<ClaimVestedTokens>,
    ) -> Result<()> {
        let vesting_schedule = &ctx.accounts.vesting_schedule;
        let current_time = Clock::get()?.unix_timestamp;

        // Check if cliff period has passed
        require!(current_time >= vesting_schedule.cliff_time, ErrorCode::CliffNotReached);

        // Calculate how many tokens are unlocked
        let unlocked_amount = calculate_unlocked_amount(vesting_schedule, current_time)?;
        let claimable_amount = unlocked_amount
            .checked_sub(vesting_schedule.claimed_amount)
            .ok_or(ErrorCode::NoTokensToCllaim)?;

        require!(claimable_amount > 0, ErrorCode::NoTokensToCllaim);

        // Transfer tokens from vesting vault to creator
        let mint_key = vesting_schedule.mint;
        let beneficiary_key = vesting_schedule.beneficiary;
        let bump = vesting_schedule.bump;
        
        let seeds = &[
            b"vesting",
            mint_key.as_ref(),
            beneficiary_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vesting_vault.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: ctx.accounts.vesting_schedule.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        transfer(cpi_ctx, claimable_amount)?;

        // Update claimed amount and last claim time
        let vesting_schedule = &mut ctx.accounts.vesting_schedule;
        vesting_schedule.claimed_amount = vesting_schedule.claimed_amount
            .checked_add(claimable_amount)
            .unwrap();
        vesting_schedule.last_claim_time = current_time;

        emit!(VestingClaimEvent {
            beneficiary: vesting_schedule.beneficiary,
            mint: vesting_schedule.mint,
            amount_claimed: claimable_amount,
            total_claimed: vesting_schedule.claimed_amount,
            timestamp: current_time,
        });

        Ok(())
    }

    /// View how many tokens are currently unlocked and claimable
    pub fn get_claimable_amount(
        ctx: Context<GetClaimableAmount>,
    ) -> Result<()> {
        let vesting_schedule = &ctx.accounts.vesting_schedule;
        let current_time = Clock::get()?.unix_timestamp;

        if current_time < vesting_schedule.cliff_time {
            msg!("Cliff not reached. Claimable: 0");
            return Ok(());
        }

        let unlocked_amount = calculate_unlocked_amount(vesting_schedule, current_time)?;
        let claimable_amount = unlocked_amount.saturating_sub(vesting_schedule.claimed_amount);

        msg!("Unlocked: {}, Claimed: {}, Claimable: {}", 
            unlocked_amount, 
            vesting_schedule.claimed_amount, 
            claimable_amount
        );

        Ok(())
    }

    /// Initialize the global configuration for bonding curve parameters
    pub fn initialize_global_config(
        ctx: Context<InitializeGlobalConfig>,
        treasury: Pubkey,
        virtual_sol_reserves: u64,
        virtual_token_reserves: u64,
        initial_token_supply: u64,
        fee_basis_points: u16,
        migration_threshold_sol: u64,
        raydium_amm_program: Pubkey,
    ) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        global_config.authority = ctx.accounts.authority.key();
        global_config.treasury = treasury;
        global_config.virtual_sol_reserves = virtual_sol_reserves;
        global_config.virtual_token_reserves = virtual_token_reserves;
        global_config.initial_token_supply = initial_token_supply;
        global_config.fee_basis_points = fee_basis_points;
        global_config.migration_threshold_sol = migration_threshold_sol;
        global_config.raydium_amm_program = raydium_amm_program;
        Ok(())
    }

    /// Update the global configuration (admin only)
    pub fn update_global_config(
        ctx: Context<UpdateGlobalConfig>,
        treasury: Option<Pubkey>,
        virtual_sol_reserves: Option<u64>,
        virtual_token_reserves: Option<u64>,
        initial_token_supply: Option<u64>,
        fee_basis_points: Option<u16>,
        migration_threshold_sol: Option<u64>,
        raydium_amm_program: Option<Pubkey>,
    ) -> Result<()> {
        let global_config = &mut ctx.accounts.global_config;
        
        // Only update fields that are provided
        if let Some(val) = treasury {
            global_config.treasury = val;
        }
        if let Some(val) = virtual_sol_reserves {
            global_config.virtual_sol_reserves = val;
        }
        if let Some(val) = virtual_token_reserves {
            global_config.virtual_token_reserves = val;
        }
        if let Some(val) = initial_token_supply {
            global_config.initial_token_supply = val;
        }
        if let Some(val) = fee_basis_points {
            global_config.fee_basis_points = val;
        }
        if let Some(val) = migration_threshold_sol {
            global_config.migration_threshold_sol = val;
        }
        if let Some(val) = raydium_amm_program {
            global_config.raydium_amm_program = val;
        }
        
        Ok(())
    }

    /// Close the global configuration and recover rent (admin only)
    /// This is a workaround for accounts with incompatible structure
    pub fn close_global_config(
        ctx: Context<CloseGlobalConfig>,
    ) -> Result<()> {
        // Transfer all lamports from global_config to authority
        let dest_starting_lamports = ctx.accounts.authority.lamports();
        **ctx.accounts.authority.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.global_config.lamports())
            .unwrap();
        **ctx.accounts.global_config.lamports.borrow_mut() = 0;

        Ok(())
    }

    /// Initialize a bonding curve for a token
    pub fn initialize_bonding_curve(
        ctx: Context<InitializeBondingCurve>,
        token_supply: u64,
    ) -> Result<()> {
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        let global_config = &ctx.accounts.global_config;
        
        bonding_curve.mint = ctx.accounts.mint.key();
        bonding_curve.creator = ctx.accounts.creator.key();
        bonding_curve.virtual_sol_reserves = global_config.virtual_sol_reserves;
        bonding_curve.virtual_token_reserves = global_config.virtual_token_reserves;
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.real_token_reserves = token_supply;
        bonding_curve.complete = false;
        bonding_curve.migrated = false;
        bonding_curve.raydium_pool = Pubkey::default();
        bonding_curve.bump = ctx.bumps.bonding_curve;

        // Move the full token supply from the creator's account into the bonding curve ATA
        // This replicates pump.fun behavior where all tokens are sold from the curve
        let cpi_accounts = Transfer {
            from: ctx
                .accounts
                .creator_token_account
                .to_account_info(),
            to: ctx
                .accounts
                .bonding_curve_token_account
                .to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, token_supply)?;

        Ok(())
    }

    /// Buy tokens from the bonding curve
    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        sol_amount: u64,
        min_tokens_out: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.bonding_curve.complete, ErrorCode::BondingCurveComplete);
        require!(!ctx.accounts.bonding_curve.migrated, ErrorCode::AlreadyMigrated);
        require!(sol_amount > 0, ErrorCode::InvalidAmount);

        // Calculate fee
        let fee = (sol_amount as u128)
            .checked_mul(ctx.accounts.global_config.fee_basis_points as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;
        let sol_after_fee = sol_amount.checked_sub(fee).unwrap();

        // Calculate tokens out using constant product formula
        let virtual_sol = ctx.accounts.bonding_curve.virtual_sol_reserves;
        let virtual_token = ctx.accounts.bonding_curve.virtual_token_reserves;
        let real_sol = ctx.accounts.bonding_curve.real_sol_reserves;
        let real_token = ctx.accounts.bonding_curve.real_token_reserves;

        let total_sol_before = (virtual_sol as u128).checked_add(real_sol as u128).unwrap();
        let total_token_before = (virtual_token as u128).checked_add(real_token as u128).unwrap();
        let k = total_sol_before.checked_mul(total_token_before).unwrap();

        // New SOL amount after adding user's SOL
        let total_sol_after = total_sol_before.checked_add(sol_after_fee as u128).unwrap();
        
        // Calculate new token reserves to maintain k
        let total_token_after = k.checked_div(total_sol_after).unwrap();
        let tokens_out = total_token_before.checked_sub(total_token_after).unwrap() as u64;

        require!(tokens_out >= min_tokens_out, ErrorCode::SlippageExceeded);
        require!(tokens_out <= real_token, ErrorCode::InsufficientTokens);

        // Transfer SOL (after fee) from buyer to bonding curve vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.bonding_curve_sol_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, sol_after_fee)?;

        // Transfer fee directly to treasury
        let fee_cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(fee_cpi_context, fee)?;

        // Transfer tokens from bonding curve to buyer
        let mint_key = ctx.accounts.bonding_curve.mint;
        let bump = ctx.accounts.bonding_curve.bump;
        
        let seeds = &[
            b"bonding_curve",
            mint_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.bonding_curve_token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        transfer(cpi_ctx, tokens_out)?;

        // Update reserves
        ctx.accounts.bonding_curve.real_sol_reserves = ctx.accounts.bonding_curve.real_sol_reserves.checked_add(sol_after_fee).unwrap();
        ctx.accounts.bonding_curve.real_token_reserves = ctx.accounts.bonding_curve.real_token_reserves.checked_sub(tokens_out).unwrap();

        // Check if bonding curve is complete (all tokens sold)
        if ctx.accounts.bonding_curve.real_token_reserves == 0 {
            ctx.accounts.bonding_curve.complete = true;
        }

        // Check if migration threshold has been reached
        let migration_threshold = ctx.accounts.global_config.migration_threshold_sol;
        if !ctx.accounts.bonding_curve.migrated 
            && ctx.accounts.bonding_curve.real_sol_reserves >= migration_threshold {
            // Emit event that threshold is reached - migration should be triggered
            emit!(MigrationThresholdReached {
                mint: ctx.accounts.bonding_curve.mint,
                sol_reserves: ctx.accounts.bonding_curve.real_sol_reserves,
                token_reserves: ctx.accounts.bonding_curve.real_token_reserves,
                timestamp: Clock::get()?.unix_timestamp,
            });
        }

        emit!(BuyEvent {
            buyer: ctx.accounts.buyer.key(),
            mint: ctx.accounts.bonding_curve.mint,
            sol_amount,
            tokens_out,
            fee,
        });

        Ok(())
    }

    /// Migrate bonding curve liquidity to Raydium when threshold is reached
    /// This creates a Raydium pool and adds liquidity with all SOL and remaining tokens
    /// 
    /// Migration Fee Economics:
    /// - Collects 6 SOL migration fee to treasury
    /// - Backend uses treasury funds to pay Raydium pool creation (~0.5 SOL)
    /// - Net platform revenue: ~5.5 SOL per migration
    /// - Remaining SOL (threshold - 6) goes into liquidity pool
    pub fn migrate_to_raydium(
        ctx: Context<MigrateToRaydium>,
    ) -> Result<()> {
        let bonding_curve = &ctx.accounts.bonding_curve;
        let global_config = &ctx.accounts.global_config;

        // Verify migration conditions
        require!(!bonding_curve.migrated, ErrorCode::AlreadyMigrated);
        require!(
            bonding_curve.real_sol_reserves >= global_config.migration_threshold_sol,
            ErrorCode::ThresholdNotReached
        );

        let total_sol = bonding_curve.real_sol_reserves;
        let tokens_to_migrate = bonding_curve.real_token_reserves;

        require!(total_sol > 0, ErrorCode::InsufficientSOL);
        require!(tokens_to_migrate > 0, ErrorCode::InsufficientTokens);

        // Migration fee: 6 SOL goes to treasury
        let migration_fee = 6_000_000_000u64; // 6 SOL in lamports
        require!(total_sol > migration_fee, ErrorCode::InsufficientSOLForMigration);
        
        let sol_to_migrate = total_sol.checked_sub(migration_fee).unwrap();

        msg!("Starting migration with {} total SOL", total_sol);
        msg!("Migration fee: {} SOL (6 SOL)", migration_fee);
        msg!("SOL to pool: {} lamports", sol_to_migrate);
        msg!("Tokens to pool: {} tokens", tokens_to_migrate);

        // Verify vault has enough balance
        let sol_vault_balance = ctx.accounts.bonding_curve_sol_vault.lamports();
        require!(sol_vault_balance >= total_sol, ErrorCode::InsufficientSOL);

        // Transfer migration fee to treasury
        **ctx.accounts.bonding_curve_sol_vault.try_borrow_mut_lamports()? -= migration_fee;
        **ctx.accounts.treasury.try_borrow_mut_lamports()? += migration_fee;
        msg!("Transferred {} SOL migration fee to treasury", migration_fee / 1_000_000_000);

        // Transfer remaining SOL to migration vault (for liquidity pool)
        **ctx.accounts.bonding_curve_sol_vault.try_borrow_mut_lamports()? -= sol_to_migrate;
        **ctx.accounts.migration_sol_vault.try_borrow_mut_lamports()? += sol_to_migrate;

        msg!("Transferred {} lamports to migration vault for pool", sol_to_migrate);

        // Transfer tokens from bonding curve token account to migration token account
        let mint_key = ctx.accounts.mint.key();
        let seeds = &[
            b"bonding_curve",
            mint_key.as_ref(),
            &[bonding_curve.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.bonding_curve_token_account.to_account_info(),
            to: ctx.accounts.migration_token_account.to_account_info(),
            authority: ctx.accounts.bonding_curve.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        transfer(cpi_ctx, tokens_to_migrate)?;

        msg!("Transferred {} tokens to migration vault", tokens_to_migrate);

        // Update bonding curve state
        let bonding_curve = &mut ctx.accounts.bonding_curve;
        bonding_curve.migrated = true;
        bonding_curve.raydium_pool = ctx.accounts.migration_sol_vault.key(); // Store migration vault for now
        bonding_curve.real_sol_reserves = 0;
        bonding_curve.real_token_reserves = 0;

        msg!("Migration state updated - bonding curve is now locked");

        // Emit migration complete event
        emit!(MigrationComplete {
            mint: bonding_curve.mint,
            raydium_pool: ctx.accounts.migration_sol_vault.key(),
            sol_migrated: sol_to_migrate,
            tokens_migrated: tokens_to_migrate,
            migration_fee,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Migration complete!");
        msg!("  - Migration fee collected: {} SOL", migration_fee / 1_000_000_000);
        msg!("  - SOL for pool: {} lamports", sol_to_migrate);
        msg!("  - Tokens for pool: {}", tokens_to_migrate);
        msg!("Use the create-raydium-pool script to finalize DEX listing.");

        Ok(())
    }

    /// Sell tokens back to the bonding curve
    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        token_amount: u64,
        min_sol_out: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.bonding_curve.complete, ErrorCode::BondingCurveComplete);
        require!(!ctx.accounts.bonding_curve.migrated, ErrorCode::AlreadyMigrated);
        require!(token_amount > 0, ErrorCode::InvalidAmount);

        // Calculate SOL out using constant product formula
        let virtual_sol = ctx.accounts.bonding_curve.virtual_sol_reserves;
        let virtual_token = ctx.accounts.bonding_curve.virtual_token_reserves;
        let real_sol = ctx.accounts.bonding_curve.real_sol_reserves;
        let real_token = ctx.accounts.bonding_curve.real_token_reserves;

        let total_sol_before = (virtual_sol as u128).checked_add(real_sol as u128).unwrap();
        let total_token_before = (virtual_token as u128).checked_add(real_token as u128).unwrap();
        let k = total_sol_before.checked_mul(total_token_before).unwrap();

        // New token amount after adding seller's tokens
        let total_token_after = total_token_before.checked_add(token_amount as u128).unwrap();
        
        // Calculate new SOL reserves to maintain k
        let total_sol_after = k.checked_div(total_token_after).unwrap();
        let sol_out_before_fee = total_sol_before.checked_sub(total_sol_after).unwrap() as u64;

        // Calculate fee
        let fee = (sol_out_before_fee as u128)
            .checked_mul(ctx.accounts.global_config.fee_basis_points as u128)
            .unwrap()
            .checked_div(10_000)
            .unwrap() as u64;
        let sol_out = sol_out_before_fee.checked_sub(fee).unwrap();

        require!(sol_out >= min_sol_out, ErrorCode::SlippageExceeded);
        // Check that we have enough real SOL to cover the full amount (before fees are taken)
        require!(sol_out_before_fee <= real_sol, ErrorCode::InsufficientSOL);

        // Transfer tokens from seller to bonding curve
        let cpi_accounts = Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.bonding_curve_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, token_amount)?;

        // Transfer SOL from bonding curve vault to seller (after fee)
        **ctx.accounts.bonding_curve_sol_vault.to_account_info().try_borrow_mut_lamports()? -= sol_out;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += sol_out;

        // Transfer fee from bonding curve vault to treasury
        **ctx.accounts.bonding_curve_sol_vault.to_account_info().try_borrow_mut_lamports()? -= fee;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += fee;

        // Update reserves
        // Subtract the full amount calculated by the constant product (before fee)
        ctx.accounts.bonding_curve.real_sol_reserves = ctx.accounts.bonding_curve.real_sol_reserves
            .checked_sub(sol_out_before_fee)
            .ok_or(ErrorCode::InsufficientSOL)?;
        ctx.accounts.bonding_curve.real_token_reserves = ctx.accounts.bonding_curve.real_token_reserves
            .checked_add(token_amount)
            .ok_or(ErrorCode::InvalidAmount)?;

        emit!(SellEvent {
            seller: ctx.accounts.seller.key(),
            mint: ctx.accounts.bonding_curve.mint,
            token_amount,
            sol_out,
            fee,
        });

        Ok(())
    }

    /// Withdraw accumulated platform fees from a bonding curve vault
    /// Only the global authority can call this function
    pub fn withdraw_platform_fees(
        ctx: Context<WithdrawPlatformFees>,
    ) -> Result<()> {
        // Verify the caller is the platform authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_config.authority,
            ErrorCode::Unauthorized
        );

        // Calculate accumulated fees
        // Fees = vault balance - real_sol_reserves - rent_exempt_minimum
        let vault_balance = ctx.accounts.bonding_curve_sol_vault.lamports();
        let real_sol_reserves = ctx.accounts.bonding_curve.real_sol_reserves;
        let rent_exempt_minimum = Rent::get()?.minimum_balance(0);

        // Ensure we have enough balance to cover reserves + rent
        require!(
            vault_balance >= real_sol_reserves + rent_exempt_minimum,
            ErrorCode::InsufficientFees
        );

        let accumulated_fees = vault_balance
            .checked_sub(real_sol_reserves)
            .unwrap()
            .checked_sub(rent_exempt_minimum)
            .unwrap();

        require!(accumulated_fees > 0, ErrorCode::NoFeesToWithdraw);

        // Transfer accumulated fees to treasury
        **ctx.accounts.bonding_curve_sol_vault.to_account_info().try_borrow_mut_lamports()? -= accumulated_fees;
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += accumulated_fees;

        emit!(FeeWithdrawalEvent {
            mint: ctx.accounts.bonding_curve.mint,
            authority: ctx.accounts.authority.key(),
            treasury: ctx.accounts.treasury.key(),
            amount: accumulated_fees,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Withdraw funds from migration vault to create Raydium pool
    /// This allows the platform to use migration vault funds for pool creation
    pub fn withdraw_migration_funds(
        ctx: Context<WithdrawMigrationFunds>,
        sol_amount: u64,
        token_amount: u64,
    ) -> Result<()> {
        // Verify the caller is the platform authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_config.authority,
            ErrorCode::Unauthorized
        );

        // Verify the bonding curve is migrated
        require!(
            ctx.accounts.bonding_curve.migrated,
            ErrorCode::NotMigrated
        );

        msg!("Withdrawing {} SOL and {} tokens from migration vault", sol_amount, token_amount);

        // Withdraw SOL using System Program
        if sol_amount > 0 {
            let vault_balance = ctx.accounts.migration_sol_vault.lamports();
            require!(vault_balance >= sol_amount, ErrorCode::InsufficientSOL);

            // Use System Program to transfer SOL from PDA to recipient
            let mint_key = ctx.accounts.mint.key();
            let vault_bump = ctx.bumps.migration_sol_vault;
            let vault_seeds: &[&[u8]] = &[
                b"migration_vault",
                mint_key.as_ref(),
                &[vault_bump],
            ];
            let vault_signer = &[vault_seeds];

            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.migration_sol_vault.to_account_info(),
                        to: ctx.accounts.recipient.to_account_info(),
                    },
                    vault_signer,
                ),
                sol_amount,
            )?;

            msg!("Transferred {} lamports from migration vault", sol_amount);
        }

        // Withdraw tokens
        if token_amount > 0 {
            let authority_bump = ctx.bumps.migration_authority;
            let seeds: &[&[u8]] = &[
                b"migration_authority",
                &[authority_bump],
            ];
            let signer = &[seeds];

            let cpi_accounts = Transfer {
                from: ctx.accounts.migration_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.migration_authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            
            transfer(cpi_ctx, token_amount)?;

            msg!("Transferred {} tokens from migration vault", token_amount);
        }

        emit!(MigrationFundsWithdrawn {
            mint: ctx.accounts.bonding_curve.mint,
            authority: ctx.accounts.authority.key(),
            recipient: ctx.accounts.recipient.key(),
            sol_amount,
            token_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Migration funds withdrawn successfully");

        Ok(())
    }

    /// Create Raydium pool and burn LP tokens to permanently lock liquidity
    /// This ensures liquidity cannot be rug-pulled, similar to pump.fun
    /// 
    /// IMPORTANT: This is a two-step process:
    /// 1. Use Raydium SDK/UI to create the pool with migration vault funds
    /// 2. Call this instruction to burn the received LP tokens
    /// 
    /// After this instruction, liquidity is PERMANENTLY LOCKED.
    pub fn burn_raydium_lp_tokens(
        ctx: Context<BurnRaydiumLpTokens>,
        lp_amount: u64,
    ) -> Result<()> {
        // Verify the caller is the platform authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_config.authority,
            ErrorCode::Unauthorized
        );

        // Verify the bonding curve is migrated
        require!(
            ctx.accounts.bonding_curve.migrated,
            ErrorCode::NotMigrated
        );

        msg!("Burning {} LP tokens to permanently lock liquidity", lp_amount);

        // Burn the LP tokens using migration authority
        let authority_bump = ctx.bumps.migration_authority;
        let seeds: &[&[u8]] = &[
            b"migration_authority",
            &[authority_bump],
        ];
        let signer = &[seeds];

        let burn_accounts = Burn {
            mint: ctx.accounts.lp_mint.to_account_info(),
            from: ctx.accounts.lp_token_account.to_account_info(),
            authority: ctx.accounts.migration_authority.to_account_info(),
        };
        let burn_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            burn_accounts,
            signer,
        );
        
        burn(burn_ctx, lp_amount)?;

        msg!("Successfully burned {} LP tokens", lp_amount);

        // Create LP burn info account to track the burn
        let lp_burn_info = &mut ctx.accounts.lp_burn_info;
        lp_burn_info.mint = ctx.accounts.bonding_curve.mint;
        lp_burn_info.lp_mint = ctx.accounts.lp_mint.key();
        lp_burn_info.raydium_pool = ctx.accounts.raydium_pool.key();
        lp_burn_info.lp_burned_amount = lp_amount;
        lp_burn_info.burn_timestamp = Clock::get()?.unix_timestamp;
        lp_burn_info.bump = ctx.bumps.lp_burn_info;

        emit!(LpTokensBurnedEvent {
            mint: ctx.accounts.bonding_curve.mint,
            raydium_pool: ctx.accounts.raydium_pool.key(),
            lp_mint: ctx.accounts.lp_mint.key(),
            lp_amount_burned: lp_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Liquidity is now PERMANENTLY LOCKED! 🔒");
        msg!("Pool address: {}", ctx.accounts.raydium_pool.key());
        msg!("LP tokens burned: {}", lp_amount);

        Ok(())
    }

    /// Complete Raydium pool creation with automatic LP burning
    /// This is a comprehensive instruction that handles the entire process
    /// 
    /// NOTE: This requires integration with Raydium's CPMM program
    /// For now, use the two-step process:
    /// 1. Create pool manually with Raydium SDK
    /// 2. Call burn_raydium_lp_tokens to lock liquidity
    pub fn create_and_lock_raydium_pool(
        ctx: Context<CreateAndLockRaydiumPool>,
    ) -> Result<()> {
        // Verify the caller is the platform authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.global_config.authority,
            ErrorCode::Unauthorized
        );

        // Verify the bonding curve is migrated
        require!(
            ctx.accounts.bonding_curve.migrated,
            ErrorCode::NotMigrated
        );

        // NOTE: Pool creation check would be done by checking if lp_burn_info account exists
        // For now, this is a placeholder instruction

        msg!("Creating Raydium pool with automatic LP burning...");

        // TODO: Implement Raydium CPMM pool creation via CPI
        // This requires:
        // 1. CPI to Raydium's initialize_pool instruction
        // 2. Add liquidity from migration vaults
        // 3. Receive LP tokens
        // 4. Immediately burn LP tokens
        
        msg!("⚠️  This instruction is not yet fully implemented.");
        msg!("Please use the two-step manual process:");
        msg!("1. Create Raydium pool using their SDK/UI");
        msg!("2. Call burn_raydium_lp_tokens to lock liquidity");

        Err(ErrorCode::NotImplemented.into())
    }
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, total_supply: u64, category: String)]
pub struct InitializeProject<'info> {
    #[account(
        init,
        payer = owner,
        seeds = [b"project", owner.key().as_ref(), symbol.as_bytes()],
        bump,
        space = ProjectState::MAX_SIZE,
    )]
    pub project_state: Account<'info, ProjectState>,

    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateMint<'info> {
    #[account(mut, has_one = owner @ ErrorCode::Unauthorized)]
    pub project_state: Account<'info, ProjectState>,

    #[account(
        init,
        payer = owner,
        mint::decimals = 6,
        mint::authority = owner,
        mint::freeze_authority = owner
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: This account is initialized by the Metaplex Token Metadata program
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    #[account(
        init,
        payer = authority,
        seeds = [b"global_config"],
        bump,
        space = GlobalConfig::MAX_SIZE,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateGlobalConfig<'info> {
    #[account(
        mut,
        seeds = [b"global_config"],
        bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseGlobalConfig<'info> {
    #[account(
        mut,
        seeds = [b"global_config"],
        bump,
    )]
    /// CHECK: We're closing this account without deserializing it - manual lamport transfer
    pub global_config: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeVesting<'info> {
    #[account(
        init,
        payer = creator,
        seeds = [b"vesting", mint.key().as_ref(), creator.key().as_ref()],
        bump,
        space = VestingSchedule::MAX_SIZE,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = vesting_schedule,
    )]
    pub vesting_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ClaimVestedTokens<'info> {
    #[account(
        mut,
        seeds = [b"vesting", mint.key().as_ref(), beneficiary.key().as_ref()],
        bump = vesting_schedule.bump,
        has_one = beneficiary @ ErrorCode::Unauthorized,
        has_one = mint @ ErrorCode::InvalidMint,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vesting_schedule,
    )]
    pub vesting_vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct GetClaimableAmount<'info> {
    #[account(
        seeds = [b"vesting", mint.key().as_ref(), vesting_schedule.beneficiary.as_ref()],
        bump = vesting_schedule.bump,
    )]
    pub vesting_schedule: Account<'info, VestingSchedule>,

    pub mint: Account<'info, Mint>,
}

#[derive(Accounts)]
pub struct InitializeBondingCurve<'info> {
    #[account(
        init,
        payer = creator,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump,
        space = BondingCurve::MAX_SIZE,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [b"sol_vault", mint.key().as_ref()],
        bump,
        space = 0,
    )]
    /// CHECK: This is a PDA used to hold SOL for the bonding curve
    pub sol_vault: AccountInfo<'info>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"sol_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for the bonding curve
    pub bonding_curve_sol_vault: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        constraint = treasury.key() == global_config.treasury @ ErrorCode::InvalidTreasury
    )]
    /// CHECK: Treasury address validated against global config
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"sol_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for the bonding curve
    pub bonding_curve_sol_vault: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        constraint = treasury.key() == global_config.treasury @ ErrorCode::InvalidTreasury
    )]
    /// CHECK: Treasury address validated against global config
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawPlatformFees<'info> {
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"sol_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for the bonding curve
    pub bonding_curve_sol_vault: AccountInfo<'info>,

    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    /// CHECK: Treasury account to receive fees (validated by authority)
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MigrateToRaydium<'info> {
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"sol_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for the bonding curve
    pub bonding_curve_sol_vault: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = bonding_curve,
    )]
    pub bonding_curve_token_account: Account<'info, TokenAccount>,

    /// Migration vault to hold SOL before Raydium pool creation
    #[account(
        mut,
        seeds = [b"migration_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for migration
    pub migration_sol_vault: AccountInfo<'info>,

    /// Migration token account to hold tokens before Raydium pool creation
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = migration_authority,
    )]
    pub migration_token_account: Account<'info, TokenAccount>,

    /// Authority for the migration vault (a PDA)
    #[account(
        seeds = [b"migration_authority"],
        bump,
    )]
    /// CHECK: This is a PDA used as authority for migration accounts
    pub migration_authority: AccountInfo<'info>,

    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = treasury.key() == global_config.treasury @ ErrorCode::InvalidTreasury
    )]
    /// CHECK: Treasury address validated against global config
    pub treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct WithdrawMigrationFunds<'info> {
    #[account(
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    /// Migration vault holding SOL
    #[account(
        mut,
        seeds = [b"migration_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for migration
    pub migration_sol_vault: AccountInfo<'info>,

    /// Migration token account holding tokens
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = migration_authority,
    )]
    pub migration_token_account: Account<'info, TokenAccount>,

    /// Authority for the migration vault (a PDA)
    #[account(
        seeds = [b"migration_authority"],
        bump,
    )]
    /// CHECK: This is a PDA used as authority for migration accounts
    pub migration_authority: AccountInfo<'info>,

    pub global_config: Account<'info, GlobalConfig>,

    /// Platform authority who can withdraw
    pub authority: Signer<'info>,

    /// Recipient for SOL
    #[account(mut)]
    /// CHECK: Recipient account (usually authority's wallet for pool creation)
    pub recipient: AccountInfo<'info>,

    /// Recipient token account
    #[account(
        mut,
        token::mint = mint,
        token::authority = recipient,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnRaydiumLpTokens<'info> {
    #[account(
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    /// LP burn info account to track the burn (new account)
    #[account(
        init,
        payer = authority,
        seeds = [b"lp_burn_info", mint.key().as_ref()],
        bump,
        space = LpBurnInfo::MAX_SIZE,
    )]
    pub lp_burn_info: Account<'info, LpBurnInfo>,

    /// LP token mint from Raydium pool
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,

    /// LP token account holding the LP tokens (owned by migration_authority)
    #[account(
        mut,
        token::mint = lp_mint,
        token::authority = migration_authority,
    )]
    pub lp_token_account: Account<'info, TokenAccount>,

    /// Authority for the migration vault (a PDA)
    #[account(
        seeds = [b"migration_authority"],
        bump,
    )]
    /// CHECK: This is a PDA used as authority for migration accounts
    pub migration_authority: AccountInfo<'info>,

    /// CHECK: Raydium pool address (for recording)
    pub raydium_pool: AccountInfo<'info>,

    pub global_config: Account<'info, GlobalConfig>,

    /// Platform authority who can call this
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateAndLockRaydiumPool<'info> {
    #[account(
        mut,
        seeds = [b"bonding_curve", mint.key().as_ref()],
        bump = bonding_curve.bump,
    )]
    pub bonding_curve: Account<'info, BondingCurve>,

    pub mint: Account<'info, Mint>,

    /// Migration vault holding SOL
    #[account(
        mut,
        seeds = [b"migration_vault", mint.key().as_ref()],
        bump,
    )]
    /// CHECK: This is a PDA used to hold SOL for migration
    pub migration_sol_vault: AccountInfo<'info>,

    /// Migration token account holding tokens
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = migration_authority,
    )]
    pub migration_token_account: Account<'info, TokenAccount>,

    /// Authority for the migration vault (a PDA)
    #[account(
        seeds = [b"migration_authority"],
        bump,
    )]
    /// CHECK: This is a PDA used as authority for migration accounts
    pub migration_authority: AccountInfo<'info>,

    pub global_config: Account<'info, GlobalConfig>,

    /// Platform authority who can call this
    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Bonding curve is complete")]
    BondingCurveComplete,
    #[msg("Insufficient tokens in bonding curve")]
    InsufficientTokens,
    #[msg("Insufficient SOL in bonding curve")]
    InsufficientSOL,
    #[msg("Already migrated to DEX")]
    AlreadyMigrated,
    #[msg("Migration threshold not reached")]
    ThresholdNotReached,
    #[msg("Token not migrated yet")]
    NotMigrated,
    #[msg("Invalid vesting duration")]
    InvalidVestingDuration,
    #[msg("Invalid cliff duration")]
    InvalidCliffDuration,
    #[msg("Cliff period not reached yet")]
    CliffNotReached,
    #[msg("No tokens available to claim")]
    NoTokensToCllaim,
    #[msg("Invalid mint address")]
    InvalidMint,
    #[msg("Insufficient fees to withdraw")]
    InsufficientFees,
    #[msg("No fees to withdraw")]
    NoFeesToWithdraw,
    #[msg("Invalid treasury address")]
    InvalidTreasury,
    #[msg("Insufficient SOL for migration (need at least 6 SOL fee + pool liquidity)")]
    InsufficientSOLForMigration,
    #[msg("LP tokens have already been burned")]
    LpAlreadyBurned,
    #[msg("Feature not yet implemented")]
    NotImplemented,
}

#[account]
pub struct ProjectState {
    pub owner: Pubkey,           // 32
    pub mint: Pubkey,            // 32
    pub name: String,            // 4 + up to 64
    pub symbol: String,          // 4 + up to 16
    pub created_at: i64,         // 8
    pub total_supply: u64,       // 8 - Total token supply
    pub category: String,        // 4 + up to 32 - Startup category/industry
}

impl ProjectState {
    pub const MAX_NAME: usize = 64;
    pub const MAX_SYMBOL: usize = 16;
    pub const MAX_CATEGORY: usize = 32;
    pub const MAX_SIZE: usize = 8  // discriminator
        + 32                       // owner
        + 32                       // mint
        + 4 + Self::MAX_NAME       // name
        + 4 + Self::MAX_SYMBOL     // symbol
        + 8                        // created_at
        + 8                        // total_supply
        + 4 + Self::MAX_CATEGORY;  // category
}

#[account]
pub struct GlobalConfig {
    pub authority: Pubkey,              // 32
    pub treasury: Pubkey,               // 32 - Treasury address for automatic fee collection
    pub virtual_sol_reserves: u64,      // 8 - Virtual SOL reserves for price stability
    pub virtual_token_reserves: u64,    // 8 - Virtual token reserves for price stability
    pub initial_token_supply: u64,      // 8 - Default initial token supply for new curves
    pub fee_basis_points: u16,          // 2 - Platform fee (e.g., 100 = 1%)
    pub migration_threshold_sol: u64,   // 8 - SOL threshold to trigger migration (e.g., 85 SOL)
    pub raydium_amm_program: Pubkey,    // 32 - Raydium AMM program ID
}

impl GlobalConfig {
    pub const MAX_SIZE: usize = 8  // discriminator
        + 32                       // authority
        + 32                       // treasury
        + 8                        // virtual_sol_reserves
        + 8                        // virtual_token_reserves
        + 8                        // initial_token_supply
        + 2                        // fee_basis_points
        + 8                        // migration_threshold_sol
        + 32;                      // raydium_amm_program
}

#[account]
pub struct BondingCurve {
    pub mint: Pubkey,                   // 32 - Token mint address
    pub creator: Pubkey,                // 32 - Creator of the bonding curve
    pub virtual_sol_reserves: u64,      // 8 - Virtual SOL for price calculation
    pub virtual_token_reserves: u64,    // 8 - Virtual tokens for price calculation
    pub real_sol_reserves: u64,         // 8 - Actual SOL in the curve
    pub real_token_reserves: u64,       // 8 - Actual tokens in the curve
    pub complete: bool,                 // 1 - Whether all tokens have been sold
    pub migrated: bool,                 // 1 - Whether migrated to DEX
    pub raydium_pool: Pubkey,           // 32 - Raydium pool address (if migrated)
    pub bump: u8,                       // 1 - PDA bump seed
}

impl BondingCurve {
    pub const MAX_SIZE: usize = 8  // discriminator
        + 32                       // mint
        + 32                       // creator
        + 8                        // virtual_sol_reserves
        + 8                        // virtual_token_reserves
        + 8                        // real_sol_reserves
        + 8                        // real_token_reserves
        + 1                        // complete
        + 1                        // migrated
        + 32                       // raydium_pool
        + 1;                       // bump
}

#[account]
pub struct LpBurnInfo {
    pub mint: Pubkey,                   // 32 - Token mint address
    pub lp_mint: Pubkey,                // 32 - LP token mint address
    pub raydium_pool: Pubkey,           // 32 - Raydium pool address
    pub lp_burned_amount: u64,          // 8 - Amount of LP tokens burned
    pub burn_timestamp: i64,            // 8 - When LP tokens were burned
    pub bump: u8,                       // 1 - PDA bump seed
}

impl LpBurnInfo {
    pub const MAX_SIZE: usize = 8   // discriminator
        + 32                        // mint
        + 32                        // lp_mint
        + 32                        // raydium_pool
        + 8                         // lp_burned_amount
        + 8                         // burn_timestamp
        + 1;                        // bump
}

#[account]
pub struct VestingSchedule {
    pub beneficiary: Pubkey,        // 32 - Who receives the vested tokens
    pub mint: Pubkey,               // 32 - Token mint address
    pub total_amount: u64,          // 8 - Total tokens to vest
    pub claimed_amount: u64,        // 8 - Amount already claimed
    pub start_time: i64,            // 8 - When vesting starts
    pub cliff_time: i64,            // 8 - When cliff period ends
    pub end_time: i64,              // 8 - When vesting fully completes
    pub release_interval: i64,      // 8 - How often tokens unlock (e.g., monthly = 2592000 seconds)
    pub last_claim_time: i64,       // 8 - Last time tokens were claimed
    pub bump: u8,                   // 1 - PDA bump seed
}

impl VestingSchedule {
    pub const MAX_SIZE: usize = 8   // discriminator
        + 32                        // beneficiary
        + 32                        // mint
        + 8                         // total_amount
        + 8                         // claimed_amount
        + 8                         // start_time
        + 8                         // cliff_time
        + 8                         // end_time
        + 8                         // release_interval
        + 8                         // last_claim_time
        + 1;                        // bump
}

// Helper function to calculate unlocked tokens based on vesting schedule
fn calculate_unlocked_amount(schedule: &VestingSchedule, current_time: i64) -> Result<u64> {
    // If we haven't reached the cliff, nothing is unlocked
    if current_time < schedule.cliff_time {
        return Ok(0);
    }

    // If we're past the end time, everything is unlocked
    if current_time >= schedule.end_time {
        return Ok(schedule.total_amount);
    }

    // Linear vesting between cliff and end
    let vesting_duration = schedule.end_time
        .checked_sub(schedule.start_time)
        .ok_or(ErrorCode::InvalidVestingDuration)?;
    
    let elapsed_time = current_time
        .checked_sub(schedule.start_time)
        .ok_or(ErrorCode::InvalidVestingDuration)?;

    // Calculate unlocked amount proportionally
    let unlocked = (schedule.total_amount as u128)
        .checked_mul(elapsed_time as u128)
        .unwrap()
        .checked_div(vesting_duration as u128)
        .unwrap() as u64;

    Ok(unlocked)
}

#[event]
pub struct BuyEvent {
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub sol_amount: u64,
    pub tokens_out: u64,
    pub fee: u64,
}

#[event]
pub struct SellEvent {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub token_amount: u64,
    pub sol_out: u64,
    pub fee: u64,
}

#[event]
pub struct MigrationThresholdReached {
    pub mint: Pubkey,
    pub sol_reserves: u64,
    pub token_reserves: u64,
    pub timestamp: i64,
}

#[event]
pub struct MigrationComplete {
    pub mint: Pubkey,
    pub raydium_pool: Pubkey,
    pub sol_migrated: u64,
    pub tokens_migrated: u64,
    pub migration_fee: u64,
    pub timestamp: i64,
}

#[event]
pub struct MigrationFundsWithdrawn {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct VestingClaimEvent {
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub amount_claimed: u64,
    pub total_claimed: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeWithdrawalEvent {
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct LpTokensBurnedEvent {
    pub mint: Pubkey,
    pub raydium_pool: Pubkey,
    pub lp_mint: Pubkey,
    pub lp_amount_burned: u64,
    pub timestamp: i64,
}


