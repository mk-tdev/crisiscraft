import { z } from 'zod';

export const reportSchema = z.object({
  message: z.string().min(1).max(320).describe('What you say on the team radio: first person, at most two sentences.'),
  cites: z.array(z.string().max(40)).max(6).describe('Observation ids you relied on.'),
}).strict();
export type Report = z.infer<typeof reportSchema>;

export const planSchema = z.object({
  message: z.string().min(1).max(320).describe('What you tell the commander: the plan in one or two sentences.'),
  rationale: z.string().min(1).max(400).describe('Why this plan, naming which teammate report or observation changed it.'),
  hold: z.boolean().describe('True when no dispatch should be made now.'),
  actions: z.array(z.object({
    vehicleId: z.string().max(20),
    requestId: z.string().max(40),
    quantity: z.number().int(),
    route: z.array(z.string().max(20)).min(2).max(12).describe('Place ids from the depot to the destination, following roads.'),
  }).strict()).max(2),
  cites: z.array(z.string().max(40)).max(8),
}).strict();
export type Plan = z.infer<typeof planSchema>;

export const jsonSchemas = {
  report: z.toJSONSchema(reportSchema),
  plan: z.toJSONSchema(planSchema),
};
