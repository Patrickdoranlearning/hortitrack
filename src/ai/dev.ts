'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/production-protocol.ts';
import '@/ai/flows/care-recommendations.ts';
import '@/ai/flows/nursery-intelligence.ts';
import '@/ai/flows/batch-chat-flow.ts';
