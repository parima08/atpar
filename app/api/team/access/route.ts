import { NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getTeamAccessStatus, TeamAccessStatus } from '@/lib/db/trial';

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's team
    const result = await db
      .select({ team: teams })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ 
        status: 'no_access' 
      } as TeamAccessStatus);
    }

    const team = result[0].team;
    const accessStatus = getTeamAccessStatus(team);

    return NextResponse.json(accessStatus);
  } catch (error) {
    console.error('Error fetching team access status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
