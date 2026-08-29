export type Result<Value, Failure> = { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: Failure };
