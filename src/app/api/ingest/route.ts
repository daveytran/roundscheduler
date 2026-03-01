import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import {
  buildPlayersCsv,
  buildScheduleCsv,
  normalizeMatches,
  normalizePlayers,
  resolveImportType,
  type AIImportTarget,
} from '../../../lib/aiImport';

export const runtime = 'nodejs';

const requestSchema = z.object({
  target: z.enum(['players', 'schedule', 'auto']).default('auto'),
  input: z.string().min(1).max(60_000),
});

const aiOutputSchema = z.object({
  detectedType: z.enum(['players', 'schedule', 'unknown']),
  confidence: z.number().min(0).max(1).default(0.5),
  warnings: z.array(z.string()).default([]),
  players: z
    .array(
      z.object({
        name: z.string().default(''),
        gender: z.string().default(''),
        mixedClub: z.string().default(''),
        genderedClub: z.string().default(''),
        clothClub: z.string().default(''),
      })
    )
    .default([]),
  matches: z
    .array(
      z.object({
        round: z.string().default(''),
        division: z.string().default(''),
        time: z.string().default(''),
        field: z.string().default(''),
        team1: z.string().default(''),
        team2: z.string().default(''),
        referee: z.string().default(''),
      })
    )
    .default([]),
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: 'AI import is not configured. Add OPENAI_API_KEY to enable Vercel AI ingestion.',
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const parsedRequest = requestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload.',
          details: parsedRequest.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { target, input } = parsedRequest.data;

    const { object } = await generateObject({
      model: openai('gpt-4.1-mini'),
      schema: aiOutputSchema,
      temperature: 0,
      prompt: buildPrompt(input, target),
    });

    const players = normalizePlayers(object.players);
    const matches = normalizeMatches(object.matches);

    const resolvedType = resolveImportType({
      target,
      detectedType: object.detectedType,
      playerCount: players.length,
      matchCount: matches.length,
    });

    if (!resolvedType) {
      return NextResponse.json(
        {
          error: 'No valid player rows or match rows were detected. Check your input columns and try again.',
        },
        { status: 422 }
      );
    }

    if (resolvedType === 'players' && players.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid player rows were extracted.',
        },
        { status: 422 }
      );
    }

    if (resolvedType === 'schedule' && matches.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid schedule rows were extracted.',
        },
        { status: 422 }
      );
    }

    const normalizedText = resolvedType === 'players' ? buildPlayersCsv(players) : buildScheduleCsv(matches);

    const warnings = [...object.warnings];
    if (target === 'auto' && object.detectedType !== 'unknown' && object.detectedType !== resolvedType) {
      warnings.push(
        `Detected ${object.detectedType} data, but imported as ${resolvedType} because it had the most usable rows.`
      );
    }

    return NextResponse.json({
      dataType: resolvedType,
      rowCount: resolvedType === 'players' ? players.length : matches.length,
      confidence: object.confidence,
      warnings,
      normalizedText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI ingestion failed.';

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}

const buildPrompt = (input: string, target: AIImportTarget): string => {
  return `
You convert tournament data into structured rows for a scheduling app.
Input can be pasted text, CSV, TSV, spreadsheet dumps, bullet lists, or notes.

Target mode: ${target}

Rules:
1) If target mode is "players", prioritize extracting players.
2) If target mode is "schedule", prioritize extracting match schedule rows.
3) If target mode is "auto", infer whether this input is mostly players or schedule/match list.
4) Preserve team names exactly when possible.
5) For players:
- name is required.
- gender can be M/F/Male/Female or blank.
- mixedClub, genderedClub, clothClub can be blank.
6) For schedule:
- team1 is required.
- team2 can be blank only for setup or packing down activity rows.
- round, division, time, field, referee can be blank.
- keep "setup" and "packing down" wording in round/team fields if present.
7) Ignore obvious junk rows, headings, and totals.
8) Do not invent data.

Raw input:
${input}
`;
};

