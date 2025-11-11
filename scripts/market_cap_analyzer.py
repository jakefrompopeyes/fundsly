#!/usr/bin/env python3
"""
Market Cap Launch Analyzer
Compare different market cap configurations for bonding curve launches
"""

def calculate_virtual_tokens(market_cap_sol, virtual_sol, total_supply):
    """Calculate required virtual tokens for a target market cap"""
    initial_price = market_cap_sol / total_supply
    virtual_tokens = (virtual_sol / initial_price) - total_supply
    return max(0, virtual_tokens)

def calculate_buy_cost(virtual_sol, virtual_tokens, total_supply, buy_amount):
    """Calculate SOL cost for buying specific amount of tokens"""
    k = virtual_sol * (virtual_tokens + total_supply)
    remaining = total_supply - buy_amount
    new_sol = k / (virtual_tokens + remaining)
    return new_sol - virtual_sol

def analyze_market_cap(market_cap_usd, sol_price_usd=200, virtual_sol=200):
    """Complete analysis of a market cap configuration"""
    market_cap_sol = market_cap_usd / sol_price_usd
    total_supply = 1_000_000_000
    
    virtual_tokens = calculate_virtual_tokens(market_cap_sol, virtual_sol, total_supply)
    initial_price_sol = market_cap_sol / total_supply
    
    # Calculate costs
    costs = {
        '10%': calculate_buy_cost(virtual_sol, virtual_tokens, total_supply, total_supply * 0.10),
        '25%': calculate_buy_cost(virtual_sol, virtual_tokens, total_supply, total_supply * 0.25),
        '50%': calculate_buy_cost(virtual_sol, virtual_tokens, total_supply, total_supply * 0.50),
        '75%': calculate_buy_cost(virtual_sol, virtual_tokens, total_supply, total_supply * 0.75),
        '90%': calculate_buy_cost(virtual_sol, virtual_tokens, total_supply, total_supply * 0.90),
    }
    
    return {
        'market_cap_usd': market_cap_usd,
        'market_cap_sol': market_cap_sol,
        'virtual_sol': virtual_sol,
        'virtual_tokens': virtual_tokens,
        'initial_price_sol': initial_price_sol,
        'costs': costs
    }

def print_market_cap_comparison():
    """Print comparison of different market cap presets"""
    
    presets = [
        ("Micro Launch", 4_600),
        ("Small Launch", 10_000),
        ("Medium Launch", 25_000),
        ("Large Launch", 50_000),
        ("Premium Launch", 100_000),
    ]
    
    sol_price = 200
    
    print("\n" + "="*80)
    print("MARKET CAP LAUNCH ANALYZER")
    print("="*80)
    print(f"\nSOL Price: ${sol_price}")
    print(f"Total Supply: 1,000,000,000 tokens\n")
    
    for name, market_cap in presets:
        config = analyze_market_cap(market_cap, sol_price)
        
        print("="*80)
        print(f"\n{name}: ${market_cap:,}")
        print("-" * 80)
        print(f"Market Cap: ${config['market_cap_usd']:,} ({config['market_cap_sol']:.2f} SOL)")
        print(f"Initial Price: {config['initial_price_sol']:.10f} SOL per token")
        print(f"Virtual SOL: {config['virtual_sol']} SOL")
        print(f"Virtual Tokens: {config['virtual_tokens']/1_000_000:.2f}M")
        print()
        print("Cost to buy supply:")
        for pct, cost in config['costs'].items():
            color = ""
            if cost < 10:
                color = "⚡"  # Fast/cheap
            elif cost < 50:
                color = "✓"  # Good
            elif cost < 100:
                color = "◆"  # Balanced
            else:
                color = "◉"  # Expensive/slow
            print(f"  {color} {pct:>3}: {cost:7.2f} SOL")
        print()

def whale_resistance_analysis():
    """Analyze whale resistance for different market caps"""
    
    print("\n" + "="*80)
    print("WHALE RESISTANCE ANALYSIS")
    print("="*80)
    print("\nHow much supply can a whale buy with different budgets?\n")
    
    presets = [
        ("Micro ($4.6k)", 4_600),
        ("Small ($10k)", 10_000),
        ("Medium ($25k)", 25_000),
        ("Large ($50k)", 50_000),
        ("Premium ($100k)", 100_000),
    ]
    
    whale_budgets = [10, 20, 50, 100, 200]
    
    print(f"{'Whale Budget':<20}", end="")
    for name, _ in presets:
        print(f"{name:<15}", end="")
    print("\n" + "-"*95)
    
    for budget in whale_budgets:
        print(f"{budget} SOL {' '*13}", end="")
        
        for name, market_cap in presets:
            config = analyze_market_cap(market_cap)
            total_supply = 1_000_000_000
            
            # Calculate percentage they can buy
            k = config['virtual_sol'] * (config['virtual_tokens'] + total_supply)
            new_sol = config['virtual_sol'] + budget
            new_tokens = k / new_sol
            tokens_bought = (config['virtual_tokens'] + total_supply) - new_tokens
            pct = (tokens_bought / total_supply) * 100
            
            print(f"{pct:5.1f}%{' '*9}", end="")
        print()
    
    print("\n💡 Lower percentages = Better whale resistance")

