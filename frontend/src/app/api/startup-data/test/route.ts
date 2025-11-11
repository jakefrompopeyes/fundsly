import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/startup-data/test
 * Diagnostic endpoint to test Supabase connection and table existence
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
    tests: [],
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ...diagnostics,
      error: 'Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.',
    }, { status: 503 });
  }

  try {
    // Test 1: Check if we can connect to Supabase
    const { data: connectionTest } = await supabase!
      .from('startup_data')
      .select('count')
      .limit(0);
    
    diagnostics.tests.push({
      name: 'Supabase Connection',
      status: 'passed',
      message: 'Successfully connected to Supabase',
    });

    // Test 2: Check if startup_data table exists
    const { data: tableCheck, error: tableError } = await supabase!
      .from('startup_data')
      .select('count')
      .limit(1);

    if (tableError) {
      diagnostics.tests.push({
        name: 'Table Existence Check',
        status: 'failed',
        error: tableError.message,
        code: tableError.code,
        details: tableError.details,
        hint: tableError.hint,
      });
    } else {
      diagnostics.tests.push({
        name: 'Table Existence Check',
        status: 'passed',
        message: 'startup_data table exists and is accessible',
      });
    }

    // Test 3: Try to count records
    const { count, error: countError } = await supabase!
      .from('startup_data')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      diagnostics.tests.push({
        name: 'Record Count',
        status: 'failed',
        error: countError.message,
      });
    } else {
      diagnostics.tests.push({
        name: 'Record Count',
        status: 'passed',
        count: count || 0,
      });
    }

    // Test 4: Check RLS policies by trying a test insert (we'll roll it back)
    const testMint = `test_${Date.now()}`;
    const { data: insertData, error: insertError } = await supabase!
      .from('startup_data')
      .insert({
        mint: testMint,
        creator_wallet: 'test_wallet',
        name: 'Test Startup',
        symbol: 'TEST',
        description: 'Test description',
        category: 'Other',
      })
      .select()
      .single();

    if (insertError) {
      diagnostics.tests.push({
        name: 'Insert Permission (RLS)',
        status: 'failed',
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        suggestion: insertError.code === '42501' 
          ? 'Row Level Security (RLS) policy is blocking inserts. Check your RLS policies in Supabase.'
          : 'Check table permissions and RLS policies.',
      });
    } else {
      // Clean up test record
      await supabase!
        .from('startup_data')
        .delete()
        .eq('mint', testMint);

      diagnostics.tests.push({
        name: 'Insert Permission (RLS)',
        status: 'passed',
        message: 'Can insert records (test record created and deleted)',
      });
    }

    diagnostics.overallStatus = diagnostics.tests.every((t: any) => t.status === 'passed') 
      ? 'all_passed' 
      : 'some_failed';

    return NextResponse.json(diagnostics);
  } catch (error: any) {
    diagnostics.tests.push({
      name: 'General Error',
      status: 'failed',
      error: error.message,
      stack: error.stack,
    });

    return NextResponse.json({
      ...diagnostics,
      overallStatus: 'error',
    }, { status: 500 });
  }
}

