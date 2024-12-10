export type Maybe<T> = T | null | undefined;

export type Idx<T, K extends string> = K extends keyof T ? T[K] : never;

export type DeepIndex<T, K extends string> = T extends object ? (
  K extends `${infer F}.${infer R}` ? DeepIndex<Idx<T, F>, R> : Idx<T, K>
) : never;

export type UnionToParm<U> = U extends any ? (k: U) => void : never;
export type UnionToSect<U> = UnionToParm<U> extends ((k: infer I) => void) ? I : never;
export type ExtractParm<F> = F extends { (a: infer A): void } ? A : never;

export type SpliceOne<Union> = Exclude<Union, ExtractOne<Union>>;
export type ExtractOne<Union> = ExtractParm<UnionToSect<UnionToParm<Union>>>;

export type ToTuple<Union> = ToTupleRec<Union, []>;
export type ToTupleRec<Union, Rslt extends any[]> = 
    SpliceOne<Union> extends never ? [ExtractOne<Union>, ...Rslt]
    : ToTupleRec<SpliceOne<Union>, [ExtractOne<Union>, ...Rslt]>
;