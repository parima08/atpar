import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { syncConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface PropertyOption {
  name: string;
  color?: string;
}

interface NotionProperty {
  type: string;
  select?: { options: PropertyOption[] };
  status?: { options: PropertyOption[] };
  multi_select?: { options: PropertyOption[] };
}

/**
 * GET /api/notion/fields?databaseId=xxx - Get database properties/fields
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const databaseId = request.nextUrl.searchParams.get('databaseId');
    if (!databaseId) {
      return NextResponse.json(
        { error: 'databaseId parameter required' },
        { status: 400 }
      );
    }

    const teamId = 1; // For simplicity
    const config = await db.query.syncConfigs.findFirst({
      where: eq(syncConfigs.teamId, teamId),
    });

    const notionToken = config?.notionToken;
    if (!notionToken) {
      return NextResponse.json(
        { error: 'Notion token not configured. Please add your token in Sync > Config.' },
        { status: 400 }
      );
    }

    const notion = new Client({ auth: notionToken });
    
    const database = await notion.databases.retrieve({ 
      database_id: databaseId 
    }) as { properties: Record<string, NotionProperty> };

    const fields = [];
    
    for (const [name, prop] of Object.entries(database.properties)) {
      const fieldInfo: {
        name: string;
        type: string;
        options?: Array<{ name: string; color?: string }>;
      } = {
        name,
        type: prop.type,
      };

      // Extract options for select/status/multi_select types
      if (prop.type === 'select' && prop.select?.options) {
        fieldInfo.options = prop.select.options.map(o => ({ 
          name: o.name, 
          color: o.color 
        }));
      } else if (prop.type === 'status' && prop.status?.options) {
        fieldInfo.options = prop.status.options.map(o => ({ 
          name: o.name, 
          color: o.color 
        }));
      } else if (prop.type === 'multi_select' && prop.multi_select?.options) {
        fieldInfo.options = prop.multi_select.options.map(o => ({ 
          name: o.name, 
          color: o.color 
        }));
      }

      fields.push(fieldInfo);
    }

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error fetching Notion fields:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch fields' },
      { status: 500 }
    );
  }
}
