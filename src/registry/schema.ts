import { Ajv } from 'ajv';
import { CosmosError } from '../errors.js';
const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
export const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
export const text = { type: 'string', minLength: 1 };
export function validate<T>(schema: object, value: unknown): T {
  const check = ajv.compile(schema);
  if (!check(value)) {
    const errors = check.errors ?? [];
    throw new CosmosError(errors.some(x => x.keyword === 'additionalProperties') ? 'UNKNOWN_FIELD' : 'INVALID_INPUT', '输入不符合当前操作契约。', { errors });
  }
  return value as T;
}
