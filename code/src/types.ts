export type PlainProp = 'date-time' | 'date' | 'string' | 'number' | 'int64' | 'int32' | 'boolean';
export type Prop = {
    name: string;
    required: boolean;
    nullable?: boolean;
    description?: string;
    type: PropSpec;
    extraTags: ExtraTag[];
};
export type ExtraTag = { key: string; value: string };
export type PropSpec =
    | { type: 'plain'; value: PlainProp }
    | { type: 'enum'; value: string[] }
    | { type: 'ref'; value: string }
    | { type: 'array'; value: PropSpec }
    | { type: 'map'; value: PropSpec }
    | { type: 'object'; value: Prop[]; extensions: string[] };

export type Nesting = 'map' | 'array';
export type AttributeInfo = { name: string; required: boolean };
export type TSRef = { name: string; attributeInfo?: AttributeInfo; nesting?: Nesting; isExtension?: boolean };
export type Meta = { tsRefs: TSRef[]; goRefs: Set<string>; name: string };
export type Schema = { name: string; spec: PropSpec; meta: Meta };
export type Request = {
    path: string;
    requestType: 'get' | 'post' | 'put' | 'delete';
    description?: string;
    name: string;
    category: string;
};

export type GoGenerateTarget = { base: string; models: string; withRouters?: boolean; ignoredFiles: string[] };
export type YAMLSpec = {
    openapiPath: string;
    goGenerateTarget: GoGenerateTarget;
};
