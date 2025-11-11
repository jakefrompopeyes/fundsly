import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/support
 * Submit a support ticket (bug report, error, issue, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Support tickets are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      type,
      subject,
      description,
      severity,
      userWallet,
      userEmail,
      pageUrl,
      browserInfo,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
    } = body;

    // Validate required fields
    if (!type || !subject || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: type, subject, and description are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['bug', 'error', 'issue', 'feature_request', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert support ticket into database
    const { data, error } = await supabase!
      .from('support_tickets')
      .insert({
        user_wallet: userWallet || null,
        user_email: userEmail || null,
        type,
        subject,
        description,
        severity: severity || 'medium',
        page_url: pageUrl || null,
        browser_info: browserInfo || null,
        steps_to_reproduce: stepsToReproduce || null,
        expected_behavior: expectedBehavior || null,
        actual_behavior: actualBehavior || null,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting support ticket:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to submit support ticket' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ticketId: data.id,
      message: 'Support ticket submitted successfully',
    });
  } catch (error: any) {
    console.error('Error processing support ticket:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/support
 * Fetch support tickets (for admin use or user's own tickets)
 * Optional query params:
 *   - userWallet: filter by user wallet
 *   - status: filter by status
 *   - type: filter by type
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Support tickets are temporarily unavailable' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userWallet = searchParams.get('userWallet');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let query = supabase!
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by user wallet if provided
    if (userWallet) {
      query = query.eq('user_wallet', userWallet);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by type if provided
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching support tickets:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch support tickets' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error processing GET request:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

