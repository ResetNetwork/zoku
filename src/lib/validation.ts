import { z } from 'zod';

/**
 * Validation schemas for API request bodies
 * Uses Zod for runtime type checking and input sanitization
 */

// Common schemas
const uuidSchema = z.string().uuid();
const emailSchema = z.string().email().max(255);
const nameSchema = z.string().min(1).max(255);
const descriptionSchema = z.string().max(10000).optional();
const metadataSchema = z.record(z.unknown()).optional();

// Entanglement schemas
export const createEntanglementSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  parent_id: uuidSchema.optional(),
  initial_zoku: z.array(z.object({
    zoku_id: z.string(),
    role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
  })).optional()
});

export const updateEntanglementSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
  parent_id: uuidSchema.nullable().optional()
});

// Zoku schemas
export const createZokuSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  type: z.enum(['human', 'agent']),
  email: emailSchema.optional(),
  metadata: metadataSchema
});

export const updateZokuSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema,
  metadata: metadataSchema
});

export const updateZokuTierSchema = z.object({
  tier: z.enum(['observed', 'coherent', 'entangled', 'prime'])
});

// Qupt schemas
export const createQuptSchema = z.object({
  entanglement_id: uuidSchema,
  zoku_id: z.string().optional(),
  content: z.string().min(1).max(50000),
  source: z.string().max(50).optional(),
  external_id: z.string().max(255).optional(),
  metadata: metadataSchema,
  created_at: z.number().int().positive().optional()
});

export const batchCreateQuptsSchema = z.object({
  qupts: z.array(createQuptSchema).min(1).max(1000)
});

// Source schemas
export const createSourceSchema = z.object({
  type: z.enum(['github', 'zammad', 'gdocs', 'gdrive']),
  config: z.record(z.unknown()),
  jewels: z.record(z.unknown()).optional(),
  jewel_id: z.string().optional()
});

export const updateSourceSchema = z.object({
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional()
});

// Jewel schemas
export const createJewelSchema = z.object({
  name: nameSchema,
  type: z.enum(['github', 'zammad', 'gdocs', 'gdrive', 'gmail']),
  data: z.record(z.unknown())
});

export const updateJewelSchema = z.object({
  name: nameSchema.optional(),
  data: z.record(z.unknown()).optional()
});

// PASCI Matrix schemas
export const assignToMatrixSchema = z.object({
  zoku_id: z.string(),
  role: z.enum(['perform', 'accountable', 'control', 'support', 'informed'])
});

// Attributes schemas
export const setAttributesSchema = z.object({
  attributes: z.array(z.object({
    dimension_id: z.string(),
    value_id: z.string()
  })).max(50)
});

export const addAttributeSchema = z.object({
  dimension_id: z.string(),
  value_id: z.string()
});

// MCP Token schemas
export const createMcpTokenSchema = z.object({
  name: nameSchema,
  expires_in_days: z.number().int().min(1).max(365).default(90)
});

// OAuth schemas
export const oauthAuthorizeSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url().optional(),
  response_type: z.enum(['code']),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.enum(['S256']),
  scope: z.string().optional(),
  state: z.string().optional()
});

export const oauthTokenSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token']),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  client_id: z.string(),
  code_verifier: z.string().optional()
});

export const oauthRegisterSchema = z.object({
  client_name: z.string().min(1).max(255).optional(),
  redirect_uris: z.array(z.string().url()).optional()
});

// Audit Log schemas
export const listAuditLogsSchema = z.object({
  zoku_id: z.string().optional(),
  action: z.string().optional(),
  resource_type: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(100)
});

/**
 * Type inference helpers
 */
export type CreateEntanglementInput = z.infer<typeof createEntanglementSchema>;
export type UpdateEntanglementInput = z.infer<typeof updateEntanglementSchema>;
export type CreateZokuInput = z.infer<typeof createZokuSchema>;
export type UpdateZokuInput = z.infer<typeof updateZokuSchema>;
export type CreateQuptInput = z.infer<typeof createQuptSchema>;
export type BatchCreateQuptsInput = z.infer<typeof batchCreateQuptsSchema>;
export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type CreateJewelInput = z.infer<typeof createJewelSchema>;
export type UpdateJewelInput = z.infer<typeof updateJewelSchema>;
export type AssignToMatrixInput = z.infer<typeof assignToMatrixSchema>;
export type SetAttributesInput = z.infer<typeof setAttributesSchema>;
export type CreateMcpTokenInput = z.infer<typeof createMcpTokenSchema>;