def time_estimation():
    """Estimate time to complete based on market cap"""
    
    print("\n" + "="*80)
    print("ESTIMATED TIME TO COMPLETE")
    print("="*80)
    print("\nBased on typical trading patterns:\n")
    
    estimates = [
        ("Micro Launch ($4.6k)", "2-6 hours", "Fast viral launch"),
        ("Small Launch ($10k)", "6-12 hours", "Active trading day"),
        ("Medium Launch ($25k)", "1-2 days", "Steady growth"),
        ("Large Launch ($50k)", "2-4 days", "Serious project timeline"),
        ("Premium Launch ($100k)", "4-7 days", "Major launch event"),
    ]
    
    for name, time, note in estimates:
        print(f"{name:<25} {time:<15} - {note}")
    
    print("\n⚠️  Actual time depends on marketing, community size, and market conditions")

def funding_goal_calculator():
    """Help calculate market cap based on funding goals"""
    
    print("\n" + "="*80)
    print("FUNDING GOAL CALCULATOR")
    print("="*80)
    print("\nReverse engineer market cap from fundraising goals:\n")
    
    scenarios = [
        ("Raise 85 SOL (migration threshold)", 85, 0.50),
        ("Raise 50 SOL (small project)", 50, 0.50),
        ("Raise 150 SOL (large project)", 150, 0.50),
        ("Raise 85 SOL, sell only 30%", 85, 0.30),
    ]
    
    for desc, target_sol, sell_pct in scenarios:
        # Work backwards: if we collect target_sol when sell_pct is sold
        # What market cap do we need?
        
        # This is approximate - actual calculation is more complex
        # due to bonding curve mechanics
        implied_market_cap_sol = target_sol / sell_pct * 2
        implied_market_cap_usd = implied_market_cap_sol * 200
        
        print(f"{desc}")
        print(f"  Target: Raise {target_sol} SOL after selling {sell_pct*100:.0f}% of supply")
        print(f"  Implied Market Cap: ~${implied_market_cap_usd/1000:.1f}k")
        print()

def recommendation_engine():
    """Provide recommendations based on project stage"""
    
    print("\n" + "="*80)
    print("MARKET CAP RECOMMENDATION ENGINE")
    print("="*80)
    print()
    
    categories = [
        {
            'type': "Meme Coin / Fun Project",
            'team': "1-2 people",
            'product': "Idea or concept",
            'traction': "None yet",
            'recommended': "Micro ($4.6k)",
            'why': "Fast launch, maximum accessibility, viral potential"
        },
        {
            'type': "Early Stage Project",
            'team': "2-5 people",
            'product': "MVP or demo",
            'traction': "Small community",
            'recommended': "Small ($10k)",
            'why': "Balanced approach, tests market interest"
        },
        {
            'type': "Serious Project",
            'team': "5-10 people",
            'product': "Working beta",
            'traction': "Active users",
            'recommended': "Medium ($25k)",
            'why': "Professional signal, attracts serious investors"
        },
        {
            'type': "Established Project",
            'team': "10+ people",
            'product': "Launched product",
            'traction': "Significant users",
            'recommended': "Large ($50k)",
            'why': "Premium positioning, filters for commitment"
        },
        {
            'type': "Major Protocol",
            'team': "15+ people",
            'product': "Proven product",
            'traction': "Strong metrics",
            'recommended': "Premium ($100k)",
            'why': "Maximum credibility, institutional interest"
        },
    ]
    
    for i, cat in enumerate(categories, 1):
        print(f"{i}. {cat['type']}")
        print(f"   Team: {cat['team']}")
        print(f"   Product: {cat['product']}")
        print(f"   Traction: {cat['traction']}")
        print(f"   → Recommended: {cat['recommended']}")
        print(f"   Why: {cat['why']}")
        print()

def sol_price_sensitivity():
    """Show how different SOL prices affect configuration"""
    
    print("\n" + "="*80)
    print("SOL PRICE SENSITIVITY ANALYSIS")
    print("="*80)
    print("\nHow virtual tokens change with SOL price for $25k market cap:\n")
    
    target_market_cap = 25_000
    sol_prices = [100, 150, 200, 250, 300]
    
    print(f"{'SOL Price':<12} {'Market Cap (SOL)':<18} {'Virtual Tokens':<15} {'Initial Price (SOL)':<20}")
    print("-" * 70)
    
    for sol_price in sol_prices:
        config = analyze_market_cap(target_market_cap, sol_price)
        print(f"${sol_price:<11} {config['market_cap_sol']:<18.2f} "
              f"{config['virtual_tokens']/1_000_000:<15.2f}M "
              f"{config['initial_price_sol']:<20.10f}")
    
    print("\n💡 The system auto-adjusts virtual tokens to maintain USD market cap")

if __name__ == "__main__":
    print("\n" + "🚀" * 40)
    print("FUNDLY MARKET CAP LAUNCH ANALYZER")
    print("🚀" * 40)
    
    # Run all analyses
    print_market_cap_comparison()
    whale_resistance_analysis()
    time_estimation()
    funding_goal_calculator()
    recommendation_engine()
    sol_price_sensitivity()
    
    print("\n" + "="*80)
    print("✅ Analysis Complete!")
    print("="*80)
    print("\n📖 For detailed guidance, see: MARKET_CAP_LAUNCH_GUIDE.md")
    print("🔧 To configure: Visit /admin/init-config in your frontend\n")

